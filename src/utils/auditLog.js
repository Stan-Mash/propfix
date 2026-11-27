import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'propfix_audit_log';

export async function logAudit({ userId, role, action, entityId, data = {} }) {
  try {
    const existing = await AsyncStorage.getItem(KEY);
    const log = existing ? JSON.parse(existing) : [];
    log.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: userId || 'unknown',
      role: role || 'unknown',
      action,
      entityId,
      data,
    });
    if (log.length > 500) log.splice(0, log.length - 500);
    await AsyncStorage.setItem(KEY, JSON.stringify(log));
  } catch (_) {}
}

export async function getAuditLog(entityId) {
  try {
    const existing = await AsyncStorage.getItem(KEY);
    const log = existing ? JSON.parse(existing) : [];
    return entityId ? log.filter(e => e.entityId === entityId) : log;
  } catch (_) { return []; }
}
