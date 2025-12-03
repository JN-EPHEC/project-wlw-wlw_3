// app/firebase/config.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⚠️ Mets TES valeurs Firebase ici
const firebaseConfig = {
    apiKey: "AIzaSyCt7o1DcFI-znlyjs1mw7miCZbrs9gpfGw",
  authDomain: "saveeat-39824.firebaseapp.com",
  projectId: "saveeat-39824",
  storageBucket: "saveeat-39824.firebasestorage.app",
  messagingSenderId: "879184826639",
  appId: "1:879184826639:web:ce2eeda1d6be0927e32e7a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);