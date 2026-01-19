import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../firebase/config";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    if (!email) {
      Alert.alert("Erreur", "Veuillez entrer votre adresse email.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      setLoading(false);

      // 👉 On va vers l'écran de confirmation en passant l'email
      router.push({
        pathname: "/auth/PasswordResetSentScreen",
        params: { email: email.trim() },
      });
    } catch (error: any) {
      console.log("RESET ERROR:", error);
      setLoading(false);

      Alert.alert(
        "Erreur",
        "Impossible d’envoyer l’email. Vérifie l’adresse ou réessaie plus tard."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mot de passe oublié 🔑</Text>
      <Text style={styles.subtitle}>
        Entrez votre adresse email, nous vous enverrons un lien sécurisé pour
        créer un nouveau mot de passe.
      </Text>

      <Text style={styles.label}>Adresse email</Text>
      <TextInput
        placeholder="vous@example.com"
        placeholderTextColor="#7A7A7A"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2EB872" />
          <Text style={styles.loadingText}>Envoi du lien...</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleReset}>
          <Text style={styles.buttonText}>Envoyer le lien</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backText}>← Retour à la connexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F9FAFB",
    paddingTop: Platform.OS === "android" ? 60 : 80,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#222",
  },
  subtitle: {
    textAlign: "center",
    color: "#555",
    fontSize: 14,
    marginBottom: 25,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dcdcdc",
    borderRadius: 10,
    padding: 14,
    backgroundColor: "#fff",
    fontSize: 15,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#2EB872",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 15,
  },
  loadingText: {
    marginTop: 8,
    color: "#555",
    fontSize: 14,
  },
  backText: {
    color: "#2EB872",
    textAlign: "center",
    marginTop: 10,
    fontSize: 14,
  },
});
