import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'propfix_offline_';

export async function saveDraft(key, data) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch (_) {}
}

export async function loadDraft(key) {
  try {
    const val = await AsyncStorage.getItem(PREFIX + key);
    return val ? JSON.parse(val) : null;
  } catch (_) { return null; }
}

export async function clearDraft(key) {
  try { await AsyncStorage.removeItem(PREFIX + key); } catch (_) {}
}

export async function saveMeterReadings(propertyId, month, year, readings) {
  await saveDraft(`meters_${propertyId}_${month}_${year}`, { readings });
}

export async function loadMeterReadings(propertyId, month, year) {
  const d = await loadDraft(`meters_${propertyId}_${month}_${year}`);
  return d?.readings || null;
}

export async function getPreviousReadings(propertyId, month, year) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const idx = months.indexOf(month);
  const prevMonth = idx > 0 ? months[idx - 1] : months[11];
  const prevYear = idx > 0 ? year : String(parseInt(year) - 1);
  const d = await loadDraft(`meters_${propertyId}_${prevMonth}_${prevYear}`);
  return d?.readings || null;
}

export async function saveTicketDraft(data) {
  const key = data.draftId || `ticket_${Date.now()}`;
  await saveDraft(key, { ...data, draftId: key });
  return key;
}

export async function loadTicketDraft(draftId) {
  return loadDraft(draftId);
}
