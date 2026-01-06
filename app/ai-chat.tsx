import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import OpenAI from "openai";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase/config";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number; // ms (pour l'affichage)
};

export default function AiChatScreen() {
  const router = useRouter();

  const [isPremium, setIsPremium] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  const listRef = useRef<FlatList>(null);

  const openai = useMemo(() => {
    return new OpenAI({
      apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });
  }, []);

  // ✅ Vérif premium + listener Firestore messages (realtime)
  useEffect(() => {
    const init = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.replace("/auth/LoginScreen");
        return;
      }

      // Vérifier abonnement Premium
      const subSnap = await getDoc(
        doc(db, "users", user.uid, "subscription", "status")
      );
      const premium = subSnap.exists() && subSnap.data().isPremium === true;
      setIsPremium(premium);

      if (!premium) {
        router.back();
        return;
      }

      // 🔥 Listener messages en temps réel
      const msgsRef = collection(db, "users", user.uid, "aiChat");

      const q = query(msgsRef, orderBy("createdAt", "asc"));

      const unsub = onSnapshot(q, (snap) => {
        const loaded: ChatMsg[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const createdAtMs =
            data.createdAt?.toDate?.()?.getTime?.() ?? Date.now();

          return {
            id: d.id,
            role: data.role,
            content: data.content,
            createdAt: createdAtMs,
          };
        });

        // ✅ Message de bienvenue si conversation vide
        if (loaded.length === 0) {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "Salut 👋 Je suis le Save Eat Bot 🤖🥗\nDis-moi ce que tu as chez toi, ton objectif, et je t’aide !",
              createdAt: Date.now(),
            },
          ]);
          return;
        }

        setMessages(loaded);
      });

      return () => unsub();
    };

    const cleanupPromise = init();
    return () => {
      // rien: onSnapshot est déjà clean via unsub ci-dessus
      void cleanupPromise;
    };
  }, [router]);

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const sendMessage = async () => {
    const user = auth.currentUser;
    if (!user || !isPremium) return;

    const trimmed = input.trim();
    if (!trimmed || loadingSend) return;

    setInput("");
    setLoadingSend(true);

    try {
      const msgsRef = collection(db, "users", user.uid, "aiChat");

      // 1) Sauvegarder le message USER dans Firestore
      await addDoc(msgsRef, {
        role: "user",
        content: trimmed,
        createdAt: serverTimestamp(),
      });

      // 2) Charger contexte (profil + allergies + objectif)
      const profileSnap = await getDoc(
        doc(db, "users", user.uid, "profile", "info")
      );
      const allergySnap = await getDoc(
        doc(db, "users", user.uid, "allergies", "list")
      );

      const firstname = profileSnap.exists()
        ? profileSnap.data().firstname
        : "Utilisateur";
      const goal = profileSnap.exists()
        ? profileSnap.data().goal
        : "Manger équilibré";
      const allergies = allergySnap.exists()
        ? allergySnap.data().values || []
        : [];

      const allergySentence =
        allergies.length > 0
          ? `Allergies à éviter strictement : ${allergies.join(", ")}.`
          : "Aucune allergie connue.";

      // 3) Construire historique pour OpenAI (on prend les 20 derniers messages)
      const last = [...messages]
        .filter((m) => m.id !== "welcome")
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const apiMessages: any[] = [
        {
          role: "system",
          content: `
Tu es le Save Eat Bot 🤖🥗 : un coach nutrition + anti-gaspillage.
Réponds en français, de façon claire, simple et utile.

Contexte utilisateur :
- Prénom : ${firstname}
- Objectif : ${goal}
- ${allergySentence}

Règles :
- Donne des réponses concrètes et actionnables.
- Si l'utilisateur demande une recette : structure-la proprement (Temps, Ingrédients, Étapes).
- Évite le blabla inutile.
          `.trim(),
        },
        ...last,
        { role: "user", content: trimmed },
      ];

      // 4) Appel OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: apiMessages,
        max_tokens: 700,
        temperature: 0.7,
      });

      const botText =
        response?.choices?.[0]?.message?.content?.trim() ||
        "Désolé, je n’ai pas pu répondre. Réessaie 🙏";

      // 5) Sauvegarder la réponse BOT dans Firestore
      await addDoc(msgsRef, {
        role: "assistant",
        content: botText,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      // En cas d'erreur, on enregistre aussi le message d'erreur en conversation
      try {
        const user2 = auth.currentUser;
        if (user2) {
          const msgsRef = collection(db, "users", user.uid, "aiChat");
          await addDoc(msgsRef, {
            role: "assistant",
            content: "Oups 😕 Erreur de connexion à l’IA. Réessaie dans un instant.",
            createdAt: serverTimestamp(),
          });
        }
      } catch {
        // ignore
      }
    }

    setLoadingSend(false);
  };

  const renderItem = ({ item }: { item: ChatMsg }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.bubbleRow,
          isUser ? styles.bubbleRowRight : styles.bubbleRowLeft,
        ]}
      >
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.bubbleText, isUser ? styles.userText : styles.botText]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  if (!isPremium) {
    return <View style={{ flex: 1, backgroundColor: "#F3FBF6" }} />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#2EB872" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>IA Nutritionnelle</Text>
          <Text style={styles.headerSub}>Save Eat Bot 🤖🥗</Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Écris ton message…"
            value={input}
            onChangeText={setInput}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (loadingSend || !input.trim()) && styles.sendBtnDisabled,
            ]}
            onPress={sendMessage}
            disabled={loadingSend || !input.trim()}
          >
            {loadingSend ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3FBF6",
    paddingTop: Platform.OS === "android" ? 50 : 70,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
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
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  headerSub: { fontSize: 12, color: "#666", marginTop: 2 },

  listContent: { paddingHorizontal: 14, paddingBottom: 10 },

  bubbleRow: { marginVertical: 6, flexDirection: "row" },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubbleRowRight: { justifyContent: "flex-end" },

  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  botBubble: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E6EAE7" },
  userBubble: { backgroundColor: "#2EB872" },

  bubbleText: { fontSize: 14, lineHeight: 20 },
  botText: { color: "#222" },
  userText: { color: "#fff", fontWeight: "600" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F3FBF6",
    borderTopWidth: 1,
    borderTopColor: "#E6EAE7",
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E6EAE7",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 120,
  },
  sendBtn: {
    marginLeft: 10,
    backgroundColor: "#2EB872",
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
});
