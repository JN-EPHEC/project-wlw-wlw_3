import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function PasswordResetSentScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="mail-open-outline" size={48} color="#2EB872" />
      </View>

      <Text style={styles.title}>Email envoyé 🎉</Text>

      <Text style={styles.subtitle}>
        Si un compte existe avec{" "}
        <Text style={{ fontWeight: "600" }}>{email || "votre adresse"}</Text>,  
        vous recevrez un email avec un lien pour réinitialiser votre mot de passe.
      </Text>

      <Text style={styles.tip}>
        Pensez à vérifier vos spams ou courriers indésirables si vous ne voyez rien
        dans votre boîte de réception.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace("/auth/LoginScreen")}
      >
        <Text style={styles.buttonText}>Revenir à la connexion</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.secondaryText}>Changer d’adresse email</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F9FAFB",
    paddingTop: Platform.OS === "android" ? 60 : 80,
    alignItems: "center",
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#E5F8EF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
    color: "#222",
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 15,
  },
  tip: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#2EB872",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryText: {
    color: "#2EB872",
    fontSize: 14,
  },
});
