import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../theme';

const ROLES = [
  { label: 'Caretaker', value: 'caretaker', icon: 'handyman', desc: 'On-site maintenance & repairs' },
  { label: 'Property Manager', value: 'manager', icon: 'manage-accounts', desc: 'Oversees tenants & operations' },
];

// Shown when a user signs in via Google but has no Firestore profile yet
export default function CompleteProfileScreen() {
  const { user, setUserProfile, logout } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [role, setRole] = useState('caretaker');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    setLoading(true);
    try {
      const profile = {
        uid: user.uid,
        name: name.trim(),
        email: user.email,
        role,
        propertyId: null,
        active: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      setUserProfile(profile);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.iconWrap}>
          <MaterialIcons name="account-circle" size={48} color={colors.primaryMid} />
        </View>

        <Text style={styles.heading}>Complete Your Profile</Text>
        <Text style={styles.sub}>You signed in with Google. Tell us a bit about your role before we submit your request for approval.</Text>

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="person-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                autoCorrect={false}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Your Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleCard, role === r.value && styles.roleCardActive]}
                  onPress={() => setRole(r.value)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={r.icon} size={22} color={role === r.value ? colors.primaryMid : colors.textMuted} />
                  <Text style={[styles.roleName, role === r.value && { color: colors.primaryMid }]}>{r.label}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>{loading ? 'Submitting...' : 'Request Access'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={logout}>
          <Text style={styles.cancelText}>Cancel and sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.md, paddingTop: 60, alignItems: 'center' },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryXLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, textAlign: 'center', marginBottom: 24, paddingHorizontal: 8 },
  card: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 11 },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleCard: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 12, alignItems: 'center', backgroundColor: colors.surfaceAlt, gap: 4 },
  roleCardActive: { borderColor: colors.primaryMid, backgroundColor: colors.primaryXLight },
  roleName: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  roleDesc: { fontSize: 10, color: colors.textMuted, textAlign: 'center', lineHeight: 14 },
  btn: { backgroundColor: colors.primaryMid, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { paddingVertical: 10 },
  cancelText: { fontSize: 13, color: colors.textMuted },
});
