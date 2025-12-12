import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";

import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../firebase/config";

export default function ProfileScreen() {
  const router = useRouter();

  const user = auth.currentUser;
  const uid = user?.uid;

  // Champs utilisateur
  const [firstname, setFirstname] = useState("");

  // Date simple
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  // Taille & poids
  const [height, setHeight] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);

  // Objectif
  const [goal, setGoal] = useState("Perte de poids");

  // Allergies
  const mainAllergies = [
    "Gluten",
    "Lactose",
    "Fruits à coque",
    "Œufs",
    "Soja",
    "Arachides",
    "Poissons",
    "Crustacés",
    "Mollusques",
  ];

  const otherAllergies = [
    "Moutarde",
    "Sésame",
    "Céleri",
    "Sulfites",
    "Lupin",
    "Maïs",
    "Fèves",
    "Fruits exotiques",
    "Sarrasin",
    "Kiwi",
    "Fenouil",
    "Ail",
    "Banane",
    "Tomate",
    "Pistache",
    "Pollen",
  ];

  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [showMoreAllergies, setShowMoreAllergies] = useState(false);

  // Abonnement
  const [subscriptionPlan, setSubscriptionPlan] =
    useState<"free" | "premium">("free");

  const toggleAllergy = (a: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  // Chargement depuis TES collections Firestore
  const loadUserData = async () => {
    if (!uid) return;

    // Profil
    const profileRef = doc(db, "users", uid, "profile", "info");
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      const data = profileSnap.data();
      setFirstname(data.firstname || "");
      setGoal(data.goal || "Perte de poids");

      if (data.birthDate) {
        const [d, m, y] = data.birthDate.split("/");
        setBirthDay(d);
        setBirthMonth(m);
        setBirthYear(y);
      }
    }

    // Metrics
    const bodyRef = doc(db, "users", uid, "body", "metrics");
    const bodySnap = await getDoc(bodyRef);

    if (bodySnap.exists()) {
      const data = bodySnap.data();
      setHeight(data.height || null);
      setWeight(data.weight || null);
    }

    // Allergies
    const allergyRef = doc(db, "users", uid, "allergies", "list");
    const allergySnap = await getDoc(allergyRef);

    if (allergySnap.exists()) {
      setSelectedAllergies(allergySnap.data().values || []);
    }

    // Subscription
    const subRef = doc(db, "users", uid, "subscription", "status");
    const subSnap = await getDoc(subRef);

    if (subSnap.exists()) {
      const data = subSnap.data();
      setSubscriptionPlan(data.isPremium ? "premium" : "free");
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  // Sauvegarde dans TES collections
  const saveProfile = async () => {
    if (!uid) return;

    const birthDate =
      birthDay && birthMonth && birthYear
        ? `${birthDay}/${birthMonth}/${birthYear}`
        : null;

    // Profil
    await setDoc(
      doc(db, "users", uid, "profile", "info"),
      {
        firstname,
        birthDate,
        goal,
      },
      { merge: true }
    );

    // Metrics
    await setDoc(
      doc(db, "users", uid, "body", "metrics"),
      {
        height,
        weight,
      },
      { merge: true }
    );

    // Allergies
    await setDoc(
      doc(db, "users", uid, "allergies", "list"),
      {
        values: selectedAllergies,
      },
      { merge: true }
    );

    // Subscription
    await setDoc(
      doc(db, "users", uid, "subscription", "status"),
      {
        isPremium: subscriptionPlan === "premium",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    alert("Modifications enregistrées ✔");
    router.replace("/home");
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.replace("/auth/LoginScreen");
    } catch (error) {
      console.log("Erreur déconnexion :", error);
    }
  };

  const heightOptions = Array.from({ length: 111 }, (_, i) => 120 + i);
  const weightOptions = Array.from({ length: 291 }, (_, i) => 10 + i);

const deleteAccount = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const uid = user.uid;

    // Supprimer les sous-collections (profile, body, allergies, subscription, recipes, history)
    const collectionsToDelete = [
      "profile",
      "body",
      "allergies",
      "subscription",
      "recipes",
      "history",
    ];

    for (const col of collectionsToDelete) {
      const ref = collection(db, "users", uid, col);
      const snap = await getDocs(ref);

      for (const d of snap.docs) {
        await deleteDoc(doc(db, "users", uid, col, d.id));
      }
    }

    // Supprimer le dossier utilisateur
    await deleteDoc(doc(db, "users", uid));

    // Supprimer du système d'authentification
    await user.delete();

    alert("Votre compte a été entièrement supprimé.");
    router.replace("/auth/LoginScreen");

  } catch (err) {
    console.log("Erreur suppression compte :", err);
    alert("Erreur lors de la suppression du compte.");
  }
};

  return (
    <ScrollView style={styles.container}>
       <Pressable
       onPress={() => router.back()}
       style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}
       >
       <Ionicons name="arrow-back" size={24} color="#000" />
       <Text style={{ marginLeft: 6, fontSize: 16 }}>Retour</Text>
       </Pressable>

      <Text style={styles.title}>Mon Profil</Text>

      {/* Prénom */}
      <Text style={styles.label}>Prénom</Text>
      <TextInput
        style={styles.input}
        value={firstname}
        onChangeText={setFirstname}
        placeholder="Votre prénom"
      />

      {/* Date de naissance */}
      <Text style={styles.label}>Date de naissance</Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Picker
          style={[styles.picker, { flex: 1, marginRight: 5 }]}
          selectedValue={birthDay}
          onValueChange={setBirthDay}
        >
          <Picker.Item label="Jour" value="" />
          {[...Array(31)].map((_, i) => (
            <Picker.Item key={i} label={`${i + 1}`} value={`${i + 1}`} />
          ))}
        </Picker>

        <Picker
          style={[styles.picker, { flex: 1, marginHorizontal: 5 }]}
          selectedValue={birthMonth}
          onValueChange={setBirthMonth}
        >
          <Picker.Item label="Mois" value="" />
          {[
            "Janvier",
            "Février",
            "Mars",
            "Avril",
            "Mai",
            "Juin",
            "Juillet",
            "Août",
            "Septembre",
            "Octobre",
            "Novembre",
            "Décembre",
          ].map((m) => (
            <Picker.Item key={m} label={m} value={m} />
          ))}
        </Picker>

        <Picker
          style={[styles.picker, { flex: 1, marginLeft: 5 }]}
          selectedValue={birthYear}
          onValueChange={setBirthYear}
        >
          <Picker.Item label="Année" value="" />
          {[...Array(100)].map((_, i) => {
            const year = 2025 - i;
            return (
              <Picker.Item key={year} label={`${year}`} value={`${year}`} />
            );
          })}
        </Picker>
      </View>

      {/* Taille */}
      <Text style={styles.label}>Taille (cm)</Text>
      <Picker
        selectedValue={height}
        onValueChange={setHeight}
        style={styles.picker}
      >
        <Picker.Item label="Sélectionnez votre taille" value={null} />
        {heightOptions.map((h) => (
          <Picker.Item key={h} label={`${h} cm`} value={h} />
        ))}
      </Picker>

      {/* Poids */}
      <Text style={styles.label}>Poids (kg)</Text>
      <Picker
        selectedValue={weight}
        onValueChange={setWeight}
        style={styles.picker}
      >
        <Picker.Item label="Sélectionnez votre poids" value={null} />
        {weightOptions.map((w) => (
          <Picker.Item key={w} label={`${w} kg`} value={w} />
        ))}
      </Picker>

      {/* Objectif */}
      <Text style={styles.sectionTitle}>Objectif nutritionnel</Text>

      {["Perte de poids", "Gain musculaire", "Prise de masse", "Maintien"].map(
        (g) => (
          <TouchableOpacity
            key={g}
            style={[styles.goalOption, goal === g && styles.goalSelected]}
            onPress={() => setGoal(g)}
          >
            <Text style={goal === g ? styles.goalTextSelected : undefined}>
              {g}
            </Text>
          </TouchableOpacity>
        )
      )}

      {/* Allergies */}
      <Text style={styles.sectionTitle}>Allergies & intolérances</Text>

      <View style={styles.allergyContainer}>
        {mainAllergies.map((a) => (
          <TouchableOpacity
            key={a}
            style={[
              styles.tag,
              selectedAllergies.includes(a) && styles.tagSelected,
            ]}
            onPress={() => toggleAllergy(a)}
          >
            <Text
              style={
                selectedAllergies.includes(a)
                  ? styles.tagTextSelected
                  : styles.tagText
              }
            >
              {a}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.tagOther}
          onPress={() => setShowMoreAllergies(!showMoreAllergies)}
        >
          <Text style={styles.tagText}>+ Autre…</Text>
        </TouchableOpacity>

        {showMoreAllergies &&
          otherAllergies.map((a) => (
            <TouchableOpacity
              key={a}
              style={[
                styles.tag,
                selectedAllergies.includes(a) && styles.tagSelected,
              ]}
              onPress={() => toggleAllergy(a)}
            >
              <Text
                style={
                  selectedAllergies.includes(a)
                    ? styles.tagTextSelected
                    : styles.tagText
                }
              >
                {a}
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      {/* Abonnement */}
      <Text style={styles.sectionTitle}>Type d’abonnement</Text>

      {/* Free */}
      <TouchableOpacity
        style={[
          styles.subCard,
          subscriptionPlan === "free" && styles.subSelected,
        ]}
        onPress={() => setSubscriptionPlan("free")}
      >
        <Text style={styles.subTitle}>Modèle Gratuit — 0€</Text>
        <Text style={styles.subBullet}>• 2 recettes max par semaine</Text>
        <Text style={styles.subBullet}>• Objectifs adaptés</Text>
        <Text style={styles.subBullet}>• Historique des recettes (recette supprimée après 7 jours)</Text>
      </TouchableOpacity>

      {/* Premium */}
      <TouchableOpacity
        style={[
          styles.subCard,
          subscriptionPlan === "premium" && styles.subSelected,
        ]}
        onPress={() => {
          setSubscriptionPlan("premium");
          router.push("/premium-payment");
        }}
      >
        <Text style={styles.subTitle}>Premium — 4,99€/mois</Text>
        <Text style={styles.subBullet}>• Recettes illimitées</Text>
        <Text style={styles.subBullet}>• Objectifs adaptés</Text>
        <Text style={styles.subBullet}>• Historique des recettes</Text>
        <Text style={styles.subBullet}>• Favoris dans le cloud</Text>
        <Text style={styles.subBullet}>• IA nutritionnelle</Text>
      </TouchableOpacity>

      {/* Save */}
      <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
        <Text style={styles.saveText}>Sauvegarder</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>

      <TouchableOpacity
  onPress={deleteAccount}
  style={styles.deleteAccountBtn}
>
  <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
</TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#F7FDF9" },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 20 },
  label: { marginTop: 10, marginBottom: 5, fontWeight: "600" },

  input: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 10,
  },

  picker: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 25,
    marginBottom: 10,
  },

  goalOption: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    marginVertical: 5,
  },
  goalSelected: {
    borderColor: "#26A65B",
    backgroundColor: "#E9F9EF",
  },
  goalTextSelected: { color: "#26A65B", fontWeight: "bold" },

  allergyContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  tag: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  tagSelected: {
    backgroundColor: "#26A65B",
    borderColor: "#26A65B",
  },

  tagText: { color: "#333" },
  tagTextSelected: { color: "#fff" },

  tagOther: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#eee",
  },

  subCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
  },
  subSelected: {
    backgroundColor: "#E9F9EF",
    borderColor: "#26A65B",
  },
  subTitle: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 6,
  },
  subBullet: {
    fontSize: 14,
    color: "#444",
    marginBottom: 3,
  },

  deleteAccountBtn: {
  backgroundColor: "red",
  padding: 16,
  borderRadius: 10,
  alignItems: "center",
  marginBottom: 40,
},

deleteAccountText: {
  color: "#fff",
  fontWeight: "bold",
  fontSize: 16,
},

  saveButton: {
    backgroundColor: "#26A65B",
    padding: 16,
    borderRadius: 10,
    marginVertical: 20,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  logout: { alignItems: "center", marginBottom: 40 },
  logoutText: { color: "red", fontWeight: "bold" },
});
