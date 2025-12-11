import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "./firebase/config";

/* -----------------------------------
   Interface d’une entrée de l’historique
------------------------------------ */
interface HistoryItem {
  id: string;
  title: string;
  ingredient: string;
  fullRecipe: string;
  generatedAt: string; // date ISO
}

/* -----------------------------------
         COMPONENT
------------------------------------ */
export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const router = useRouter();

  /* -----------------------------------
       CHARGEMENT + NETTOYAGE AUTO
  ------------------------------------ */
  useEffect(() => {
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const historyRef = collection(db, "users", user.uid, "history");
        const snap = await getDocs(historyRef);

        const items: HistoryItem[] = snap.docs.map((d) => {
          const data = d.data() as Omit<HistoryItem, "id">;
          return {
            id: d.id,
            ...data,
          };
        });

        // Vérifier abonnement
        const subSnap = await getDocs(
          collection(db, "users", user.uid, "subscription")
        );

        const isPremium = subSnap.docs.some(
          (docSnap) => docSnap.data().isPremium === true
        );

        // Si premium → pas de nettoyage
        if (isPremium) {
          setHistory(items);
          return;
        }

        // Nettoyage automatique (Free → 7 jours max)
        const now = Date.now();

        const filtered = [];

        for (const item of items) {
          const createdTime = new Date(item.generatedAt).getTime();
          const diffDays = (now - createdTime) / (1000 * 60 * 60 * 24);

          if (diffDays <= 7) {
            filtered.push(item);
          } else {
            // Supprimer côté Firestore
            await deleteDoc(
              doc(db, "users", user.uid, "history", item.id)
            );
          }
        }

        setHistory(filtered);

        // Backup local
        await AsyncStorage.setItem("history", JSON.stringify(filtered));
      } catch (err) {
        console.log("Erreur Firestore → fallback AsyncStorage");

        const stored = await AsyncStorage.getItem("history");
        if (stored) setHistory(JSON.parse(stored));
      }
    };

    load();
  }, []);

  /* -----------------------------------
      BARRE DE RECHERCHE + FILTRE
  ------------------------------------ */
  const filteredHistory = history.filter(
    (h) =>
      h.title.toLowerCase().includes(search.toLowerCase()) ||
      h.ingredient.toLowerCase().includes(search.toLowerCase())
  );

  /* -----------------------------------
          AFFICHAGE
  ------------------------------------ */
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Historique des recettes 🕒</Text>

      {/* --- Barre de recherche --- */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#777" />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une recette..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {filteredHistory.length === 0 ? (
        <Text style={styles.emptyText}>Aucun résultat trouvé.</Text>
      ) : null}

      {/* --- LISTE DES RECETTES --- */}
      {filteredHistory.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.card}
          onPress={() =>
            router.push({
              pathname: "/full-recipe",
              params: {
                recipe: item.fullRecipe,
                title: item.title,
              },
            })
          }
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>
          </View>

          <Text style={styles.cardIngredient}>
            Ingrédient : {item.ingredient}
          </Text>

          <Text style={styles.cardDate}>
            Générée le :{" "}
            {new Date(item.generatedAt).toLocaleDateString("fr-FR")}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

/* -----------------------------------
              STYLES
------------------------------------ */
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
    marginBottom: 15,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#eaeaea",
    marginBottom: 20,
  },

  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },

  emptyText: {
    color: "#777",
    textAlign: "center",
    marginTop: 15,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#eaeaea",
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },

  cardIngredient: {
    color: "#2EB872",
    marginBottom: 5,
  },

  cardDate: {
    color: "#888",
    fontSize: 12,
  },
});
