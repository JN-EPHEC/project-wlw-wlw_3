import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "./firebase/config";

type Parsed = {
  estimatedMinutes: number;
  ingredients: string[];
  steps: string[];
};

function parseRecipeText(text: string): Parsed {
  const clean = (text || "").replace(/\r/g, "");

  // 1) Temps estimé (on tente de lire un "Temps" dans le texte)
  // Ex: "Temps : 25 min" / "Temps de préparation: 20 minutes"
  let estimatedMinutes = 20;
  const timeMatch = clean.match(
    /(temps(?:\s+de\s+(?:préparation|cuisson))?\s*[:\-]?\s*)(\d{1,3})\s*(min|minutes)/i
  );
  if (timeMatch?.[2]) {
    const n = parseInt(timeMatch[2], 10);
    if (!Number.isNaN(n) && n > 0 && n < 240) estimatedMinutes = n;
  }

  // 2) Extraction sections "Ingrédients" et "Préparation/Étapes"
  const lower = clean.toLowerCase();

  const idxIng = lower.search(/ingr[ée]dients?/);
  const idxPrep = lower.search(/(préparation|preparation|étapes|etapes|instructions)/);

  let ingBlock = "";
  let prepBlock = "";

  if (idxIng !== -1 && idxPrep !== -1) {
    if (idxIng < idxPrep) {
      ingBlock = clean.slice(idxIng, idxPrep);
      prepBlock = clean.slice(idxPrep);
    } else {
      // au cas où
      prepBlock = clean.slice(idxPrep, idxIng);
      ingBlock = clean.slice(idxIng);
    }
  } else if (idxIng !== -1) {
    ingBlock = clean.slice(idxIng);
  } else if (idxPrep !== -1) {
    prepBlock = clean.slice(idxPrep);
  }

  const splitLines = (block: string) =>
    block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  const normalizeBullet = (l: string) => l.replace(/^[-•\d\)\.\s]+/, "").trim();

  // Ingredients
  let ingredients = splitLines(ingBlock)
    .filter((l) => !/ingr[ée]dients?/i.test(l))
    .map(normalizeBullet)
    .filter((l) => l.length >= 2);

  // Steps
  let steps = splitLines(prepBlock)
    .filter((l) => !/(préparation|preparation|étapes|etapes|instructions)/i.test(l))
    .map((l) => l.trim())
    .filter(Boolean);

  // Si pas trouvé proprement, fallback : essayer de détecter listes
  if (ingredients.length === 0) {
    ingredients = clean
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[-•]/.test(l))
      .map(normalizeBullet)
      .slice(0, 12);
  }

  if (steps.length === 0) {
    steps = clean
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\d+[\)\.]/.test(l) || /^(étape|step)\s*\d+/i.test(l))
      .map((l) => l.replace(/^(étape|step)\s*\d+\s*[:\-]?\s*/i, "").trim());
  }

  // Dernier fallback minimal
  if (ingredients.length === 0) ingredients = ["(Ingrédients non détectés automatiquement)"];
  if (steps.length === 0) steps = ["(Étapes non détectées automatiquement)"];

  return { estimatedMinutes, ingredients, steps };
}

