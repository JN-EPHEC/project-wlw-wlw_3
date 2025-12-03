import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../firebase/config";

export default function ObjectifAdaptesScreen() {
  const user = auth.currentUser;
  const uid = user?.uid;

  const [firstname, setFirstname] = useState("");
  const [height, setHeight] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [goal, setGoal] = useState("");
  const [bmi, setBmi] = useState<number | null>(null);
  const [bmiCategory, setBmiCategory] = useState("");

  // ✅ Charger données Firestore (nouvelle organisation)
  useEffect(() => {
    const loadData = async () => {
      if (!uid) return;

      // ---- Profil ----
      const profileRef = doc(db, "users", uid, "profile", "info");
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const p = profileSnap.data();
        setFirstname(p.firstname || "");
        setGoal(p.goal || "");
      }

      // ---- Metrics ----
      const bodyRef = doc(db, "users", uid, "body", "metrics");
      const bodySnap = await getDoc(bodyRef);

      if (bodySnap.exists()) {
        const b = bodySnap.data();
        setHeight(b.height || null);
        setWeight(b.weight || null);
      }
    };

    loadData();
  }, []);

  // ✅ Calcul IMC & catégorie
  useEffect(() => {
    if (height && weight) {
      const h = height / 100;
      const result = weight / (h * h);
      setBmi(result);

      if (result < 18.5) setBmiCategory("Insuffisance pondérale");
      else if (result < 25) setBmiCategory("Corpulence normale");
      else if (result < 30) setBmiCategory("Surpoids");
      else setBmiCategory("Obésité");
    }
  }, [height, weight]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🎯 Objectifs adaptés</Text>
      <Text style={styles.subtitle}>
        Voici un récapitulatif personnalisé basé sur votre profil.
      </Text>

      {/* Profil */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👤 Profil</Text>

        <View style={styles.row}>
          <Ionicons name="person-outline" size={22} color="#2EB872" />
          <Text style={styles.infoText}>Prénom : {firstname || "—"}</Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="resize-outline" size={22} color="#2EB872" />
          <Text style={styles.infoText}>
            Taille : {height ? height + " cm" : "—"}
          </Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="barbell-outline" size={22} color="#2EB872" />
          <Text style={styles.infoText}>
            Poids : {weight ? weight + " kg" : "—"}
          </Text>
        </View>
      </View>

      {/* IMC */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 IMC — Indice de Masse Corporelle</Text>

        <View style={styles.bmiValueBox}>
          <Text style={styles.bmiValue}>
            {bmi ? bmi.toFixed(1) : "—"}
          </Text>
        </View>

        <Text style={styles.bmiCategory}>
          {bmiCategory || "Calcul en attente…"}
        </Text>
      </View>

      {/* Objectif nutritionnel */}
      <View style={styles.cardLarge}>
        <Text style={styles.cardTitle}>🎯 Votre objectif nutritionnel</Text>
        <Text style={styles.goalText}>{goal || "Non renseigné"}</Text>

        <Text style={styles.recoSubtitle}>Recommandations personnalisées :</Text>

        {goal === "Perte de poids" && (
          <Text style={styles.recoText}>
            • Priorisez légumes & fibres{"\n"}
            • Diminuez le sucre & aliments transformés{"\n"}
            • Optez pour des portions maîtrisées{"\n"}
          </Text>
        )}

        {goal === "Gain musculaire" && (
          <Text style={styles.recoText}>
            • Augmentez protéines & entraînement{"\n"}
            • 3–4 séances musculation/semaine{"\n"}
            • Collations protéinées stratégiques{"\n"}
          </Text>
        )}

        {goal === "Prise de masse" && (
          <Text style={styles.recoText}>
            • Surplus calorique intelligent{"\n"}
            • Riz, pâtes complètes, huiles saines{"\n"}
            • Protéines à chaque repas{"\n"}
          </Text>
        )}

        {goal === "Maintien" && (
          <Text style={styles.recoText}>
            • Continuez votre équilibre actuel{"\n"}
            • Activité physique régulière{"\n"}
            • Contrôle des portions{"\n"}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#F9FBF9",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#222",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },

  /* Cards */
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  cardLarge: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#222",
  },

  /* Profil */
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  infoText: {
    fontSize: 15,
    color: "#333",
    marginLeft: 8,
  },

  /* BMI */
  bmiValueBox: {
    backgroundColor: "#E5F7ED",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    marginVertical: 10,
  },
  bmiValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#2EB872",
  },
  bmiCategory: {
    textAlign: "center",
    fontSize: 15,
    color: "#444",
    fontStyle: "italic",
  },

  /* Goal */
  goalText: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#2EB872",
  },

  recoSubtitle: {
    fontWeight: "600",
    fontSize: 15,
    marginBottom: 8,
    color: "#333",
  },

  recoText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
  },
});
