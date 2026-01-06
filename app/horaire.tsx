import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase/config";

type HistoryItem = {
  id: string; // recipeId (Date.now() string)
  title: string;
  ingredient: string;
  fullRecipe: string;
  generatedAt: string;
};

type DayScheduleDoc = {
  date: string; // YYYY-MM-DD
  recipeIds: string[];
  updatedAt?: any;
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function toYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function HoraireScreen() {
  const router = useRouter();

  const [isPremium, setIsPremium] = useState(false);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [scheduleByDate, setScheduleByDate] = useState<Record<string, string[]>>({});
  const [indexAssigned, setIndexAssigned] = useState<Set<string>>(new Set());

  // modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const days: { label: string; dateObj: Date; key: string }[] = [];
    const labels = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = toYYYYMMDD(d);
      days.push({ label: labels[i], dateObj: d, key });
    }
    return days;
  }, [weekStart]);

  const formattedWeekRange = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);

    const fmt = (d: Date) =>
      d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });

    return `${fmt(weekStart)} → ${fmt(end)}`;
  }, [weekStart]);

  // ✅ Premium gate + load all
  useEffect(() => {
    const init = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.replace("/auth/LoginScreen");
        return;
      }

      // premium check
      const subSnap = await getDoc(doc(db, "users", user.uid, "subscription", "status"));
      const premium = subSnap.exists() && subSnap.data().isPremium === true;
      setIsPremium(premium);

      if (!premium) {
        const msg = "⭐️ Cette fonctionnalité est réservée aux membres Premium.";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert("Premium", msg);
        router.back();
        return;
      }

      await reloadAll();
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const reloadAll = async () => {
    const user = auth.currentUser;
    if (!user) return;

    // 1) history
    const histSnap = await getDocs(collection(db, "users", user.uid, "history"));
    const hist: HistoryItem[] = histSnap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        title: data.title || "Recette",
        ingredient: data.ingredient || "",
        fullRecipe: data.fullRecipe || data.recipe || "",
        generatedAt: data.generatedAt || new Date().toISOString(),
      };
    });

    // 2) schedule for current week
    const byDate: Record<string, string[]> = {};
    for (const day of weekDays) {
      const dayRef = doc(db, "users", user.uid, "scheduleDays", day.key);
      const daySnap = await getDoc(dayRef);
      if (daySnap.exists()) {
        const data = daySnap.data() as DayScheduleDoc;
        byDate[day.key] = Array.isArray(data.recipeIds) ? data.recipeIds : [];
      } else {
        byDate[day.key] = [];
      }
    }

    // 3) index (anti-doublon)
    const idxSnap = await getDocs(collection(db, "users", user.uid, "scheduleIndex"));
    const assignedSet = new Set<string>();
    idxSnap.docs.forEach((d) => assignedSet.add(d.id)); // docId = recipeId

    setHistory(hist);
    setScheduleByDate(byDate);
    setIndexAssigned(assignedSet);
  };

  const openAddModal = (dateKey: string) => {
    setSelectedDate(dateKey);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedDate(null);
  };

  const availableRecipes = useMemo(() => {
    // recettes NON assignées à un autre jour
    return history.filter((r) => !indexAssigned.has(r.id));
  }, [history, indexAssigned]);

  const assignRecipeToDay = async (recipe: HistoryItem) => {
    const user = auth.currentUser;
    if (!user || !selectedDate) return;

    try {
      // ✅ Anti-doublon: check index
      const idxRef = doc(db, "users", user.uid, "scheduleIndex", recipe.id);
      const idxSnap = await getDoc(idxRef);
      if (idxSnap.exists()) {
        const msg =
          "⚠️ Cette recette est déjà assignée à un autre jour.\nTu dois en regénérer une nouvelle.";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert("Déjà assignée", msg);
        return;
      }

      // 1) update day doc
      const dayRef = doc(db, "users", user.uid, "scheduleDays", selectedDate);
      const daySnap = await getDoc(dayRef);

      let recipeIds: string[] = [];
      if (daySnap.exists()) {
        const data = daySnap.data() as any;
        recipeIds = Array.isArray(data.recipeIds) ? data.recipeIds : [];
      }

      // pas de doublon dans le même jour
      if (!recipeIds.includes(recipe.id)) recipeIds.push(recipe.id);

      await setDoc(
        dayRef,
        {
          date: selectedDate,
          recipeIds,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2) create index doc (recipeId -> date)
      await setDoc(
        idxRef,
        {
          date: selectedDate,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // local update
      setScheduleByDate((prev) => ({ ...prev, [selectedDate]: recipeIds }));
      setIndexAssigned((prev) => new Set([...Array.from(prev), recipe.id]));

      closeModal();
    } catch (e) {
      console.log(e);
      const msg = "Erreur lors de l'assignation de la recette.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Erreur", msg);
    }
  };

  const removeRecipeFromDay = async (dateKey: string, recipeId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const dayRef = doc(db, "users", user.uid, "scheduleDays", dateKey);
      const daySnap = await getDoc(dayRef);

      if (!daySnap.exists()) return;

      const data = daySnap.data() as any;
      const currentIds: string[] = Array.isArray(data.recipeIds) ? data.recipeIds : [];
      const updated = currentIds.filter((id) => id !== recipeId);

      await setDoc(dayRef, { recipeIds: updated, updatedAt: serverTimestamp() }, { merge: true });

      // supprimer index pour libérer la recette
      await deleteDoc(doc(db, "users", user.uid, "scheduleIndex", recipeId));

      setScheduleByDate((prev) => ({ ...prev, [dateKey]: updated }));
      setIndexAssigned((prev) => {
        const next = new Set(Array.from(prev));
        next.delete(recipeId);
        return next;
      });
    } catch (e) {
      console.log(e);
      const msg = "Erreur lors de la suppression.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Erreur", msg);
    }
  };

  const getTitleById = (id: string) => history.find((h) => h.id === id)?.title || "Recette";

  if (!isPremium) return <View style={{ flex: 1, backgroundColor: "#F4FBF6" }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#2EB872" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Horaire</Text>
          <Text style={styles.headerSub}>{formattedWeekRange}</Text>
        </View>

        <View style={styles.weekNav}>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() - 7);
              setWeekStart(d);
            }}
          >
            <Ionicons name="chevron-back" size={18} color="#2EB872" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => setWeekStart(startOfWeekMonday(new Date()))}
          >
            <Ionicons name="refresh" size={18} color="#2EB872" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + 7);
              setWeekStart(d);
            }}
          >
            <Ionicons name="chevron-forward" size={18} color="#2EB872" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Grille */}
      {weekDays.map((d) => {
        const dateLabel = d.dateObj.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        });

        const assigned = scheduleByDate[d.key] || [];

        return (
          <View key={d.key} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <View>
                <Text style={styles.dayTitle}>{d.label}</Text>
                <Text style={styles.dayDate}>{dateLabel} ({d.key})</Text>
              </View>

              <TouchableOpacity style={styles.addBtn} onPress={() => openAddModal(d.key)}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>

            {assigned.length === 0 ? (
              <Text style={styles.emptyDay}>Aucune recette assignée.</Text>
            ) : (
              assigned.map((rid) => (
                <View key={rid} style={styles.recipeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeTitle}>🍽️ {getTitleById(rid)}</Text>
                  </View>

                  <TouchableOpacity onPress={() => removeRecipeFromDay(d.key, rid)}>
                    <Ionicons name="close-circle" size={22} color="#D93025" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        );
      })}

      {/* MODAL ajout recette */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Ajouter une recette</Text>
            <Text style={styles.modalSub}>
              Choisis une recette non encore assignée à un autre jour.
            </Text>

            {availableRecipes.length === 0 ? (
              <Text style={styles.modalEmpty}>
                Aucune recette disponible 😕{"\n"}
                (Toutes tes recettes sont déjà assignées — régénère-en une !)
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 340 }}>
                {availableRecipes.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.modalItem}
                    onPress={() => assignRecipeToDay(r)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.modalItemTitle}>{r.title}</Text>
                    <Text style={styles.modalItemSub}>Ingrédient : {r.ingredient}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalClose} onPress={closeModal}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 50 : 70,
    paddingHorizontal: 18,
    backgroundColor: "#F4FBF6",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111" },
  headerSub: { fontSize: 12, color: "#666", marginTop: 2 },

  weekNav: { flexDirection: "row", alignItems: "center" },
  weekNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E6EAE7",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  dayCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6EAE7",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dayTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  dayDate: { fontSize: 12, color: "#666", marginTop: 2 },

  addBtn: {
    backgroundColor: "#2EB872",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "800", marginLeft: 6, fontSize: 12 },

  emptyDay: { color: "#777", fontStyle: "italic" },

  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F1",
  },
  recipeTitle: { fontSize: 14, fontWeight: "700", color: "#222" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalBox: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#111" },
  modalSub: { fontSize: 12, color: "#666", marginTop: 6, marginBottom: 12 },
  modalEmpty: { color: "#777", textAlign: "center", marginVertical: 16 },

  modalItem: {
    backgroundColor: "#F7FDF9",
    borderWidth: 1,
    borderColor: "#DDEFE4",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  modalItemTitle: { fontSize: 14, fontWeight: "800", color: "#111" },
  modalItemSub: { fontSize: 12, color: "#2EB872", marginTop: 4 },

  modalClose: {
    marginTop: 10,
    backgroundColor: "#f2f2f2",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseText: { fontWeight: "800", color: "#333" },
});
