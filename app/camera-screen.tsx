import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import OpenAI from "openai";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ✅ Firebase
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase/config";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.text}>📸 Nous avons besoin d'accéder à votre caméra</Text>
        <TouchableOpacity style={styles.allowBtn} onPress={requestPermission}>
          <Text style={styles.btnText}>Autoriser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ OpenAI Config
  const openai = new OpenAI({
    apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      setStatus("📸 Capture en cours...");
      const photo = await cameraRef.current.takePictureAsync({ base64: true });
      setPhotoUri(photo.uri);
      setLoading(true);

      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Erreur", "Utilisateur non connecté");
        setLoading(false);
        return;
      }

      /** ✅ RÉCUPÉRATION FIRESTORE ORGANISÉE **/
      const profileSnap = await getDoc(doc(db, "users", user.uid, "profile", "info"));
      const bodySnap = await getDoc(doc(db, "users", user.uid, "body", "metrics"));
      const allergySnap = await getDoc(doc(db, "users", user.uid, "allergies", "list"));
      const subSnap = await getDoc(doc(db, "users", user.uid, "subscription", "status"));

      const firstname = profileSnap.exists() ? profileSnap.data().firstname : "Utilisateur";
      const goal = profileSnap.exists() ? profileSnap.data().goal : "Manger équilibré";

      const height = bodySnap.exists() ? bodySnap.data().height : null;
      const weight = bodySnap.exists() ? bodySnap.data().weight : null;

      const allergies = allergySnap.exists() ? allergySnap.data().values : [];

      // ✅ Vérification abonnement
      const sub = subSnap.exists() ? subSnap.data() : { isPremium: false, recipesThisWeek: 0 };

      // Limite si pas premium
      if (!sub.isPremium) {
        if (sub.recipesThisWeek >= 3) {
          Alert.alert(
            "Limite atteinte",
            "Tu as utilisé toutes tes recettes gratuites de la semaine.\nPasse Premium pour générer sans limite ✅"
          );
          setLoading(false);
          return;
        }

        // Incrément sécurisé
        await setDoc(
          doc(db, "users", user.uid, "subscription", "status"),
          {
            recipesThisWeek: sub.recipesThisWeek + 1,
          },
          { merge: true }
        );
      }

      const allergySentence =
        allergies.length > 0
          ? `Il est allergique à : ${allergies.join(", ")}. Ne jamais les inclure.`
          : "Aucune allergie connue.";

      const base64Image = `data:image/jpeg;base64,${photo.base64}`;

      setStatus("🧠 Analyse alimentaire en cours...");

      // ✅ OpenAI request
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Tu es un chef nutritionniste expert.
            Crée UNE recette personnalisée adaptée à ce profil :

            👤 Profil :
            - Prénom : ${firstname}
            - Objectif : ${goal}
            - Taille : ${height ?? "?"} cm
            - Poids : ${weight ?? "?"} kg
            - Allergies : ${allergySentence}

            ⚠️ Interdiction d'inclure un allergène.
            ✅ Simple, faisable, quantités précises, saine.
            `,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyse cette image et crée la recette." },
              { type: "image_url", image_url: { url: base64Image } },
            ],
          },
        ],
        max_tokens: 950,
        temperature: 0.7,
      });

      const recipeText = response?.choices?.[0]?.message?.content?.trim();

      if (!recipeText) {
        Alert.alert("Erreur", "Impossible de générer une recette.");
        setLoading(false);
        return;
      }

      // 🔥 EXTRACTION DE L’INGRÉDIENT PRINCIPAL
      const detectedIngredient =
        recipeText.match(/^##\s*(.*)$/m)?.[1]?.trim() || "Ingrédient";

      setLoading(false);

      // 🔥 ENVOI AVEC INGREDIENT AUTO
      router.push({
        pathname: "/recipe-result",
        params: {
          recipe: recipeText,
          ingredient: detectedIngredient, // << 🔥 ajouté
          recipeSource: "camera",
        },
      });
    } catch (error: any) {
      console.error("❌ Erreur OpenAI:", error);
      Alert.alert("Erreur", error.message || "Impossible d’analyser la photo.");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.preview} />
      ) : (
        <CameraView ref={cameraRef} style={styles.camera} />
      )}

      {status ? (
        <View style={styles.statusBox}>
          <Text style={{ color: "white", textAlign: "center" }}>{status}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Analyse en cours...</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
          <Ionicons name="camera" size={32} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ✅ STYLES INTACTS */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  text: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
    marginBottom: 10,
  },
  allowBtn: {
    backgroundColor: "#2EB872",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
  },
  camera: {
    width: "100%",
    height: "85%",
    borderRadius: 20,
    overflow: "hidden",
  },
  preview: {
    width: "100%",
    height: "85%",
    borderRadius: 20,
  },
  captureBtn: {
    backgroundColor: "#2EB872",
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 40,
  },
  loadingOverlay: {
    position: "absolute",
    bottom: 40,
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 15,
    fontWeight: "600",
  },
  statusBox: {
    position: "absolute",
    top: 60,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 10,
    width: "90%",
  },
});
