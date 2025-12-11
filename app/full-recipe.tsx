import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function FullRecipeScreen() {
  const router = useRouter();
  const { recipe, title } = useLocalSearchParams<{
    recipe?: string;
    title?: string;
  }>();

  const finalRecipe =
    Array.isArray(recipe) ? recipe[0] : recipe || "Recette introuvable.";
  const recipeTitle =
    Array.isArray(title) ? title[0] : title || "Recette";

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#2EB872" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Recette complète</Text>

        <View style={{ width: 30 }} />
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
  
headerTitle: {
  fontSize: 24,
  fontWeight: "bold",
  textAlign: "center",
  marginBottom: 20,
  color: "#2EB872",
},

  recipeText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333",
    flexWrap: "wrap",
  },

  button: {
    backgroundColor: "#2EB872",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
