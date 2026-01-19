import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../firebase/config";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");

    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/profile");
    } catch (err: any) {
      switch (err.code) {
        case "auth/invalid-email":
          setError("Adresse email invalide.");
          break;
        case "auth/user-not-found":
          setError("Aucun compte associé à cet email.");
          break;
        case "auth/wrong-password":
          setError("Mot de passe incorrect.");
          break;
        case "auth/too-many-requests":
          setError("Trop de tentatives. Réessayez plus tard.");
          break;
        default:
          setError("Erreur de connexion.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor={"#7A7A7A"}
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      {/* Input mot de passe + icône */}
      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Mot de passe"
          placeholderTextColor={"#7A7A7A"}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
        />

        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeIcon}
        >
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={22}
            color="#555"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/auth/ForgotPasswordScreen")}
        style={{ alignSelf: "flex-end", marginBottom: 8 }}
      >
        <Text style={styles.forgotPassword}>Mot de passe oublié ?</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Se connecter</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 20, alignItems: "center" }}>
        <Link href="/auth/RegisterScreen" style={styles.link}>
          Je n’ai pas encore de compte, m’inscrire
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 30, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 14,
    borderRadius: 10,
    marginBottom: 15,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
  },
  forgotPassword: { color: "#2e7df6", fontSize: 13 },
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  link: { color: "#2e7df6", fontSize: 14 },
  error: { color: "red", marginBottom: 10, textAlign: "center" },
});