export default function CookModeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; title?: string; recipe?: string }>();

  const recipeId = Array.isArray(params.id) ? params.id[0] : params.id || null;
  const title = Array.isArray(params.title) ? params.title[0] : params.title || "Mode cuisine";
  const recipeText = Array.isArray(params.recipe) ? params.recipe[0] : params.recipe || "";

  const [isPremium, setIsPremium] = useState(false);

  // Timer
  const parsed = useMemo(() => parseRecipeText(recipeText), [recipeText]);
  const [secondsLeft, setSecondsLeft] = useState(parsed.estimatedMinutes * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<any>(null);

  // Checklists
  const [ingDone, setIngDone] = useState<boolean[]>(() =>
    new Array(parsed.ingredients.length).fill(false)
  );
  const [stepDone, setStepDone] = useState<boolean[]>(() =>
    new Array(parsed.steps.length).fill(false)
  );

  // 🔥 vérifier premium
  useEffect(() => {
    const check = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const subSnap = await getDoc(doc(db, "users", user.uid, "subscription", "status"));
      const premium = subSnap.exists() && subSnap.data().isPremium === true;
      setIsPremium(premium);

      if (!premium) {
        Alert.alert("Premium", "Le mode cuisine est réservé aux membres Premium.");
        router.back();
      }
    };
    check();
  }, [router]);

  // maintenir tailles checklist si parsing change
  useEffect(() => {
    setIngDone(new Array(parsed.ingredients.length).fill(false));
    setStepDone(new Array(parsed.steps.length).fill(false));
    setSecondsLeft(parsed.estimatedMinutes * 60);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [parsed.ingredients.length, parsed.steps.length, parsed.estimatedMinutes]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [running]);

  const mmss = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const toggleIng = (i: number) =>
    setIngDone((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const toggleStep = (i: number) =>
    setStepDone((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const resetTimer = () => {
    setRunning(false);
    setSecondsLeft(parsed.estimatedMinutes * 60);
  };

  if (!isPremium) return <View style={{ flex: 1, backgroundColor: "#F9FAFB" }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#2EB872" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Passer en cuisine</Text>

        <View style={{ width: 30 }} />
      </View>

      <Text style={styles.title}>{title}</Text>

      {/* Timer bubble */}
      <View style={styles.timerCard}>
        <View style={styles.timerLeft}>
          <Ionicons name="time-outline" size={18} color="#2EB872" />
          <Text style={styles.timerLabel}>Temps estimé</Text>
        </View>

        <View style={styles.timerRight}>
          <Text style={styles.timerValue}>{mmss(secondsLeft)}</Text>

          <View style={styles.timerBtns}>
            <TouchableOpacity
              style={[styles.timerBtn, running && styles.timerBtnGhost]}
              onPress={() => setRunning((r) => !r)}
            >
              <Ionicons
                name={running ? "pause" : "play"}
                size={16}
                color={running ? "#2EB872" : "#fff"}
              />
              <Text style={[styles.timerBtnText, running && styles.timerBtnTextGhost]}>
                {running ? "Pause" : "Start"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.timerBtn, styles.timerBtnGhost]} onPress={resetTimer}>
              <Ionicons name="refresh" size={16} color="#2EB872" />
              <Text style={[styles.timerBtnText, styles.timerBtnTextGhost]}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Ingrédients */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧺 Ingrédients</Text>

        {parsed.ingredients.map((ing, idx) => (
          <TouchableOpacity
            key={`${idx}-${ing}`}
            style={styles.checkRow}
            onPress={() => toggleIng(idx)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={ingDone[idx] ? "checkbox" : "square-outline"}
              size={22}
              color={ingDone[idx] ? "#2EB872" : "#999"}
            />
            <Text style={[styles.checkText, ingDone[idx] && styles.checkTextDone]}>
              {ing}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Étapes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👨‍🍳 Préparation</Text>

        {parsed.steps.map((st, idx) => (
          <TouchableOpacity
            key={`${idx}-${st}`}
            style={styles.checkRow}
            onPress={() => toggleStep(idx)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={stepDone[idx] ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={stepDone[idx] ? "#2EB872" : "#999"}
            />
            <Text style={[styles.checkText, stepDone[idx] && styles.checkTextDone]}>
              <Text style={{ fontWeight: "700" }}>{idx + 1}. </Text>
              {st}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Petit rappel */}
      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          💡 Astuce : coche au fur et à mesure pour suivre ta recette sans te perdre.
        </Text>
      </View>

      {/* ✅ NOUVEAU : bouton fin de repas */}
      <TouchableOpacity
        style={styles.mealReadyButton}
        onPress={() => router.replace("/home")}
        activeOpacity={0.9}
      >
        <Ionicons name="restaurant" size={20} color="#fff" />
        <Text style={styles.mealReadyText}>Mon repas est prêt 🍽️</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 50 : 70,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2EB872",
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 14,
  },

  timerCard: {
    backgroundColor: "#E5F7ED",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  timerLeft: { flexDirection: "row", alignItems: "center" },
  timerLabel: { marginLeft: 8, fontWeight: "700", color: "#1f2d28" },

  timerRight: { alignItems: "flex-end" },
  timerValue: { fontSize: 18, fontWeight: "800", color: "#2EB872" },

  timerBtns: { flexDirection: "row", marginTop: 10 },
  timerBtn: {
    backgroundColor: "#2EB872",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  timerBtnGhost: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#2EB872",
  },
  timerBtnText: { color: "#fff", fontWeight: "700", marginLeft: 6, fontSize: 12 },
  timerBtnTextGhost: { color: "#2EB872" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12, color: "#111" },

  checkRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  checkText: { marginLeft: 10, fontSize: 14, color: "#333", flex: 1, lineHeight: 20 },
  checkTextDone: { textDecorationLine: "line-through", color: "#7a7a7a" },

  tipBox: {
    backgroundColor: "#fff9e6",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  tipText: { color: "#b58900", fontSize: 13, lineHeight: 18 },

  /* ✅ NOUVEAU */
  mealReadyButton: {
    backgroundColor: "#2EB872",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 6,
    marginBottom: 30,
  },
  mealReadyText: {
    color: "#fff",
    fontWeight: "800",
    marginLeft: 10,
    fontSize: 15,
  },
});
