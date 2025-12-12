import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "./firebase/config";

export default function FullRecipeScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    recipe?: string;
    title?: string;
    id?: string; // 🔥 ID indispensable pour gérer le favori
  }>();

  const recipeId = Array.isArray(params.id) ? params.id[0] : params.id || null;

  const finalRecipe =
    Array.isArray(params.recipe) ? params.recipe[0] : params.recipe || "Recette introuvable.";

  const recipeTitle =
    Array.isArray(params.title) ? params.title[0] : params.title || "Recette";

  const [favorite, setFavorite] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(false);

  /* --------------------------------------------------------
     🔥 Charger état Premium + Favori dans Firestore
  -------------------------------------------------------- */
  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user || !recipeId) return;

      // Vérifier statut Premium
      const subSnap = await getDoc(doc(db, "users", user.uid, "subscription", "status"));
      if (subSnap.exists()) {
        setIsPremium(subSnap.data().isPremium === true);
      }

      // Charger le statut favori
      const recipeSnap = await getDoc(doc(db, "users", user.uid, "recipes", recipeId));
      if (recipeSnap.exists()) {
        setFavorite(recipeSnap.data().favorite === true);
      }
    };

    loadData();
  }, [recipeId]);

  /* --------------------------------------------------------
     ⭐ Toggle Favori (Premium uniquement)
  -------------------------------------------------------- */
  const toggleFavorite = async () => {
    const user = auth.currentUser;
    if (!user || !recipeId) return;

    await setDoc(
      doc(db, "users", user.uid, "recipes", recipeId),
      { favorite: !favorite },
      { merge: true }
    );

    setFavorite(!favorite);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#2EB872" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Recette complète</Text>

        {/* ⭐ Icône Favori (Seulement Premium) */}
        {isPremium ? (
          <TouchableOpacity onPress={toggleFavorite}>
            <Ionicons
              name={favorite ? "star" : "star-outline"}
              size={28}
              color={favorite ? "#e6b800" : "#2EB872"}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 30 }} />
        )}
      </View>

      {/* Titre */}
      <Text style={styles.title}>{recipeTitle}</Text>

      {/* Bloc recette */}
      <View style={styles.recipeBox}>
        <Text style={styles.recipeText}>{finalRecipe}</Text>
      </View>
    </ScrollView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 20,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2EB872",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 10,
  },

  recipeBox: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    elevation: 3,
  },

  recipeText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333",
    flexWrap: "wrap",
  },
});
