import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "./firebase/config";

export default function FullRecipeScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    recipe?: string;
    title?: string;
    id?: string; // 🔥 id recette (docId dans /recipes)
  }>();

  const recipeId = Array.isArray(params.id) ? params.id[0] : params.id || null;

  const finalRecipe = Array.isArray(params.recipe)
    ? params.recipe[0]
    : params.recipe || "Recette introuvable.";

  const recipeTitle = Array.isArray(params.title)
    ? params.title[0]
    : params.title || "Recette";

  const [favorite, setFavorite] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(false);

  /** 🔥 Charger Premium + favori */
  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Premium ?
      const subSnap = await getDoc(
        doc(db, "users", user.uid, "subscription", "status")
      );
      if (subSnap.exists()) {
        setIsPremium(subSnap.data().isPremium === true);
      }

      // Favori ?
      if (recipeId) {
        const recipeSnap = await getDoc(
          doc(db, "users", user.uid, "recipes", recipeId)
        );
        if (recipeSnap.exists()) {
          setFavorite(recipeSnap.data().favorite === true);
        }
      }
    };

    loadData();
  }, [recipeId]);

  /** ⭐ Toggle Favori (Premium only) */
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

  /** 👨‍🍳 Passer en cuisine (Premium only) */
  const goCookMode = () => {
    if (!isPremium) return;

    if (!recipeId) {
      Alert.alert(
        "Info",
        "Impossible d’ouvrir le mode cuisine : id de recette manquant."
      );
      return;
    }

    router.push({
      pathname: "/cook-mode",
      params: {
        id: recipeId,
        title: recipeTitle,
        recipe: finalRecipe,
      },
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#2EB872" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Recette complète</Text>

        {/* ⭐ Favori — seulement Premium */}
        {isPremium ? (
          <TouchableOpacity onPress={toggleFavorite}>
            <Ionicons
              name={favorite ? "star" : "star-outline"}
              size={28}
              color={favorite ? "#F5B000" : "#2EB872"}
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

      {/* ✅ Bouton "Passer en cuisine" — Premium only */}
      {isPremium && (
        <TouchableOpacity style={styles.cookBtn} onPress={goCookMode}>
          <Ionicons name="restaurant-outline" size={18} color="#fff" />
          <Text style={styles.cookBtnText}>Passer en cuisine 👨‍🍳</Text>
        </TouchableOpacity>
      )}
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
    fontSize: 18,
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

  cookBtn: {
    marginTop: 16,
    backgroundColor: "#2EB872",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  cookBtnText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 15,
  },
});
