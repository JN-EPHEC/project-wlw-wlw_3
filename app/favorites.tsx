import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

import {
    collection,
    doc,
    getDoc,
    getDocs
} from "firebase/firestore";
import { auth, db } from "./firebase/config";

interface FavoriteRecipe {
  id: string;
  title: string;
  ingredient: string;
  fullRecipe?: string;
  favorite?: boolean;
}

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // 🔍 Vérifier abonnement
      const subSnap = await getDoc(
        doc(db, "users", user.uid, "subscription", "status")
      );

      if (subSnap.exists() && subSnap.data().isPremium === true) {
        setIsPremium(true);
      } else {
        // ❌ Accès refusé si utilisateur FREE
        Alert.alert(
          "Accès réservé Premium",
          "Les favoris sont disponibles uniquement pour les membres Premium."
        );
        router.back();
        return;
      }

      // ⭐ Charger les recettes favorites
      const recipesRef = collection(db, "users", user.uid, "recipes");
      const snap = await getDocs(recipesRef);

      const favs: FavoriteRecipe[] = snap.docs
        .filter((d) => d.data().favorite === true)
        .map((d) => ({
          id: d.id,
          ...(d.data() as any)
        }));

      setFavorites(favs);
    };

    load();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Mes recettes favorites ⭐</Text>

      {favorites.length === 0 ? (
        <Text style={styles.emptyText}>
          Aucune recette en favoris pour l’instant.
        </Text>
      ) : null}

      {favorites.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.card}
          onPress={() =>
            router.push({
              pathname: "/full-recipe",
              params: {
                recipe: item.fullRecipe,
                title: item.title,
                id: item.id,
              },
            })
          }
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>

            {/* Petite étoile pleine */}
            <Ionicons name="star" size={22} color="#F5B000" />
          </View>

          <Text style={styles.cardIngredient}>
            Ingrédient : {item.ingredient}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 50 : 70,
    paddingHorizontal: 18,
    backgroundColor: "#F4FBF6",
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },

  emptyText: {
    textAlign: "center",
    color: "#777",
    marginTop: 15,
  },

  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#eee",
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    paddingRight: 10,
  },

  cardIngredient: {
    fontSize: 14,
    color: "#2EB872",
  },
});
