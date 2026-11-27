import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Linking, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { UNITS, UNIT_COST_PER_M3 } from '../../data/seed';
import ScreenHeader from '../../components/ScreenHeader';
import { saveDraft } from '../../utils/offline';
import { logAudit } from '../../utils/auditLog';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { colors, radius, spacing, card, accent } from '../../theme';

const CHECKLIST_ITEMS = [
  { key: 'walls', label: 'Walls & Paintwork', description: 'Check for holes, scuffs, unacceptable marks, mould', defaultCost: 2500 },
  { key: 'locks', label: 'Locks & Doors', description: 'Verify all door/window locks functional, keys returned', defaultCost: 1500 },
  { key: 'plumbing', label: 'Plumbing & Fixtures', description: 'Taps, toilets, drainage · no leaks or damage', defaultCost: 2500 },
  { key: 'windows', label: 'Windows & Blinds', description: 'Glass intact, locks work, blinds/curtains present', defaultCost: 2000 },
  { key: 'electrical', label: 'Electrical Fittings', description: 'Switches, sockets, bulbs, DB board in good order', defaultCost: 1500 },
  { key: 'meter', label: 'Final Meter Reading', description: 'Record and photograph the final water meter reading', defaultCost: 2500 },
];

const CONDITIONS = ['Pass', 'Fail', 'Needs Repair'];
const COND_COLORS = {
  Pass: { text: colors.success, bg: colors.successBg, border: colors.successBorder, solid: colors.successMid },
  Fail: { text: colors.danger, bg: colors.dangerBg, border: colors.dangerBorder, solid: colors.dangerMid },
  'Needs Repair': { text: colors.warning, bg: colors.warningBg, border: colors.warningBorder, solid: colors.warningMid },
};

