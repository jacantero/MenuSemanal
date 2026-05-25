// firebaseConfig.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration

// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: "AIzaSyDAIp4gOo13xVBbTbNZGUdFVzivO8NqTVM",
  authDomain: "menusemanal-2d6b3.firebaseapp.com",
  projectId: "menusemanal-2d6b3",
  storageBucket: "menusemanal-2d6b3.firebasestorage.app",
  messagingSenderId: "754030937381",
  appId: "1:754030937381:web:2a53b5f22ef4a0b5f006cc",
  measurementId: "G-WDYQ0J5XB5"
};

// --- EL TRUCO ANTI-ERROR DE EXPO ---
// Si getApps() está vacío (0), inicializamos la app. 
// Si ya hay una app corriendo, simplemente la recuperamos con getApp().
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Exportamos la Base de Datos y la Autenticación
export const db = getFirestore(app);
export const auth = getAuth(app);

// Iniciar sesión silenciosa
signInAnonymously(auth)
  .then(() => {
    console.log("🔥 Firebase conectado sin errores.");
  })
  .catch((error) => {
    console.error("Error conectando a Firebase Auth:", error);
  });