// Mesmo projeto Firebase da Central Executiva (central-executiva-jab) — esta
// config web é pública por natureza (protegida pelas regras do Firestore, não
// pelo sigilo dela). App separado de propósito, só pra não ficar no mesmo
// escopo de Service Worker/manifest do app principal (ver CLAUDE.md da
// Central Executiva, seção "Atalho de voz").
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAjP8W_kRJC_BjKvjJRMamF5DdHi6EZYL8",
  authDomain: "central-executiva-jab.firebaseapp.com",
  projectId: "central-executiva-jab",
  storageBucket: "central-executiva-jab.firebasestorage.app",
  messagingSenderId: "607175404528",
  appId: "1:607175404528:web:69153efebeddb7a61b4b35"
};
