import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebase/config";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");

    if (!email || !password || !confirmPassword) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const uid = userCred.user.uid;

      // ✅ Crée le document principal sans subscription
await setDoc(doc(db, "users", userCred.user.uid), {
  email,
  createdAt: new Date().toISOString(),
});

// ✅ Ajoute la sous-collection subscription
await setDoc(
  doc(db, "users", userCred.user.uid, "subscription", "status"),
  {
    isPremium: false,
    recipesThisWeek: 0,
    lastReset: new Date().toISOString(),
  }
);


      router.replace("/profile");
    } catch (err: any) {
      console.log("REGISTER ERROR:", err.code);

      switch (err.code) {
        case "auth/email-already-in-use":
          setError("Cette adresse email est déjà utilisée.");
          break;
        case "auth/invalid-email":
          setError("Adresse email invalide.");
          break;
        case "auth/weak-password":
          setError("Mot de passe trop faible (min. 6 caractères).");
          break;
        default:
          setError("Impossible de créer le compte.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un compte</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor={"#7A7A7A"}
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
      />

      {/* Mot de passe */}
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

      {/* Confirmer mot de passe */}
      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Confirmer le mot de passe"
          placeholderTextColor={"#7A7A7A"}
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
        />

        <TouchableOpacity
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          style={styles.eyeIcon}
        >
          <Ionicons
            name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
            size={22}
            color="#555"
          />
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>S’inscrire</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/auth/LoginScreen")}>
        <Text style={styles.link}>Déjà un compte ? Se connecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: "center" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
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
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  link: {
    marginTop: 20,
    textAlign: "center",
    color: "#2e7df6",
  },
  error: { color: "red", marginBottom: 10, textAlign: "center" },
});
