// Importe as funções do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  runTransaction 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// SUAS CONFIGURAÇÕES DO FIREBASE (Atualizadas)
const firebaseConfig = {
  apiKey: "AIzaSyANeVNdAYJRizus-T4AKSGuPTDQNGjq874",
  authDomain: "barbearia-pro-d757f.firebaseapp.com",
  projectId: "barbearia-pro-d757f",
  storageBucket: "barbearia-pro-d757f.firebasestorage.app",
  messagingSenderId: "737943809720",
  appId: "1:737943809720:web:8b544038910932c1b68e4d"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Exporta as variáveis e funções para serem usadas nos outros arquivos (client.js, AdminScripts.js, functions.js)
export { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  runTransaction 
};
