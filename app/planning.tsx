import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// 🔥 FIREBASE
import { collection, deleteDoc, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase/config";

interface Recipe {
  id: number;
  title: string;
  ingredient: string;
  expiryDate: string;
}

export default function PlanningScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const router = useRouter();

  // ⬇️ Récupération Firestore + fallback AsyncStorage
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const ref = collection(db, "users", user.uid, "recipes");
        const snapshot = await getDocs(ref);

        const firebaseRecipes: Recipe[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as Recipe),
          id: Number(docSnap.id),
        }));

        setRecipes(firebaseRecipes);

        // ⬇️ backup local
        await AsyncStorage.setItem("recipes", JSON.stringify(firebaseRecipes));
      } catch (err) {
        console.log("Erreur Firestore → fallback AsyncStorage");
        const stored = await AsyncStorage.getItem("recipes");
        if (stored) setRecipes(JSON.parse(stored));
      }
    };

    fetchRecipes();
  }, []);

  // ⬇️ Supprimer une recette
  const deleteRecipe = async (id: number) => {
    try {
      const user = auth.currentUser;
      if (user) {
        await deleteDoc(doc(db, "users", user.uid, "recipes", id.toString()));
      }

      const updated = recipes.filter((r) => r.id !== id);
      setRecipes(updated);
      await AsyncStorage.setItem("recipes", JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  // ⬇️ Marquer comme faite = supprimer
  const markAsDone = async (id: number) => {
    await deleteRecipe(id);
    Alert.alert("✅ Recette marquée comme effectuée !");
  };

  const getDaysLeft = (expiryDate: string) => {
    const diff = new Date(expiryDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getColor = (daysLeft: number) => {
    if (daysLeft <= 3) return "#FDE8E8"; // rouge clair
    if (daysLeft <= 7) return "#FFF4E5"; // orange clair
    return "#E6F4EA"; // vert clair
  };

  const getTextColor = (daysLeft: number) => {
    if (daysLeft <= 3) return "#D93025";
    if (daysLeft <= 7) return "#C47F00";
    return "#188038";
  };

  const urgentCount = recipes.filter(
    (r) => getDaysLeft(r.expiryDate) <= 3
  ).length;

  // 🔥 NOUVEAU → voir la recette complète depuis l’historique
  const openFullRecipe = async (id: number) => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid, "history", id.toString());
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      Alert.alert("Recette introuvable", "Cette recette n'existe pas dans votre historique.");
      return;
    }

    const data = snap.data();

    router.push({
      pathname: "/full-recipe",
      params: {
        title: data.title,
        recipe: data.fullRecipe,
      },
    });
  };

  const renderRecipe = ({ item }: { item: Recipe }) => {
    const daysLeft = getDaysLeft(item.expiryDate);
    const bgColor = getColor(daysLeft);
    const color = getTextColor(daysLeft);
    const formattedDate = new Date(item.expiryDate).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <View style={[styles.card, { backgroundColor: bgColor, borderColor: color }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.recipeTitle}>{item.title}</Text>
          <TouchableOpacity onPress={() => deleteRecipe(item.id)}>
            <Ionicons name="trash-outline" size={22} color={color} />
          </TouchableOpacity>
        </View>

        <Text style={styles.ingredientText}>
          Ingrédient principal :{" "}
          <Text style={{ fontWeight: "bold", color }}>{item.ingredient}</Text>
        </Text>

        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={16} color={color} />
          <Text style={[styles.expiryText, { color }]}>
            {"  "}À préparer avant le {formattedDate}
          </Text>
        </View>

        <Text style={[styles.daysLeft, { color }]}>
          {daysLeft > 0 ? `${daysLeft}j restants` : "⚠️ Expirée !"}
        </Text>

        {/* 🔥 BOUTON VOIR RECETTE COMPLÈTE */}
        <TouchableOpacity
          style={[styles.viewButton, { borderColor: color }]}
          onPress={() => openFullRecipe(item.id)}
        >
          <Ionicons name="restaurant-outline" size={18} color={color} />
          <Text style={[styles.viewText, { color }]}>Voir la recette complète</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: color }]}
          onPress={() => markAsDone(item.id)}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={styles.doneText}>Marquer comme effectuée</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {urgentCount > 0 && (
        <View style={styles.alertBox}>
          <Ionicons name="warning-outline" size={18} color="#D93025" />
          <Text style={styles.alertText}>
            {"  "}
            {urgentCount} recette{urgentCount > 1 ? "s" : ""} expire dans les 48h.
            Préparez-les rapidement pour éviter le gaspillage !
          </Text>
        </View>
      )}

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRecipe}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Aucune recette dans votre planning pour le moment 🍽️
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {/* Statistiques */}
      <View style={styles.statsBox}>
        <Text style={styles.statsTitle}>Statistiques anti-gaspillage</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{urgentCount}</Text>
            <Text style={styles.statLabel}>Urgentes</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: "#C47F00" }]}>0</Text>
            <Text style={styles.statLabel}>Cette semaine</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: "#188038" }]}>
              {recipes.length}
            </Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3FBF6",
    paddingTop: Platform.OS === "android" ? 50 : 70,
    paddingHorizontal: 15,
  },
  alertBox: {
    flexDirection: "row",
    backgroundColor: "#FFF4F2",
    borderColor: "#F6BDBD",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: "center",
  },
  alertText: {
    color: "#D93025",
    fontSize: 13,
    flex: 1,
    flexWrap: "wrap",
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  recipeTitle: {
    fontWeight: "bold",
    fontSize: 16,
    flex: 1,
    flexWrap: "wrap",
  },
  ingredientText: { fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  expiryText: { fontSize: 13 },
  daysLeft: {
    fontWeight: "bold",
    marginBottom: 10,
  },

  /* 🔥 NOUVEAU BOUTON Voir recette */
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 8,
    justifyContent: "center",
    marginBottom: 10,
  },
  viewText: {
    marginLeft: 6,
    fontWeight: "600",
  },

  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 10,
  },
  doneText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    marginTop: 40,
  },
  statsBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  statsTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: { alignItems: "center" },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#D93025",
  },
  statLabel: {
    color: "#444",
    fontSize: 12,
  },
});
