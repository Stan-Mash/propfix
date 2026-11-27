import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, radius, spacing, shadow } from '../../theme';

export default function AddPropertyScreen({ route, navigation }) {
  const { userProfile } = useAuth();
  const existing = route.params?.property || null;

  const [name, setName] = useState(existing?.name || '');
  const [address, setAddress] = useState(existing?.address || '');
  const [units, setUnits] = useState(existing?.units ? String(existing.units) : '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Property name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        address: address.trim() || null,
        units: units ? parseInt(units, 10) : null,
        landlordId: userProfile.uid,
      };
      if (existing) {
        await updateDoc(doc(db, 'properties', existing.id), { ...data, updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, 'properties'), { ...data, createdAt: new Date().toISOString() });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={existing ? 'Edit Property' : 'Add Property'}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Property Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={name}
              onChangeText={t => { setName(t); setErrors(p => ({ ...p, name: null })); }}
              placeholder="e.g. Sunrise Apartments"
              placeholderTextColor={colors.textMuted}
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. Tom Mboya Street, Nairobi"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Number of Units</Text>
            <TextInput
              style={styles.input}
              value={units}
              onChangeText={setUnits}
              placeholder="e.g. 24"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>{existing ? 'Save Changes' : 'Add Property'}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, backgroundColor: colors.surfaceAlt },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: 11, color: colors.danger, marginTop: 3 },
  saveBtn: { backgroundColor: colors.primaryMid, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', ...shadow.md },
  saveBtnDisabled: { backgroundColor: colors.primaryLight },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
