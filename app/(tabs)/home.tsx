import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { doc, getDoc, setDoc } from "firebase/firestore"; // NEW 🔥 setDoc ajouté
import { auth, db } from "../firebase/config";

// 🔥 OPENAI
import OpenAI from "openai";

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [firstname, setFirstname] = useState("");

  // PREMIUM
  const [subscriptionPlan, setSubscriptionPlan] =
    useState<"free" | "premium">("free");

  // NEW 🔥 Compteur recettes restantes
  const [recipesLeft, setRecipesLeft] = useState(3);

  // Input recette manuelle
  const [manualModal, setManualModal] = useState(false);
  const [manualInput, setManualInput] = useState("");

  // Message génération
  const [isGenerating, setIsGenerating] = useState(false);

  // Charger prénom + abonnement + compteur
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      // Profil
      const ref = doc(db, "users", user.uid, "profile", "info");
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setFirstname(data.firstname || "Utilisateur");
      }

      // Subscription
      const subRef = doc(db, "users", user.uid, "subscription", "status");
      const subSnap = await getDoc(subRef);

      let isPremium = false;

      if (subSnap.exists()) {
        const data = subSnap.data();
        isPremium = data.isPremium === true;
        setSubscriptionPlan(isPremium ? "premium" : "free");
      }

      // NEW 🔥 Charger compteur si FREE
      if (!isPremium) {
        const limitRef = doc(db, "users", user.uid, "subscription", "limits");
        const limitSnap = await getDoc(limitRef);

        let recipesThisWeek = 0;
        let lastReset = null;

        if (limitSnap.exists()) {
          recipesThisWeek = limitSnap.data().recipesThisWeek || 0;
          lastReset = limitSnap.data().lastReset
            ? new Date(limitSnap.data().lastReset)
            : null;
        }

        // Reset lundi
        const now = new Date();
        const day = now.getDay();

        const shouldReset =
          !lastReset ||
          now.getFullYear() !== lastReset.getFullYear() ||
          now.getMonth() !== lastReset.getMonth() ||
          now.getDate() - lastReset.getDate() >= 7 ||
          day === 1;

        if (shouldReset) {
          await setDoc(
            limitRef,
            {
              recipesThisWeek: 0,
              lastReset: now.toISOString(),
            },
            { merge: true }
          );
          setRecipesLeft(3);
        } else {
          setRecipesLeft(3 - recipesThisWeek);
        }
      }
    };

    loadData();
  }, [user]);

  // --------------------------------------------
  // 🔥 GENERATE RECIPE WITH LIMITS
  // --------------------------------------------
  const generateRecipeFromText = async () => {
    if (isGenerating) return;

    if (!manualInput.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un aliment.");
      return;
    }

    setManualModal(false);
    setIsGenerating(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Erreur", "Utilisateur non connecté.");
        setIsGenerating(false);
        return;
      }

      // NEW 🔥 Vérifier limites si FREE
      if (subscriptionPlan === "free") {
        const limitRef = doc(db, "users", user.uid, "subscription", "limits");
        const limitSnap = await getDoc(limitRef);

        let recipesThisWeek = 0;
        let lastReset = null;

        if (limitSnap.exists()) {
          recipesThisWeek = limitSnap.data().recipesThisWeek || 0;
          lastReset = limitSnap.data().lastReset
            ? new Date(limitSnap.data().lastReset)
            : null;
        }

        const now = new Date();
        const day = now.getDay();

        const shouldReset =
          !lastReset ||
          now.getFullYear() !== lastReset.getFullYear() ||
          now.getMonth() !== lastReset.getMonth() ||
          now.getDate() - lastReset.getDate() >= 7 ||
          day === 1;

        if (shouldReset) {
          recipesThisWeek = 0;
        }

        if (recipesThisWeek >= 3) {
          Alert.alert(
            "Limite atteinte",
            "Vous avez déjà généré 3 recettes cette semaine.\nPassez à Premium pour des recettes illimitées."
          );
          setIsGenerating(false);
          return;
        }

        // Incrémenter 🔥
        await setDoc(
          limitRef,
          {
            recipesThisWeek: recipesThisWeek + 1,
            lastReset: now.toISOString(),
          },
          { merge: true }
        );

        setRecipesLeft(2 - recipesThisWeek);
      }

      // ----------------------------------------
      // 🔥 OPENAI — Génération recette
      // ----------------------------------------
      const profileSnap = await getDoc(
        doc(db, "users", user.uid, "profile", "info")
      );
      const bodySnap = await getDoc(
        doc(db, "users", user.uid, "body", "metrics")
      );
      const allergySnap = await getDoc(
        doc(db, "users", user.uid, "allergies", "list")
      );

      const firstname = profileSnap.exists()
        ? profileSnap.data().firstname
        : "Utilisateur";
      const goal = profileSnap.exists()
        ? profileSnap.data().goal
        : "Manger équilibré";

      const height = bodySnap.exists() ? bodySnap.data().height : "?";
      const weight = bodySnap.exists() ? bodySnap.data().weight : "?";

      const allergies = allergySnap.exists()
        ? allergySnap.data().values
        : [];

      const allergySentence =
        allergies.length > 0
          ? `Il est allergique à : ${allergies.join(", ")}.`
          : "Aucune allergie.";

      const openai = new OpenAI({
        apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
              Tu es un chef nutritionniste expert.
              Crée UNE recette simple et saine à partir d’un aliment donné.
            `,
          },
          {
            role: "user",
            content: `Ingrédient principal : ${manualInput}`,
          },
        ],
        max_tokens: 900,
      });

      const recipeText = response?.choices?.[0]?.message?.content;

      if (!recipeText) {
        Alert.alert("Erreur", "Impossible de générer une recette.");
        setIsGenerating(false);
        return;
      }

      router.push({
        pathname: "/recipe-result",
        params: { recipe: recipeText, ingredient: manualInput },
      });

    } catch (e) {
      console.log(e);
      Alert.alert("Erreur", "Impossible de générer la recette.");
    }

    setIsGenerating(false);
  };

  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
  <Text style={styles.helloText}>Hello, {firstname} 👋</Text>

  {subscriptionPlan === "premium" && (
    <View style={styles.premiumUserBadge}>
      <Ionicons name="star" size={14} color="#fff" />
      <Text style={styles.premiumUserBadgeText}>Membre Premium</Text>
    </View>
  )}
</View>

          <Text style={styles.subtitle}>
            Continuez à bien manger, chaque effort compte !
          </Text>
        </View>

        <Pressable
          style={styles.profileIcon}
          onPress={() => router.push("/profile")}
        >
          <Ionicons name="person-circle-outline" size={32} color="#2EB872" />
        </Pressable>
      </View>

      {/* 🔥 Compteur recettes FREE */}
      {subscriptionPlan === "free" && (
        <Text style={styles.counter}>
          Recettes restantes cette semaine : {recipesLeft}/3
        </Text>
      )}

      {/* IA Button */}
      <Pressable style={styles.iaButton}>
        <Ionicons name="sparkles-outline" size={18} color="#fff" />
        <Text style={styles.iaText}>IA Nutritionnelle</Text>
      </Pressable>

      {/* SECTION CAMERA */}
      <View style={{ marginTop: 25, alignItems: "center" }}>
        <Text style={styles.sectionTitle}>
          Prenez une photo de votre aliment
        </Text>
        <Text style={styles.sectionSubtitle}>
          Notre IA vous proposera des recettes saines et personnalisées
        </Text>
      </View>

      {/* CAMERA */}
      <Pressable
        onPress={() => router.push("/camera-screen")}
        style={styles.cameraContainer}
      >
        <Ionicons
          name="camera-outline"
          size={64}
          color="#2EB872"
          style={{ marginBottom: 10 }}
        />
        <Text style={styles.cameraText}>Analyser l’image</Text>
      </Pressable>

      {/* MANUAL ENTRY */}
      <Pressable
        style={styles.manualButton}
        onPress={() => setManualModal(true)}
      >
        <Text style={styles.manualButtonText}>
          Entrer un aliment manuellement
        </Text>
      </Pressable>

      {/* Génération en cours */}
      {isGenerating && (
        <Text style={styles.loading}>Génération de la recette en cours…</Text>
      )}

      {/* --- BOUTONS SECONDAIRES --- */}
<View style={{ width: "100%", marginTop: 20 }}>

  {/* Ligne 1 : Planning + Objectifs */}
  <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
    
    <Pressable
      style={[styles.bottomButton, { width: "48%" }]}
      onPress={() => router.push("/planning")}
    >
      <Ionicons name="calendar-outline" size={22} color="#2EB872" />
      <Text style={styles.bottomText}>Planning de mes Recettes</Text>
    </Pressable>

    <Pressable
      style={[styles.bottomButton, { width: "48%" }]}
      onPress={() => router.push("/objectifs-adaptes")}
    >
      <Ionicons name="bar-chart-outline" size={22} color="#2EB872" />
      <Text style={styles.bottomText}>Objectifs adaptés</Text>
    </Pressable>
  </View>

  {/* Ligne 2 : Historique centré */}
  <View style={{ width: "100%", alignItems: "center", marginTop: 12 }}>
    <Pressable
      style={[styles.bottomButton, { width: "48%" }]}
      onPress={() => router.push("/history")}
    >
      <Ionicons name="time-outline" size={22} color="#2EB872" />
      <Text style={styles.bottomText}>Historique</Text>
    </Pressable>
  </View>

</View>

      {/* PREMIUM BUTTON */}
      <Pressable
        disabled={subscriptionPlan === "premium"}
        onPress={() => {
          if (subscriptionPlan === "free") router.push("/profile");
        }}
        style={[
          styles.premiumBanner,
          subscriptionPlan === "premium" && styles.premiumBannerPremium,
        ]}
      >
        <Text style={styles.premiumText}>
          {subscriptionPlan === "premium"
            ? "Vous êtes un membre Premium ⭐"
            : "Passer à Save Eat Premium"}
        </Text>
      </Pressable>

      {/* MODAL */}
      <Modal visible={manualModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Entrer un aliment</Text>
            <Text style={styles.modalSubtitle}>
              Entrez le nom d’un aliment pour générer une recette personnalisée.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Ex : Poulet, Saumon, Brocoli…"
              value={manualInput}
              onChangeText={setManualInput}
            />

            <View style={styles.modalRow}>
              <Pressable
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setManualModal(false)}
              >
                <Text style={styles.cancelTxt}>Annuler</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={generateRecipeFromText}
              >
                <Text style={styles.confirmTxt}>Valider</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 50 : 70,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  helloText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#222",
  },

  subtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },

  profileIcon: {
    backgroundColor: "#E8F5E9",
    borderRadius: 50,
    padding: 5,
  },

  // NEW 🔥 compteur
  counter: {
    marginTop: 10,
    textAlign: "center",
    fontWeight: "600",
    color: "#2EB872",
    fontSize: 14,
  },

  iaButton: {
    flexDirection: "row",
    backgroundColor: "#2EB872",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 25,
  },

  iaText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
    marginBottom: 5,
  },

  sectionSubtitle: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    marginBottom: 15,
  },

  row: {
  flexDirection: "row",
  justifyContent: "space-between",
  width: "100%",
},

centerRow: {
  width: "100%",
  alignItems: "center",
  marginTop: 12,
},

bottomButtonSingle: {
  backgroundColor: "#fff",
  borderRadius: 15,
  width: "48%",       // même largeur que les deux du dessus !
  paddingVertical: 15,
  alignItems: "center",
  justifyContent: "center",
  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 2,
},


  cameraContainer: {
    backgroundColor: "#DDF5E5",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    width: "100%",
    marginTop: 10,
  },

  cameraText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2EB872",
  },

  manualButton: {
    borderWidth: 1,
    borderColor: "#2EB872",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
    alignItems: "center",
  },

  manualButtonText: {
    color: "#2EB872",
    fontWeight: "600",
  },

  loading: {
    color: "#2EB872",
    marginTop: 10,
    fontWeight: "600",
    textAlign: "center",
  },

  bottomButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
  },

  bottomButton: {
    backgroundColor: "#fff",
    borderRadius: 15,
    width: "48%",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },

  bottomText: {
    color: "#333",
    fontWeight: "600",
    fontSize: 13,
    marginTop: 5,
    textAlign: "center",
  },

  premiumBanner: {
    backgroundColor: "#F4A300",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 25,
  },

  premiumBannerPremium: {
    backgroundColor: "#2EB872",
  },

  premiumText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  modalSubtitle: {
    fontSize: 13,
    color: "#555",
    marginBottom: 10,
    marginTop: 3,
  },

  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginTop: 5,
  },

  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  premiumUserBadge: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#2EB872",
  borderRadius: 12,
  paddingHorizontal: 8,
  paddingVertical: 3,
  marginLeft: 8,
},

premiumUserBadgeText: {
  color: "#fff",
  fontSize: 12,
  fontWeight: "bold",
  marginLeft: 4,
},

  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  cancelBtn: {
    backgroundColor: "#f2f2f2",
    marginRight: 10,
  },

  confirmBtn: {
    backgroundColor: "#2EB872",
  },

  cancelTxt: { color: "#444" },

  confirmTxt: { color: "#fff", fontWeight: "600" },
});

