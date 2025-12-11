import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// 🔥 IMPORT FIREBASE
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase/config";

export default function RecipeResultScreen() {
  const { recipe, ingredient: ingredientParam } = useLocalSearchParams<{
    recipe?: string;
    ingredient?: string;
  }>();

  // 🔥 Recette déjà complète → pas d'appel OpenAI
  const decodedRecipe =
    Array.isArray(recipe) ? recipe[0] : recipe || "Aucune recette générée.";

  const [finalRecipe, setFinalRecipe] = useState(decodedRecipe);
  const [ingredient, setIngredient] = useState(ingredientParam || "Saumon");

  const [modalVisible, setModalVisible] = useState(false);
  const [duration, setDuration] = useState("");

  useEffect(() => {
    setFinalRecipe(decodedRecipe);

    const firstLine = decodedRecipe.split("\n")[0] || "";
    const extracted = firstLine.replace("##", "").trim();
    if (extracted.length > 0) setIngredient(extracted);
  }, [decodedRecipe]);

  const handleConfirm = async () => {
    if (!duration) {
      Alert.alert("Durée manquante", "Veuillez sélectionner une durée avant de confirmer.");
      return;
    }

    const today = new Date();
    const expiry = new Date();

    switch (duration) {
      case "Demain":
        expiry.setDate(today.getDate() + 1);
        break;
      case "Dans 2 jours":
        expiry.setDate(today.getDate() + 2);
        break;
      case "Dans 3 jours":
        expiry.setDate(today.getDate() + 3);
        break;
      case "Dans 1 semaine":
        expiry.setDate(today.getDate() + 7);
        break;
      case "Dans 2 semaines":
        expiry.setDate(today.getDate() + 14);
        break;
    }

    const newRecipe = {
      id: Date.now(),
      title: finalRecipe.split("\n")[0] || "Recette sans titre",
      ingredient,
      expiryDate: expiry.toISOString(),
      addedAt: today.toISOString(),
    };

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Erreur", "Vous devez être connecté.");
        return;
      }

      // 🔥 1) Sauvegarde dans RECIPES
      await setDoc(
        doc(db, "users", user.uid, "recipes", newRecipe.id.toString()),
        {
          ...newRecipe,
          createdAt: serverTimestamp(),
        }
      );

      // 🔥🔥 2) ➕ AJOUT pour HISTORY (NOUVEAU, demandé)
      await setDoc(
        doc(db, "users", user.uid, "history", newRecipe.id.toString()),
        {
          recipeId: newRecipe.id,
          title: newRecipe.title,
          ingredient: newRecipe.ingredient,
          fullRecipe: finalRecipe,
          generatedAt: today.toISOString(),
          createdAt: serverTimestamp(),
        }
      );

      // stockage local
      const stored = await AsyncStorage.getItem("recipes");
      const parsed = stored ? JSON.parse(stored) : [];
      parsed.push(newRecipe);
      await AsyncStorage.setItem("recipes", JSON.stringify(parsed));

      setModalVisible(false);
      Alert.alert("Succès 🎉", "Recette ajoutée à votre planning !");
      router.push("/planning");

    } catch (err) {
      console.error(err);
      Alert.alert("Erreur", "Impossible d’ajouter la recette au planning.");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>Recette générée 🍽️</Text>

      <View style={styles.recipeBox}>
        <Text style={styles.recipeText}>{finalRecipe}</Text>
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>Ajouter à mon planning</Text>
      </TouchableOpacity>

      {/* MODAL */}
      <Modal animationType="slide" transparent visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Date de péremption</Text>
            <Text style={styles.modalSubtitle}>
              Indiquez la date de péremption de l’ingrédient principal pour calculer la date limite de préparation.
            </Text>

            <Text style={styles.label}>Ingrédient principal</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#f5f5f5" }]}
              value={ingredient}
              onChangeText={setIngredient}
            />

            <Text style={styles.label}>Date de péremption</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={duration}
                onValueChange={(v) => setDuration(v)}
                style={styles.picker}
              >
                <Picker.Item label="Sélectionnez une durée..." value="" />
                <Picker.Item label="Demain" value="Demain" />
                <Picker.Item label="Dans 2 jours" value="Dans 2 jours" />
                <Picker.Item label="Dans 3 jours" value="Dans 3 jours" />
                <Picker.Item label="Dans 1 semaine" value="Dans 1 semaine" />
                <Picker.Item label="Dans 2 semaines" value="Dans 2 semaines" />
              </Picker>
            </View>

            <View style={styles.tipBox}>
              <Text style={styles.tipText}>
                💡 Cette date déterminera quand vous devez préparer cette recette pour éviter le gaspillage.
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelBtn]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmBtn]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 20,
    paddingTop: Platform.OS === "android" ? 50 : 80,
  },

  contentContainer: {
    paddingBottom: 150,
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#222",
    textAlign: "center",
    marginBottom: 20,
  },
  recipeBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 3,
  },
  recipeText: {
    fontSize: 15,
    color: "#333",
  },
  addButton: {
    backgroundColor: "#2EB872",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  addButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 15,
    width: "90%",
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#555",
    marginBottom: 15,
  },

  label: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
  },
  picker: { width: "100%" },

  tipBox: {
    backgroundColor: "#fff9e6",
    borderRadius: 8,
    padding: 10,
    marginTop: 15,
  },
  tipText: { color: "#b58900", fontSize: 13 },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#f2f2f2",
    marginRight: 10,
  },
  confirmBtn: { backgroundColor: "#2EB872" },
  cancelText: { color: "#333", fontWeight: "600" },
  confirmText: { color: "#fff", fontWeight: "600" },
});
