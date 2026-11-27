import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBp3uFnbiAkwvTNMhPBH_lVHjx75hMvS3A",
  authDomain: "propfix-b29f1.firebaseapp.com",
  projectId: "propfix-b29f1",
  storageBucket: "propfix-b29f1.firebasestorage.app",
  messagingSenderId: "85598163329",
  appId: "1:85598163329:web:a1141bd30478a63c771880",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export default app;