export default function MoveOutInspectionScreen({ route, navigation }) {
  const { propertyId, unitId } = route.params || {};
  const { userProfile } = useAuth();
  const { settings } = useAppSettings();

  const propUnits = UNITS[propertyId] || [];
  const unitData = propUnits.find(u => u.id === unitId || u.unit === unitId);

  const [conditions, setConditions] = useState({});
  const [deductions, setDeductions] = useState({});
  const [notes, setNotes] = useState({});
  const [finalMeter, setFinalMeter] = useState(String(unitData?.presentReading || ''));
  const [saving, setSaving] = useState(false);

  // Failing an item opens its repair cost with a starting estimate; passing it removes the deduction
  const setCondition = (key, val) => {
    setConditions(p => ({ ...p, [key]: val }));
    setDeductions(p => {
      const next = { ...p };
      if (val === 'Pass') delete next[key];
      else if (next[key] === undefined) next[key] = String(CHECKLIST_ITEMS.find(i => i.key === key)?.defaultCost ?? 2500);
      return next;
    });
  };
  const setDeduction = (key, val) => setDeductions(p => ({ ...p, [key]: val.replace(/[^0-9.]/g, '') }));
  const setNote = (key, val) => setNotes(p => ({ ...p, [key]: val }));

  const deposit = unitData?.depositPaid || 0;
  const totalDeductions = Object.values(deductions).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const deductionCount = Object.values(deductions).filter(v => parseFloat(v) > 0).length;
  const finalMeterReading = parseFloat(finalMeter) || 0;
  const prevMeterReading = unitData?.prevReading || 0;
  const consumption = Math.max(0, finalMeterReading - prevMeterReading);
  const waterOwed = consumption * UNIT_COST_PER_M3;
  const totalOwed = totalDeductions + waterOwed + (unitData?.arrears || 0);
  const refund = Math.max(0, deposit - totalOwed);
  const additionalCharges = Math.max(0, totalOwed - deposit);

  const allChecked = CHECKLIST_ITEMS.every(item => conditions[item.key]);

  const handleSave = async () => {
    if (!allChecked) {
      Alert.alert('Incomplete', 'Please set a condition for all checklist items before saving.');
      return;
    }
    setSaving(true);
    const inspectionData = {
      propertyId,
      unitId: unitData?.unit,
      tenantName: unitData?.tenant,
      conditions,
      deductions,
      notes,
      finalMeter: finalMeterReading,
      waterOwed,
      totalDeductions,
      totalOwed,
      refund,
      additionalCharges,
      completedAt: new Date().toISOString(),
      completedBy: userProfile?.uid,
    };
    await saveDraft(`move_out_${propertyId}_${unitData?.unit}`, inspectionData);
    await logAudit({ userId: userProfile?.uid, role: userProfile?.role, action: 'MOVE_OUT_INSPECTION', entityId: `${propertyId}_${unitData?.unit}`, data: { totalDeductions, refund } });
    setSaving(false);
    Alert.alert('Inspection Saved', `Move-out inspection for Unit ${unitData?.unit} has been saved.`, [{ text: 'Done' }]);
  };

  const sendWhatsApp = () => {
    if (!unitData?.phone) { Alert.alert('No tenant phone on record'); return; }
    const failItems = CHECKLIST_ITEMS.filter(i => conditions[i.key] === 'Fail' || conditions[i.key] === 'Needs Repair').map(i => `- ${i.label}`).join('\n');
    const msg = `Dear ${unitData?.tenant || 'Tenant'},\n\nYour Move-Out Inspection Summary for Unit ${unitData?.unit} is complete.\n\nDeposit Paid: KES ${deposit.toLocaleString()}\nRepair Deductions: KES ${totalDeductions.toLocaleString()}\nWater (${consumption} units): KES ${waterOwed.toLocaleString()}\nArrears: KES ${(unitData?.arrears || 0).toLocaleString()}\n\n${refund > 0 ? `Deposit Refund Due: KES ${refund.toLocaleString()}` : `Amount Owed: KES ${additionalCharges.toLocaleString()}`}${failItems ? `\n\nItems requiring attention:\n${failItems}` : ''}\n\nFor queries, contact ${settings.companyName}.`;
    const num = unitData.phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
    Linking.openURL(`whatsapp://send?phone=${num}&text=${encodeURIComponent(msg)}`).catch(() => Alert.alert('WhatsApp not available'));
  };

  return (
    <View style={s.root}>
      <ScreenHeader title="Move-Out Inspection" subtitle={unitData ? `Unit ${unitData.unit} · ${unitData.tenant || 'Vacant'}` : 'Unit'} showBack />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Tenant info */}
        {unitData && (
          <View style={s.tenantCard}>
            <MaterialIcons name="account-circle" size={28} color={colors.primaryMid} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{unitData.tenant || 'Vacant unit'}</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>{unitData.phone} · Deposit: KES {deposit.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Checklist */}
        <View style={s.sectionHead}><Text style={s.sectionTitle}>Inspection Checklist</Text></View>
        {CHECKLIST_ITEMS.map(item => {
          const cond = conditions[item.key];
          return (
            <View key={item.key} style={s.itemCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemLabel}>{item.label}</Text>
                  <Text style={s.itemDesc}>{item.description}</Text>
                </View>
                {cond && (
                  <View style={{ backgroundColor: COND_COLORS[cond].bg, borderWidth: 1, borderColor: COND_COLORS[cond].border, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: COND_COLORS[cond].text }}>{cond}</Text>
                  </View>
                )}
              </View>
              <View style={s.condRow}>
                {CONDITIONS.map(c => {
                  const cc = COND_COLORS[c]; const active = cond === c;
                  return (
                    <TouchableOpacity key={c} style={[s.condBtn, { borderColor: active ? cc.solid : colors.borderStrong, backgroundColor: active ? cc.solid : colors.surface }]} onPress={() => setCondition(item.key, c)}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : colors.textSecondary }}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(cond === 'Fail' || cond === 'Needs Repair') && (
                <View style={s.deductBox}>
                  <Text style={s.deductLabel}>Estimated Repair Cost (KES)</Text>
                  <View style={s.costWrap}>
                    <Text style={s.costPrefix}>KES</Text>
                    <TextInput
                      style={s.costField}
                      value={deductions[item.key] ?? ''}
                      onChangeText={v => setDeduction(item.key, v)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      selectTextOnFocus
                    />
                  </View>
                  <Text style={s.deductHint}>Added to Repair Deductions and taken off the tenant's refund.</Text>
                  <Text style={[s.deductLabel, { marginTop: 10 }]}>Notes</Text>
                  <TextInput
                    style={s.deductField}
                    value={notes[item.key] || ''}
                    onChangeText={v => setNote(item.key, v)}
                    placeholder="Describe damage..."
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              )}
              {item.key === 'meter' && (
                <View style={{ marginTop: 8 }}>
                  <Text style={s.deductLabel}>Final Meter Reading (units)</Text>
                  <TextInput
                    style={s.deductField}
                    value={finalMeter}
                    onChangeText={setFinalMeter}
                    keyboardType="decimal-pad"
                    placeholder="Enter final meter reading"
                    placeholderTextColor={colors.textMuted}
                  />
                  {consumption > 0 && (
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                      Consumption: {consumption} units = KES {waterOwed.toLocaleString()}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Deposit Summary */}
        <View style={s.sectionHead}><Text style={s.sectionTitle}>Deposit Settlement</Text></View>
        <View style={s.summaryCard}>
          <SummaryRow label="Deposit Paid" value={`KES ${deposit.toLocaleString()}`} />
          <SummaryRow label={`Repair Deductions (${deductionCount} item${deductionCount !== 1 ? 's' : ''})`} value={`KES ${totalDeductions.toLocaleString()}`} negative={totalDeductions > 0} />
          <SummaryRow label={`Water (${consumption} units x KES ${UNIT_COST_PER_M3})`} value={`KES ${waterOwed.toLocaleString()}`} negative={waterOwed > 0} />
          {(unitData?.arrears || 0) > 0 && <SummaryRow label="Outstanding Arrears" value={`KES ${(unitData?.arrears || 0).toLocaleString()}`} negative />}
          <View style={s.summaryDivider} />
          {refund > 0 ? (
            <View style={s.refundRow}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.success }}>Refund Due to Tenant</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.success, fontVariant: ['tabular-nums'] }}>KES {refund.toLocaleString()}</Text>
            </View>
          ) : (
            <View style={s.refundRow}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>Additional Charges</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.danger, fontVariant: ['tabular-nums'] }}>KES {additionalCharges.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: 14, gap: 8 }}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primaryMid }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <MaterialIcons name="save" size={16} color="#fff" />
            <Text style={s.actionTxt}>{saving ? 'Saving...' : 'Save Inspection'}</Text>
          </TouchableOpacity>
          {unitData?.phone && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#25D366' }]} onPress={sendWhatsApp}>
              <MaterialIcons name="chat" size={16} color="#fff" />
              <Text style={s.actionTxt}>Send Summary to Tenant</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

function SummaryRow({ label, value, negative }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: negative ? colors.dangerMid : colors.text, fontVariant: ['tabular-nums'] }}>{negative ? '-' : ''}{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tenantCard: { ...card, flexDirection: 'row', alignItems: 'center', gap: 12, margin: spacing.md, marginBottom: 0, padding: 12 },
  sectionHead: { paddingHorizontal: spacing.md, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  itemCard: { ...card, marginHorizontal: spacing.md, padding: 12 },
  itemLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  itemDesc: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  condRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  condBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 8, borderWidth: 1.5 },
  deductBox: { marginTop: 8, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: 8, padding: 12 },
  costWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, minHeight: 50 },
  costPrefix: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginRight: 8 },
  costField: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text, padding: 0, fontVariant: ['tabular-nums'] },
  deductHint: { fontSize: 11, color: colors.warning, marginTop: 6 },
  deductLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  deductField: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, minHeight: 46, fontSize: 14, color: colors.text, backgroundColor: colors.surface },
  summaryCard: { ...card, marginHorizontal: spacing.md, padding: 14 },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  refundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, minHeight: 52 },
  actionTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
