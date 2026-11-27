import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, radius, spacing } from '../../theme';

const fmtBudget = (n) => {
  const num = parseFloat(String(n).replace(/,/g, '')) || 0;
  return num === 0 ? '' : num.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

export default function SettingsScreen({ navigation }) {
  const { settings, updateSettings } = useAppSettings();
  const { userProfile, logout } = useAuth();

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [companyPhone, setCompanyPhone] = useState(settings.companyPhone || '');
  const [mpesaPaybill, setMpesaPaybill] = useState(settings.mpesaPaybill || '');
  const [paymentNote, setPaymentNote] = useState(settings.paymentNote || '');
  const [budget, setBudget] = useState(fmtBudget(settings.monthlyBudget));
  const [unitCost, setUnitCost] = useState(String(settings.unitCostDefault));
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const hasChanges = useMemo(() => {
    const b = parseFloat(budget.replace(/,/g, '')) || 0;
    const uc = parseFloat(unitCost) || 0;
    return (
      companyName.trim() !== settings.companyName ||
      companyPhone.trim() !== (settings.companyPhone || '') ||
      mpesaPaybill.trim() !== (settings.mpesaPaybill || '') ||
      paymentNote.trim() !== (settings.paymentNote || '') ||
      b !== settings.monthlyBudget ||
      uc !== settings.unitCostDefault
    );
  }, [companyName, companyPhone, mpesaPaybill, paymentNote, budget, unitCost, settings]);

  const handleSave = () => {
    const b = parseFloat(budget.replace(/,/g, '')) || 0;
    const uc = parseFloat(unitCost) || 0;
    if (!companyName.trim()) return;
    updateSettings({
      companyName: companyName.trim(),
      companyPhone: companyPhone.trim(),
      mpesaPaybill: mpesaPaybill.trim(),
      paymentNote: paymentNote.trim(),
      monthlyBudget: b,
      unitCostDefault: uc,
    });
    navigation.goBack();
  };

  const roleLabel = userProfile?.role
    ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1).toLowerCase()
    : 'User';

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Settings"
        subtitle="Company and billing defaults"
        showBack
      />

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.profileAvatar}>
            <Text style={s.profileAvatarText}>
              {(userProfile?.name || userProfile?.email || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName} numberOfLines={1}>{userProfile?.name || 'Account'}</Text>
            <Text style={s.profileEmail} numberOfLines={1}>{userProfile?.email || ''}</Text>
          </View>
          <View style={s.roleBadge}>
            <Text style={s.roleBadgeText}>{roleLabel}</Text>
          </View>
        </View>

        {/* Company */}
        <Text style={s.secLabel}>Company</Text>
        <View style={s.card}>
          <Field label="Company / Agency Name" hint="Appears on bills, quotations, and messages.">
            <TextInput style={s.input} value={companyName} onChangeText={setCompanyName} placeholder="e.g. Sunrise Properties Ltd" placeholderTextColor={colors.textMuted} />
          </Field>
          <Field label="Company Phone" hint="Shown on tenant-facing documents." topSpacing>
            <TextInput style={s.input} value={companyPhone} onChangeText={setCompanyPhone} placeholder="+254 7XX XXX XXX" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
          </Field>
        </View>

        {/* Payments */}
        <Text style={s.secLabel}>Payments</Text>
        <View style={s.card}>
          <Field label="M-Pesa Paybill / Till Number" hint="Printed on bills so tenants know where to pay.">
            <TextInput style={s.input} value={mpesaPaybill} onChangeText={setMpesaPaybill} placeholder="e.g. 522533" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
          </Field>
          <Field label="Default Payment Note" hint="e.g. Use your unit number as reference." topSpacing>
            <TextInput style={s.input} value={paymentNote} onChangeText={setPaymentNote} placeholder="Enter payment reference instructions" placeholderTextColor={colors.textMuted} multiline numberOfLines={2} />
          </Field>
        </View>

        {/* Financial */}
        <Text style={s.secLabel}>Financial</Text>
        <View style={s.card}>
          <Field label="Monthly Repair Budget (KES)" hint="Tracks approved spend on the landlord dashboard.">
            <TextInput
              style={s.input}
              value={budget}
              onChangeText={v => setBudget(v.replace(/[^0-9,]/g, ''))}
              onBlur={() => {
                const n = parseFloat(budget.replace(/,/g, '')) || 0;
                setBudget(n ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '');
              }}
              keyboardType="numeric"
              placeholder="120,000"
              placeholderTextColor={colors.textMuted}
            />
          </Field>
          <Field label="Default Water Unit Cost (KES)" hint="Price per unit of water. Can be overridden per bill." topSpacing>
            <TextInput style={s.input} value={unitCost} onChangeText={setUnitCost} keyboardType="decimal-pad" placeholder="65" placeholderTextColor={colors.textMuted} />
          </Field>
        </View>

        {/* Appearance */}
        <Text style={s.secLabel}>Appearance</Text>
        <View style={s.card}>
          <Text style={s.fieldLabel}>UI Design</Text>
          <View style={s.toggleRow}>
            {[{ key: 'v1', label: 'Classic', sub: 'V1' }, { key: 'v2', label: 'Modern', sub: 'V2' }].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.toggleOpt, settings.designVersion === opt.key && s.toggleOptActive]}
                onPress={() => updateSettings({ designVersion: opt.key })}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleLabel, settings.designVersion === opt.key && s.toggleLabelActive]}>{opt.label}</Text>
                <Text style={[s.toggleSub, settings.designVersion === opt.key && s.toggleSubActive]}>{opt.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={[s.saveBtn, !hasChanges && s.saveBtnDisabled]} onPress={handleSave} disabled={!hasChanges} activeOpacity={0.85}>
          <MaterialIcons name="check-circle" size={20} color="#fff" />
          <Text style={s.saveTxt}>Save Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.signOutBtn} onPress={() => setShowSignOutModal(true)} activeOpacity={0.85}>
          <MaterialIcons name="logout" size={18} color={colors.danger} />
          <Text style={s.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Sign out confirm modal */}
      <Modal visible={showSignOutModal} transparent animationType="fade" onRequestClose={() => setShowSignOutModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Sign Out</Text>
            <Text style={s.modalBody}>You will be returned to the login screen. Any unsaved changes will be lost.</Text>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowSignOutModal(false)}>
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={() => { setShowSignOutModal(false); logout(); }}>
                <Text style={s.modalConfirmTxt}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, hint, children, topSpacing }) {
  return (
    <View style={topSpacing ? { marginTop: 16 } : undefined}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: colors.borderStrong, padding: 14, marginBottom: 20, gap: 12 },
  profileAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryMid, justifyContent: 'center', alignItems: 'center' },
  profileAvatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 15, fontWeight: '800', color: colors.text },
  profileEmail: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  roleBadge: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primaryMid },
  secLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: colors.textMuted, marginBottom: 8, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: colors.borderStrong, padding: spacing.md, elevation: 3, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg },
  fieldHint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  saveBtn: { backgroundColor: colors.primaryMid, borderRadius: radius.md, paddingVertical: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBtnDisabled: { opacity: 0.4 },
  saveTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  signOutBtn: { borderWidth: 1.5, borderColor: colors.dangerBorder, borderRadius: radius.md, paddingVertical: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, backgroundColor: colors.dangerBg },
  signOutTxt: { fontSize: 16, fontWeight: '700', color: colors.danger },
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  toggleOpt: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.background },
  toggleOptActive: { borderColor: colors.primaryMid, backgroundColor: '#EFF6FF' },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  toggleLabelActive: { color: colors.primaryMid },
  toggleSub: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  toggleSubActive: { color: colors.primaryMid },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 10 },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  modalCancelTxt: { fontSize: 15, fontWeight: '700', color: colors.text },
  modalConfirm: { flex: 1, backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  modalConfirmTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
