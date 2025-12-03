// app/index.tsx
import { Redirect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "./firebase/config";

export default function Index() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  // Petit écran vide pendant la détection (évite les bugs de navigation)
  if (initializing) return null;

  // Redirection automatique :
  // ✔ utilisateur connecté → home
  // ✘ utilisateur non connecté → register
  return <Redirect href={user ? "/home" : "/auth/RegisterScreen"} />;
}
