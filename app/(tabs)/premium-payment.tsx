import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebase/config";

export default function PremiumPaymentScreen() {
  const router = useRouter();

  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const handleCardNumberChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    if (clean.length <= 16) setCardNumber(clean);
  };

  const handleCvcChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "");
    if (clean.length <= 3) setCvc(clean);
  };

  const handlePay = async () => {
    console.log("🔥 Bouton Payé cliqué !");

    if (!cardNumber || !cardName || !expiry || !cvc) {
      Alert.alert("Champs manquants", "Merci de remplir tous les champs.");
      return;
    }

    console.log("🔥 Mise à jour Premium…");

    try {
      await setDoc(
        doc(db, "users", auth.currentUser!.uid, "subscription", "status"),
        {
          isPremium: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log("✅ Firestore mis à jour !");
    } catch (e) {
      console.log("❌ Firestore error :", e);
    }

    // 🚨 FIX : Alert fonctionne sur mobile mais PAS sur web
    if (Platform.OS === "web") {
      window.alert(
        "Paiement effectué 🎉\nTon abonnement Premium est maintenant actif."
      );
      console.log("➡️ Redirection vers /profile");
      router.replace("/profile");
      return;
    }

    Alert.alert("Paiement effectué 🎉", "Ton abonnement Premium est maintenant actif.", [
      {
        text: "OK",
        onPress: () => {
          console.log("➡️ Redirection vers /profile");
          router.replace("/profile");
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#2EB872" />
        </TouchableOpacity>
        <Text style={styles.title}>Passer à Premium</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <Ionicons name="star" size={20} color="#2EB872" />
          <Text style={styles.planTitle}>Premium — 4,99€/mois</Text>
        </View>
        <Text style={styles.planText}>• Recettes illimitées</Text>
        <Text style={styles.planText}>• Objectifs adaptés</Text>
        <Text style={styles.planText}>• Historique des recettes</Text>
        <Text style={styles.planText}>• Favoris dans le cloud</Text>
        <Text style={styles.planText}>• IA avancée</Text>
      </View>

      <Text style={styles.subtitle}>Simulation de paiement</Text>
      <Text style={styles.infoText}>Aucun vrai paiement n'est effectué.</Text>

      <Text style={styles.label}>Numéro de carte</Text>
      <TextInput
        style={styles.input}
        placeholder="1111 1111 1111 1111"
        keyboardType="number-pad"
        value={cardNumber}
        onChangeText={handleCardNumberChange}
      />

      <Text style={styles.label}>Nom sur la carte</Text>
      <TextInput
        style={styles.input}
        placeholder="Nom Prénom"
        value={cardName}
        onChangeText={setCardName}
      />

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>Expiration</Text>
          <TextInput
            style={styles.input}
            placeholder="MM/AA"
            value={expiry}
            onChangeText={setExpiry}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.label}>CVC</Text>
          <TextInput
            style={styles.input}
            placeholder="123"
            keyboardType="number-pad"
            value={cvc}
            onChangeText={handleCvcChange}
            secureTextEntry
          />
        </View>
      </View>

      <TouchableOpacity style={styles.payButton} onPress={handlePay}>
        <Text style={styles.payText}>Payer 4,99€ / mois</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FDF9",
    paddingTop: Platform.OS === "android" ? 50 : 70,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "bold" },
  planCard: {
    backgroundColor: "#E9F9EF",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2EB872",
    marginBottom: 20,
  },
  planHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  planTitle: { marginLeft: 6, fontWeight: "bold" },
  planText: { fontSize: 14, marginVertical: 1 },
  subtitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  infoText: { fontSize: 12, color: "#555", marginBottom: 16 },
  label: { marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 12,
  },
  row: { flexDirection: "row", marginBottom: 12 },
  payButton: {
    backgroundColor: "#2EB872",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  payText: { color: "#fff", fontWeight: "bold" },
});
