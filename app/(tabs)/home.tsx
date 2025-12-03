import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView, // ✔️ Le bon ScrollView
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";

// 🔥 IMPORT OPENAI
import OpenAI from "openai";

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [firstname, setFirstname] = useState("");

  // 🔥 NEW STATES for manual input
  const [manualModal, setManualModal] = useState(false);
  const [manualInput, setManualInput] = useState("");

  // 🔥 NEW — message “génération en cours…”
  const [isGenerating, setIsGenerating] = useState(false);

  // Charger prénom Firestore
  useEffect(() => {
    const loadName = async () => {
      if (!user) return;

      const ref = doc(db, "users", user.uid, "profile", "info");
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setFirstname(data.firstname || "Utilisateur");
      } else {
        setFirstname("Utilisateur");
      }
    };

    loadName();
  }, [user]);

  // 🔥🔥 GENERATE RECIPE WITH OPENAI FROM TEXT
  const generateRecipeFromText = async () => {

    // ✅ AJOUT : empêche toute double requête OpenAI
    if (isGenerating) return;

    if (!manualInput.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un aliment.");
      return;
    }

    setManualModal(false);

    // 🔥 Afficher message "génération en cours"
    setIsGenerating(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Erreur", "Utilisateur non connecté.");
        setIsGenerating(false);
        return;
      }

      // Charger les données utilisateur
      const profileSnap = await getDoc(doc(db, "users", user.uid, "profile", "info"));
      const bodySnap = await getDoc(doc(db, "users", user.uid, "body", "metrics"));
      const allergySnap = await getDoc(doc(db, "users", user.uid, "allergies", "list"));

      const firstname = profileSnap.exists() ? profileSnap.data().firstname : "Utilisateur";
      const goal = profileSnap.exists() ? profileSnap.data().goal : "Manger équilibré";
      const height = bodySnap.exists() ? bodySnap.data().height : "?";
      const weight = bodySnap.exists() ? bodySnap.data().weight : "?";
      const allergies = allergySnap.exists() ? allergySnap.data().values : [];

      const allergySentence =
        allergies.length > 0
          ? `Il est allergique à : ${allergies.join(", ")}. Ne jamais les inclure.`
          : "Aucune allergie.";

      const openai = new OpenAI({
        apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      // 🔥 GÉNÉRATION DE RECETTE
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
              Tu es un chef nutritionniste expert.
              Crée UNE recette simple et saine à partir d’un aliment donné.

              Profil :
              - Nom : ${firstname}
              - Objectif : ${goal}
              - Taille : ${height} cm
              - Poids : ${weight} kg
              - Allergies : ${allergySentence}

              Format structuré :
              ## Nom du plat
              ### Ingrédients
              - ...
              ### Préparation
              1. ...
              ### Pourquoi c’est adapté
              - ...
              ### Valeurs nutritionnelles
              - Protéines :
              - Glucides :
              - Lipides :
              - Calories :
            `,
          },
          {
            role: "user",
            content: `L’ingrédient principal est : ${manualInput}`,
          },
        ],
        max_tokens: 900,
      });

      const recipeText = response?.choices?.[0]?.message?.content?.trim();
      if (!recipeText) {
        Alert.alert("Erreur", "Impossible de générer une recette.");
        setIsGenerating(false);
        return;
      }

      // 🔁 Envoi vers recipe-result AVEC LA RECETTE
      router.push({
        pathname: "/recipe-result",
        params: { recipe: recipeText, ingredient: manualInput },
      });

    } catch (e) {
      console.log(e);
      Alert.alert("Erreur", "Impossible de générer la recette.");
    }

    // 🔥 retire le "génération en cours..."
    setIsGenerating(false);
  };

  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.helloText}>
            Hello, {firstname || "Utilisateur"} 👋
          </Text>
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

      {/* IA Button */}
      <Pressable style={styles.iaButton}>
        <Ionicons name="sparkles-outline" size={18} color="#fff" />
        <Text style={styles.iaText}>IA Nutritionnelle</Text>
      </Pressable>

      {/* SECTION CAMERA */}
      <View style={{ marginTop: 25, alignItems: "center" }}>
        <Text style={styles.sectionTitle}>Prenez une photo de votre aliment</Text>
        <Text style={styles.sectionSubtitle}>
          Notre IA vous proposera des recettes saines et personnalisées
        </Text>
      </View>

      {/* CAMERA BUTTON */}
      <Pressable
        onPress={() => router.push("/camera-screen")}
        style={({ pressed }) => [
          styles.cameraContainer,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
        ]}
      >
        <Ionicons
          name="camera-outline"
          size={64}
          color="#2EB872"
          style={{ marginBottom: 10 }}
        />
        <Text style={styles.cameraText}>Analyser l’image</Text>
      </Pressable>

      {/* MANUAL ENTRY BUTTON */}
      <Pressable
        style={styles.manualButton}
        onPress={() => setManualModal(true)}
      >
        <Text style={styles.manualButtonText}>Entrer un aliment manuellement</Text>
      </Pressable>

      {/* 🔥 MESSAGE "Génération en cours..." */}
      {isGenerating && (
        <Text
          style={{
            color: "#2EB872",
            marginTop: 10,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Génération de la recette en cours…
        </Text>
      )}

      {/* BOTTOM BUTTONS */}
      <View style={styles.bottomButtons}>
        <Pressable
          style={styles.bottomButton}
          onPress={() => router.push("/planning")}
        >
          <Ionicons name="calendar-outline" size={22} color="#2EB872" />
          <Text style={styles.bottomText}>Planning de mes Recettes</Text>
        </Pressable>

        <Pressable
          style={styles.bottomButton}
          onPress={() => router.push("/objectifs-adaptes")}
        >
          <Ionicons name="bar-chart-outline" size={22} color="#2EB872" />
          <Text style={styles.bottomText}>Objectifs adaptés</Text>
        </Pressable>
      </View>

      {/* PREMIUM */}
      <Pressable
        style={styles.premiumBanner}
        onPress={() => alert("Premium bientôt disponible 🥇")}
      >
        <Text style={styles.premiumText}>Passer à Save Eat premium</Text>
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
  cameraContainer: {
    backgroundColor: "#DDF5E5",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 30,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    overflow: "hidden",
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
