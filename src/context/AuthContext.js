import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

let GoogleSignin = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  GoogleSignin.configure({
    // Web client ID from Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration
    // Replace this value after enabling Google Sign-In in your Firebase project
    webClientId: '85598163329-smbpgikucvmi5lt43msocjkk20bmtp6d.apps.googleusercontent.com',
  });
} catch (_) {
  // Package not installed yet — Google Sign-In unavailable until APK rebuild
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          try {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
            setUserProfile(snap.exists() ? snap.data() : null);
          } catch (_) {}
        } else {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      });
    } catch (_) {
      setLoading(false);
    }
    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', result.user.uid));
    const profile = snap.exists() ? snap.data() : null;
    if (profile?.active === false) {
      await signOut(auth);
      const err = new Error('Your account is inactive. Contact the landlord to activate it.');
      err.code = 'auth/account-inactive';
      throw err;
    }
    setUserProfile(profile);
    return { user: result.user, profile };
  };

  const register = async (email, password, name, role, active = false) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const profile = {
      uid: result.user.uid,
      name,
      email,
      role,
      propertyId: null,
      active,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', result.user.uid), profile);
    setUserProfile(profile);
    return { user: result.user, profile };
  };

  const googleSignIn = async () => {
    if (!GoogleSignin) {
      throw new Error('Google Sign-In is not available. The app needs to be updated.');
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signIn();
    const { idToken } = await GoogleSignin.getTokens();
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    const snap = await getDoc(doc(db, 'users', result.user.uid));
    const profile = snap.exists() ? snap.data() : null;
    if (profile?.active === false) {
      // Don't sign out — AppNavigator will show PendingApproval based on userProfile
      setUserProfile(profile);
      return { user: result.user, profile };
    }
    setUserProfile(profile);
    return { user: result.user, profile };
  };

  const logout = async () => {
    try {
      if (GoogleSignin) await GoogleSignin.signOut().catch(() => {});
    } catch (_) {}
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, setUserProfile, loading, login, register, googleSignIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
