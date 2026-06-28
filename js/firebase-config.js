// Configuration Firebase pour Moldio Universe
const firebaseConfig = {
    apiKey: "AIzaSyARB9eRwKXmq7Ieo4eYHsZmLErvK-8BdJM",
    authDomain: "moldio-universe.firebaseapp.com",
    projectId: "moldio-universe",
    storageBucket: "moldio-universe.firebasestorage.app",
    messagingSenderId: "849814157884",
    appId: "1:849814157884:web:bc9a7833eda577fe74e139"
};

// Initialisation de Firebase via CDN (Type Module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where, doc, getDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth, collection, getDocs, addDoc, serverTimestamp, query, where, doc, getDoc, deleteDoc, setDoc, ref, uploadBytes, getDownloadURL, signInWithEmailAndPassword, onAuthStateChanged, signOut };
