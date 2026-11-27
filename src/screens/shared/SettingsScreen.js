import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, radius, spacing, shadow } from '../../theme';

export default function SettingsScreen({ navigation }) {
  const { settings, updateSettings } = useAppSettings();
  const { logout } = useAuth();
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [budget, setBudget] = useState(String(settings.monthlyBudget));
  const [unitCost, setUnitCost] = useState(String(settings.unitCostDefault));

  const handleSave = () => {
    const b = parseFloat(budget) || 0;
    const uc = parseFloat(unitCost) || 0;
    if (!companyName.trim()) { Alert.alert('Required', 'Company name cannot be empty.'); return; }
    if (b <= 0) { Alert.alert('Required', 'Monthly budget must be greater than zero.'); return; }
    if (uc <= 0) { Alert.alert('Required', 'Unit cost must be greater than zero.'); return; }
    updateSettings({ companyName: companyName.trim(), monthlyBudget: b, unitCostDefault: uc });
    Alert.alert('Saved', 'Settings updated successfully.', [{ text: 'Done', onPress: () => navigation.goBack() }]);
  };

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Settings"
        subtitle="Company and billing defaults"
        rightAction={
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

        <Text style={s.secLabel}>Company</Text>
        <View style={s.card}>
          <Text style={s.label}>Company / Agency Name</Text>
          <TextInput style={s.input} value={companyName} onChangeText={setCompanyName} placeholder="e.g. Sunrise Properties Ltd" placeholderTextColor={colors.textMuted} />
          <Text style={s.hint}>This name appears on bills, quotations, and tenant messages.</Text>
        </View>

        <Text style={s.secLabel}>Financial</Text>
        <View style={s.card}>
          <Text style={s.label}>Monthly Repair Budget (KES)</Text>
          <TextInput style={s.input} value={budget} onChangeText={setBudget} keyboardType="numeric" placeholder="120000" placeholderTextColor={colors.textMuted} />
          <Text style={s.hint}>Used to track approved spend on the landlord dashboard.</Text>

          <Text style={[s.label, { marginTop: 16 }]}>Default Water Unit Cost (KES)</Text>
          <TextInput style={s.input} value={unitCost} onChangeText={setUnitCost} keyboardType="decimal-pad" placeholder="65" placeholderTextColor={colors.textMuted} />
          <Text style={s.hint}>Price per unit of water. Can be overridden per bill.</Text>
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <MaterialIcons name="check-circle" size={20} color="#fff" />
          <Text style={s.saveTxt}>Save Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.signOutBtn}
          onPress={() => Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: logout },
          ])}
          activeOpacity={0.85}
        >
          <MaterialIcons name="logout" size={18} color={colors.danger} />
          <Text style={s.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  secLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: colors.textMuted, marginBottom: 8, marginTop: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: colors.borderStrong, padding: spacing.md, elevation: 3, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  saveBtn: { backgroundColor: colors.primaryMid, borderRadius: radius.md, paddingVertical: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  signOutBtn: { borderWidth: 1.5, borderColor: colors.dangerBorder, borderRadius: radius.md, paddingVertical: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, backgroundColor: colors.dangerBg },
  signOutTxt: { fontSize: 16, fontWeight: '700', color: colors.danger },
});
