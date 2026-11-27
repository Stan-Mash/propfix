import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { usePortfolio } from '../../context/PortfolioContext';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, radius, spacing, card } from '../../theme';

// ---- helpers ----
let _rc = 0;
const uid = () => `t${++_rc}_${Date.now().toString(36)}`;
const num = (v) => parseFloat(String(v).replace(/,/g, '')) || 0;

const DEFAULT_PAYABLES = () => [
  { id: uid(), type: 'fixed',          label: 'Base Rent',         amount: '',  enabled: true },
  { id: uid(), type: 'metered_water',  label: 'Water',             rate: '',    enabled: true },
  { id: uid(), type: 'fixed',          label: 'Service Charge',    amount: '',  enabled: false },
  { id: uid(), type: 'fixed',          label: 'Garbage Collection',amount: '',  enabled: false },
  { id: uid(), type: 'fixed',          label: 'Security',          amount: '',  enabled: false },
];

const newTier = () => ({
  id: uid(),
  name: '',
  prefix: '',
  count: '',
  expanded: true,
  payables: DEFAULT_PAYABLES(),
});

// ---- Step indicator ----
function Stepper({ step }) {
  const steps = ['Building', 'Tiers', 'Review'];
  return (
    <View style={s.stepper}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <React.Fragment key={n}>
            <View style={s.stepItem}>
              <View style={[s.stepCircle, active && s.stepCircleActive, done && s.stepCircleDone]}>
                {done
                  ? <MaterialIcons name="check" size={12} color="#fff" />
                  : <Text style={[s.stepNum, active && s.stepNumActive]}>{n}</Text>}
              </View>
              <Text style={[s.stepLabel, active && s.stepLabelActive]}>{label}</Text>
            </View>
            {i < steps.length - 1 && <View style={[s.stepLine, done && s.stepLineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ---- Shared input helpers ----
function Field({ label, children, hint, row }) {
  return (
    <View style={[s.field, row && { flexDirection: 'row', gap: 10 }]}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      {children}
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function Input({ style, ...props }) {
  return (
    <TextInput
      style={[s.input, style]}
      placeholderTextColor={colors.textMuted}
      {...props}
    />
  );
}

// ---- STEP 1: Building Details ----
function Step1({ data, onChange }) {
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to add a cover photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [16, 9] });
    if (!result.canceled && result.assets?.[0]) onChange('coverPhoto', result.assets[0].uri);
  };

  return (
    <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Cover photo */}
      <TouchableOpacity style={s.photoPicker} onPress={pickPhoto} activeOpacity={0.8}>
        {data.coverPhoto ? (
          <>
            <Image source={{ uri: data.coverPhoto }} style={s.photoImage} />
            <View style={s.photoOverlay}>
              <MaterialIcons name="photo-camera" size={20} color="#fff" />
              <Text style={s.photoOverlayTxt}>Change photo</Text>
            </View>
          </>
        ) : (
          <>
            <MaterialIcons name="add-a-photo" size={28} color={colors.textMuted} />
            <Text style={s.photoPlaceholder}>Add cover photo (optional)</Text>
          </>
        )}
      </TouchableOpacity>

      <Field label="Property Name *">
        <Input value={data.name} onChangeText={v => onChange('name', v)} placeholder="e.g. Kilimani Crest" />
      </Field>

      <Field label="Location *">
        <Input value={data.location} onChangeText={v => onChange('location', v)} placeholder="e.g. Kilimani, Nairobi" />
      </Field>

      <Field label="M-Pesa Paybill / Till Number">
        <Input value={data.paybill} onChangeText={v => onChange('paybill', v)} placeholder="e.g. 522533" keyboardType="number-pad" />
      </Field>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Water Rate (KES / unit)" style={{ flex: 1 }}>
          <Input value={data.waterRate} onChangeText={v => onChange('waterRate', v)} placeholder="65" keyboardType="decimal-pad" />
        </Field>
        <Field label="Electricity Rate (KES / kWh)" style={{ flex: 1 }}>
          <Input value={data.powerRate} onChangeText={v => onChange('powerRate', v)} placeholder="0" keyboardType="decimal-pad" />
        </Field>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Initial Master Meter (m³)" style={{ flex: 1 }}>
          <Input value={data.masterMeterReading} onChangeText={v => onChange('masterMeterReading', v)} placeholder="0" keyboardType="decimal-pad" />
        </Field>
        <Field label="Billing Due Day" style={{ flex: 1 }}>
          <Input value={data.billingDueDay} onChangeText={v => onChange('billingDueDay', v.replace(/[^0-9]/g, ''))} placeholder="1" keyboardType="number-pad" maxLength={2} />
        </Field>
      </View>
    </ScrollView>
  );
}

// ---- Payable row inside a tier ----
function PayableRow({ p, onChange, waterRate }) {
  const isMetered = p.type === 'metered_water';
  return (
    <View style={[s.payableRow, !p.enabled && { opacity: 0.45 }]}>
      <Switch
        value={p.enabled}
        onValueChange={v => onChange({ ...p, enabled: v })}
        trackColor={{ true: colors.primaryMid, false: colors.borderStrong }}
        thumbColor="#fff"
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />
      <Text style={s.payableLabel} numberOfLines={1}>{p.label}</Text>
      {isMetered ? (
        <View style={s.payableInputWrap}>
          <Input
            style={s.payableInput}
            value={p.rate !== undefined ? String(p.rate) : waterRate}
            onChangeText={v => onChange({ ...p, rate: v })}
            keyboardType="decimal-pad"
            placeholder={waterRate || '65'}
            editable={p.enabled}
          />
          <Text style={s.payableUnit}>KES/unit</Text>
        </View>
      ) : (
        <View style={s.payableInputWrap}>
          <Input
            style={s.payableInput}
            value={String(p.amount || '')}
            onChangeText={v => onChange({ ...p, amount: v })}
            keyboardType="decimal-pad"
            placeholder="0"
            editable={p.enabled}
          />
          <Text style={s.payableUnit}>KES/mo</Text>
        </View>
      )}
    </View>
  );
}

// ---- STEP 2: Tiers & Payables ----
function Step2({ tiers, setTiers, waterRate }) {
  const updateTier = (id, patch) => setTiers(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  const updatePayable = (tierId, payable) => setTiers(prev => prev.map(t => t.id === tierId ? { ...t, payables: t.payables.map(p => p.id === payable.id ? payable : p) } : t));
  const removeTier = (id) => setTiers(prev => prev.filter(t => t.id !== id));
  const addTier = () => setTiers(prev => [...prev, newTier()]);

  if (tiers.length === 0) {
    return (
      <View style={s.emptyTiers}>
        <MaterialIcons name="layers" size={40} color={colors.borderStrong} />
        <Text style={s.emptyTiersTxt}>No unit tiers yet</Text>
        <Text style={s.emptyTiersSub}>Tiers let you group units (Studio, 1BR, 2BR) with different rents and charges.</Text>
        <TouchableOpacity style={s.addTierBtn} onPress={addTier}>
          <MaterialIcons name="add" size={16} color={colors.primaryMid} />
          <Text style={s.addTierTxt}>Add First Tier</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {tiers.map((tier, idx) => (
        <View key={tier.id} style={s.tierCard}>
          {/* Tier header */}
          <TouchableOpacity style={s.tierHead} onPress={() => updateTier(tier.id, { expanded: !tier.expanded })} activeOpacity={0.75}>
            <View style={s.tierHeadLeft}>
              <View style={s.tierNum}><Text style={s.tierNumTxt}>{idx + 1}</Text></View>
              <Text style={s.tierHeadName} numberOfLines={1}>{tier.name || `Tier ${idx + 1}`}</Text>
              {tier.count ? <Text style={s.tierUnitCount}>{tier.count} units</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {tiers.length > 1 && (
                <TouchableOpacity onPress={() => removeTier(tier.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="delete-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
              <MaterialIcons name={tier.expanded ? 'expand-less' : 'expand-more'} size={20} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {tier.expanded && (
            <View style={s.tierBody}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 2 }}>
                  <Text style={s.fieldLabel}>Tier Name</Text>
                  <Input value={tier.name} onChangeText={v => updateTier(tier.id, { name: v })} placeholder="e.g. Studio, 1 Bedroom" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Prefix</Text>
                  <Input value={tier.prefix} onChangeText={v => updateTier(tier.id, { prefix: v.toUpperCase() })} placeholder="A" maxLength={3} autoCapitalize="characters" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Count</Text>
                  <Input value={tier.count} onChangeText={v => updateTier(tier.id, { count: v.replace(/[^0-9]/g, '') })} placeholder="6" keyboardType="number-pad" />
                </View>
              </View>

              <Text style={[s.fieldLabel, { marginTop: 14, marginBottom: 8 }]}>Payables</Text>
              {tier.payables.map(p => (
                <PayableRow key={p.id} p={p} waterRate={waterRate} onChange={updated => updatePayable(tier.id, updated)} />
              ))}
            </View>
          )}
        </View>
      ))}

      <TouchableOpacity style={s.addTierRowBtn} onPress={addTier}>
        <MaterialIcons name="add" size={16} color={colors.primaryMid} />
        <Text style={s.addTierTxt}>Add Another Tier</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---- STEP 3: Staff & Review ----
function Step3({ data, tiers, managerId, setManagerId, caretakerId, setCaretakerId }) {
  const [staff, setStaff] = useState({ managers: [], caretakers: [] });
  const [loadingStaff, setLoadingStaff] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('active', '!=', false)));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStaff({
          managers: all.filter(u => u.role === 'manager'),
          caretakers: all.filter(u => u.role === 'caretaker'),
        });
      } catch (_) {}
      setLoadingStaff(false);
    })();
  }, []);

  const totalUnits = tiers.reduce((s, t) => s + (parseInt(t.count, 10) || 0), 0);

  return (
    <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Staff pickers */}
      <Text style={s.reviewSection}>Assign Staff</Text>

      {loadingStaff ? <ActivityIndicator color={colors.primaryMid} style={{ marginVertical: 16 }} /> : (
        <>
          <StaffPicker label="Manager" icon="manage-accounts" options={staff.managers} selected={managerId} onSelect={setManagerId} />
          <StaffPicker label="Caretaker" icon="engineering" options={staff.caretakers} selected={caretakerId} onSelect={setCaretakerId} />
          {staff.managers.length === 0 && staff.caretakers.length === 0 && (
            <Text style={s.noStaffNote}>No active staff yet. You can assign staff later from the Staff Accounts screen.</Text>
          )}
        </>
      )}

      {/* Review summary */}
      <Text style={[s.reviewSection, { marginTop: 20 }]}>Property Summary</Text>
      <View style={s.reviewCard}>
        {data.coverPhoto ? (
          <Image source={{ uri: data.coverPhoto }} style={s.reviewPhoto} />
        ) : (
          <View style={s.reviewPhotoPlaceholder}>
            <MaterialIcons name="business" size={28} color={colors.textMuted} />
          </View>
        )}
        <ReviewRow icon="label" label="Name" value={data.name} />
        <ReviewRow icon="location-on" label="Location" value={data.location} />
        {data.paybill ? <ReviewRow icon="payment" label="Paybill / Till" value={data.paybill} /> : null}
        <ReviewRow icon="water-drop" label="Water Rate" value={`KES ${data.waterRate || 65}/unit`} />
        <ReviewRow icon="event" label="Due Day" value={`Day ${data.billingDueDay || 1} of each month`} />
      </View>

      <Text style={[s.reviewSection, { marginTop: 16 }]}>Units: {totalUnits} total</Text>
      {tiers.map((t, i) => {
        const count = parseInt(t.count, 10) || 0;
        if (!count) return null;
        const rent = t.payables.find(p => p.label === 'Base Rent')?.amount;
        return (
          <View key={t.id} style={s.tierSummaryRow}>
            <View style={s.tierNum}><Text style={s.tierNumTxt}>{i + 1}</Text></View>
            <Text style={s.tierSummaryName}>{t.name || `Tier ${i + 1}`}</Text>
            <Text style={s.tierSummaryCount}>{count} units</Text>
            {rent ? <Text style={s.tierSummaryRent}>KES {Number(rent).toLocaleString()}/mo</Text> : null}
          </View>
        );
      })}
      {totalUnits === 0 && (
        <Text style={s.noStaffNote}>No units configured. Go back to Step 2 to add tiers, or you can add units manually after creating the property.</Text>
      )}
    </ScrollView>
  );
}

function StaffPicker({ label, icon, options, selected, onSelect }) {
  const sel = options.find(o => o.uid === selected || o.id === selected);
  return (
    <View style={s.staffPickWrap}>
      <Text style={s.staffPickLabel}>{label}</Text>
      {options.length === 0 ? (
        <Text style={s.staffPickNone}>No {label.toLowerCase()}s registered</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          <TouchableOpacity
            style={[s.staffChip, !selected && s.staffChipActive]}
            onPress={() => onSelect(null)}
          >
            <Text style={[s.staffChipTxt, !selected && s.staffChipTxtActive]}>None</Text>
          </TouchableOpacity>
          {options.map(u => {
            const id = u.uid || u.id;
            const active = selected === id;
            return (
              <TouchableOpacity key={id} style={[s.staffChip, active && s.staffChipActive]} onPress={() => onSelect(id)}>
                <MaterialIcons name={icon} size={13} color={active ? '#fff' : colors.textMuted} />
                <Text style={[s.staffChipTxt, active && s.staffChipTxtActive]} numberOfLines={1}>{u.name || u.email}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function ReviewRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={s.reviewRow}>
      <MaterialIcons name={icon} size={15} color={colors.textMuted} />
      <Text style={s.reviewRowLabel}>{label}:</Text>
      <Text style={s.reviewRowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ---- Main Wizard ----
export default function AddPropertyWizard({ navigation }) {
  const { addProperty } = usePortfolio();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [prop, setProp] = useState({
    name: '', location: '', paybill: '', waterRate: '65',
    powerRate: '', masterMeterReading: '', billingDueDay: '1', coverPhoto: null,
  });
  const setPropField = useCallback((k, v) => setProp(p => ({ ...p, [k]: v })), []);

  // Step 2 state
  const [tiers, setTiers] = useState([newTier()]);

  // Step 3 state
  const [managerId, setManagerId] = useState(null);
  const [caretakerId, setCaretakerId] = useState(null);

  const validateStep1 = () => {
    if (!prop.name.trim()) { Alert.alert('Required', 'Enter a property name.'); return false; }
    if (!prop.location.trim()) { Alert.alert('Required', 'Enter a location.'); return false; }
    const dueDay = parseInt(prop.billingDueDay, 10);
    if (prop.billingDueDay && (dueDay < 1 || dueDay > 28)) { Alert.alert('Invalid', 'Billing due day must be between 1 and 28.'); return false; }
    return true;
  };

  const validateStep2 = () => {
    for (const t of tiers) {
      if (t.count && parseInt(t.count, 10) > 200) {
        Alert.alert('Too many units', `Tier "${t.name || 'Tier'}" cannot have more than 200 units.`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step === 1) { navigation.goBack(); return; }
    setStep(s => s - 1);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      // Build tiers for PortfolioContext
      const contextTiers = tiers
        .filter(t => parseInt(t.count, 10) > 0)
        .map(t => ({
          id: t.id,
          name: t.name.trim() || `Tier ${t.id}`,
          prefix: t.prefix.trim() || 'A',
          count: parseInt(t.count, 10),
          payables: t.payables.map(p => ({
            ...p,
            amount: p.type !== 'metered_water' ? num(p.amount) : undefined,
            rate: p.type === 'metered_water' ? num(p.rate || prop.waterRate || 65) : undefined,
          })),
        }));

      addProperty(
        {
          name: prop.name.trim(),
          location: prop.location.trim(),
          address: prop.location.trim(),
          paybill: prop.paybill.trim(),
          waterRate: num(prop.waterRate) || 65,
          powerRate: num(prop.powerRate) || 0,
          masterMeterReading: num(prop.masterMeterReading) || 0,
          billingDueDay: parseInt(prop.billingDueDay, 10) || 1,
          coverPhoto: prop.coverPhoto || null,
          managerId: managerId || null,
          caretakerId: caretakerId || null,
        },
        { enabled: false },
        contextTiers.length ? contextTiers : undefined,
      );

      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not create property.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Add Property"
        subtitle={`Step ${step} of 3`}
        showBack
      />
      <Stepper step={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 1 && <Step1 data={prop} onChange={setPropField} />}
        {step === 2 && <Step2 tiers={tiers} setTiers={setTiers} waterRate={prop.waterRate || '65'} />}
        {step === 3 && (
          <Step3
            data={prop}
            tiers={tiers}
            managerId={managerId}
            setManagerId={setManagerId}
            caretakerId={caretakerId}
            setCaretakerId={setCaretakerId}
          />
        )}
      </KeyboardAvoidingView>

      {/* Navigation bar */}
      <View style={s.navBar}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack} disabled={saving}>
          <MaterialIcons name="arrow-back" size={18} color={colors.text} />
          <Text style={s.backBtnTxt}>{step === 1 ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>

        {step < 3 ? (
          <TouchableOpacity style={s.nextBtn} onPress={handleNext}>
            <Text style={s.nextBtnTxt}>Next</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.createBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <MaterialIcons name="check-circle" size={18} color="#fff" />
                  <Text style={s.nextBtnTxt}>Create Property</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepItem: { alignItems: 'center', gap: 4 },
  stepLine: { flex: 1, height: 1.5, backgroundColor: colors.border, marginHorizontal: 4, marginBottom: 14 },
  stepLineDone: { backgroundColor: colors.primaryMid },
  stepCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  stepCircleActive: { borderColor: colors.primaryMid, backgroundColor: colors.primaryMid },
  stepCircleDone: { borderColor: colors.primaryMid, backgroundColor: colors.primaryMid },
  stepNum: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  stepLabelActive: { color: colors.primaryMid, fontWeight: '800' },

  // Step content
  stepContent: { padding: spacing.md, paddingBottom: 32 },

  // Fields
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 5 },
  fieldHint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: colors.text, backgroundColor: colors.inputBg },

  // Photo picker
  photoPicker: { height: 130, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 18, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  photoOverlayTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  photoPlaceholder: { fontSize: 13, color: colors.textMuted, marginTop: 8 },

  // Tier cards
  tierCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12, overflow: 'hidden' },
  tierHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  tierHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  tierNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primaryMid, justifyContent: 'center', alignItems: 'center' },
  tierNumTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  tierHeadName: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  tierUnitCount: { fontSize: 11, color: colors.textMuted, backgroundColor: colors.background, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tierBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border },

  // Payable rows
  payableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  payableLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  payableInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payableInput: { width: 80, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: colors.text, backgroundColor: colors.inputBg, textAlign: 'right' },
  payableUnit: { fontSize: 10, color: colors.textMuted, width: 48 },

  // Add tier
  addTierBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1.5, borderColor: colors.primaryMid, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8 },
  addTierRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  addTierTxt: { fontSize: 13, fontWeight: '700', color: colors.primaryMid },
  emptyTiers: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTiersTxt: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyTiersSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Staff picker
  staffPickWrap: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 12 },
  staffPickLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  staffPickNone: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  staffChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  staffChipActive: { backgroundColor: colors.primaryMid, borderColor: colors.primaryMid },
  staffChipTxt: { fontSize: 12, fontWeight: '600', color: colors.text },
  staffChipTxtActive: { color: '#fff' },
  noStaffNote: { fontSize: 12, color: colors.textMuted, lineHeight: 18, textAlign: 'center', marginVertical: 8 },

  // Review
  reviewSection: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, color: colors.textMuted, marginBottom: 8 },
  reviewCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 4 },
  reviewPhoto: { width: '100%', height: 100, resizeMode: 'cover' },
  reviewPhotoPlaceholder: { height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  reviewRowLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, width: 72 },
  reviewRowValue: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  tierSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, marginBottom: 8 },
  tierSummaryName: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  tierSummaryCount: { fontSize: 12, color: colors.textMuted },
  tierSummaryRent: { fontSize: 12, fontWeight: '700', color: colors.primaryMid, fontVariant: ['tabular-nums'] },

  // Nav bar
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: 24, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4 },
  backBtnTxt: { fontSize: 15, fontWeight: '700', color: colors.text },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryMid, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 24 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successMid, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 20 },
  nextBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
