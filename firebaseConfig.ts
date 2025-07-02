import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBopatFR_NrNFtBm8y87tBcgnjxZjLdKTU",
  authDomain: "myskillapp-backend.firebaseapp.com", 
  projectId: "myskillapp-backend",
  storageBucket: "myskillapp-backend.firebasestorage.app",
  messagingSenderId: "381766293095",
  appId: "1:381766293095:web:7e4f5532ee77dbae36a6c2", 
  measurementId: "G-JR0Q8Y7R5K"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
