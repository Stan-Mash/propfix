import * as Notifications from 'expo-notifications';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(uid) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await updateDoc(doc(db, 'users', uid), { expoPushToken: token });
    return token;
  } catch (e) {
    // Notifications may not be available in Expo Go without dev build
    console.warn('Push notification setup failed:', e.message);
  }
}

async function getUserToken(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data().expoPushToken : null;
  } catch {
    return null;
  }
}

async function sendPush(token, title, body, data = {}) {
  if (!token || !token.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
    });
  } catch (e) {
    console.warn('Push send failed:', e.message);
  }
}

export async function notifyUserById(uid, title, body, data = {}) {
  const token = await getUserToken(uid);
  await sendPush(token, title, body, data);
}
