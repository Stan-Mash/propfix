import React, { useState, useEffect } from 'react';
import { View, Text, Image, Modal, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import BillSlip, { sendBill } from './BillSlip';
import ConfirmModal from './ConfirmModal';
import { Field, Btn, Badge, LinkRow, SheetHeader, SectionLabel } from './ui';
import { usePortfolio, monthLabel } from '../context/PortfolioContext';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { UNIT_STATUS } from '../data/seed';
import { openRepairs } from '../navigation/links';
import { fmtDay } from '../utils/dates';
import { colors } from '../theme';

const kes = (n) => 'KES ' + Number(n || 0).toLocaleString();
const n0 = (v) => Number(v || 0).toLocaleString();
const cleanPhone = (p = '') => p.replace(/[\s\-()]/g, '');
const BILL_STATUS = {
  Paid: { text: colors.success, bg: colors.successBg, border: colors.successBorder },
  Partial: { text: colors.warning, bg: colors.warningBg, border: colors.warningBorder },
  Unpaid: { text: colors.danger, bg: colors.dangerBg, border: colors.dangerBorder },
  Due: { text: colors.info, bg: colors.infoBg, border: colors.infoBorder },
};

function Snap({ label, value, danger }) {
  return (
    <View style={s.snap}>
      <Text style={s.snapLbl}>{label}</Text>
      <Text style={[s.snapVal, danger && { color: colors.dangerMid }]}>{value}</Text>
    </View>
  );
}

function Comm({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.comm} onPress={onPress} activeOpacity={0.85}>
      <MaterialIcons name={icon} size={20} color="#fff" />
      <Text style={s.commTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function RowBtn({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.rowBtn} onPress={onPress} activeOpacity={0.8}>
      <MaterialIcons name={icon} size={18} color={colors.primaryMid} />
      <Text style={s.rowBtnTxt} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// Tenant 360: contact, money and meter snapshot, water ledger since move-in, and tenancy actions.
// target = { propertyId, unitId, view? } or null
export default function TenantSheet({ target, onClose, navigation }) {
  const { properties, findUnit, updateUnit, vacateTenant } = usePortfolio();
  const { userProfile } = useAuth();
  const { settings } = useAppSettings();
  const role = userProfile?.role;
  const canManage = role === 'landlord' || role === 'manager';

  const [view, setView] = useState('home');
  const [slip, setSlip] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [confirmVacate, setConfirmVacate] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (target) { setView(target.view || 'home'); setNotice(''); setSlip(null); setPhoto(null); setConfirmVacate(false); }
  }, [target?.propertyId, target?.unitId, target?.view]);

  const property = target ? properties.find(p => p.id === target.propertyId) : null;
  const unit = target ? findUnit(target.propertyId, target.unitId) : null;
  if (!target || !property || !unit || !unit.tenant) {
    return <BottomSheet visible={false} onClose={onClose} />;
  }

  const st = UNIT_STATUS[unit.status] || UNIT_STATUS.occupied;
  const rate = property.waterRate || settings.unitCostDefault || 65;
  const lifetime = Math.max(0, (unit.presentReading || 0) - (unit.moveInMeterReading ?? unit.prevReading ?? 0));
  const history = (unit.meterHistory || []).slice().reverse();

  const currentBill = {
    company: settings.companyName, month: monthLabel(), tenant: unit.tenant, flat: unit.unit, propertyName: property.name,
    prev: unit.prevReading, pres: unit.presentReading, rate, arrears: unit.arrears || 0, phone: unit.phone, email: unit.email,
  };
  const pastBill = (r) => ({
    company: settings.companyName, month: r.month, tenant: unit.tenant, flat: unit.unit, propertyName: property.name,
    prev: r.prevReading, pres: r.presentReading, rate: r.unitRate, arrears: r.arrears || 0, phone: unit.phone, email: unit.email,
    status: r.status, paidAmount: r.paidAmount,
  });

  const open = (url, failMsg) => Linking.openURL(url).then(() => setNotice('')).catch(() => setNotice(failMsg));
  const phone = cleanPhone(unit.phone);
  const call = () => (phone ? open(`tel:${phone}`, 'This phone cannot place calls.') : setNotice('No phone number is saved for this tenant.'));
  const whatsapp = () => (phone ? open(`whatsapp://send?phone=${phone.replace(/^\+/, '')}`, 'WhatsApp is not installed on this phone.') : setNotice('No phone number is saved for this tenant.'));
  const sms = () => (phone ? open(`sms:${phone}`, 'This phone cannot send SMS.') : setNotice('No phone number is saved for this tenant.'));
  const email = () => (unit.email ? open(`mailto:${unit.email}`, 'No email app is set up on this phone.') : setNotice('No email address is saved for this tenant.'));

  const startEdit = () => {
    setForm({ tenant: unit.tenant, phone: unit.phone || '', email: unit.email || '', rent: String(unit.rent || ''), arrears: String(unit.arrears || 0) });
    setFormError('');
    setView('edit');
  };

  const saveEdit = () => {
    if (!form.tenant.trim()) { setFormError('Enter the tenant name.'); return; }
    if (!form.phone.trim()) { setFormError('Enter a phone number so bills can be sent.'); return; }
    updateUnit(property.id, unit.id, {
      tenant: form.tenant.trim(), phone: form.phone.trim(), email: form.email.trim(),
      rent: parseFloat(form.rent) || 0, arrears: parseFloat(form.arrears) || 0,
    });
    setView('home');
  };

  const go = (fn) => { onClose(); fn(); };

  return (
    <BottomSheet visible onClose={onClose} maxHeight={0.92}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>

        {view === 'home' && (
          <>
            <View style={s.idRow}>
              <View style={s.avatar}><Text style={s.avatarTxt}>{unit.tenant[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{unit.tenant}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  <Badge label={`${property.name} · Unit ${unit.unit}`} icon="apartment" text={colors.primaryMid} bg={colors.primaryXLight} border={colors.primaryLight} />
                  <Badge label={st.label} text={st.text} bg={st.bg} border={st.border} />
                </View>
              </View>
            </View>
            <Text style={s.contact}>{unit.phone || 'No phone saved'}{unit.email ? `  ·  ${unit.email}` : ''}</Text>
            <Text style={s.tenure}>
              {unit.moveInDate ? `Tenant since ${fmtDay(unit.moveInDate)}` : 'Move-in date not recorded'}
              {unit.moveInMeterReading != null ? ` · Move-in meter: ${n0(unit.moveInMeterReading)} units` : ''}
            </Text>

            <View style={s.commBar}>
              <Comm icon="call" label="Call" onPress={call} />
              <Comm icon="chat" label="WhatsApp" onPress={whatsapp} />
              <Comm icon="sms" label="SMS" onPress={sms} />
              <Comm icon="email" label="Email" onPress={email} />
            </View>
            {notice ? <Text style={s.notice}>{notice}</Text> : null}

            <View style={s.snapGrid}>
              {role !== 'caretaker' && <Snap label="Monthly rent" value={kes(unit.rent)} />}
              {role !== 'caretaker' && <Snap label="Security deposit" value={kes(unit.depositPaid)} />}
              <Snap label="Current meter" value={`${n0(unit.presentReading)} units`} />
              <Snap label="Water arrears" value={kes(unit.arrears)} danger={(unit.arrears || 0) > 0} />
            </View>

            <LinkRow icon="history" label="View Water & Billing History" sub="Every reading since move-in" onPress={() => setView('history')} />
            <LinkRow icon="receipt-long" label="Preview & Share Current Water Bill" sub={`${monthLabel()} private bill slip`} onPress={() => setSlip(currentBill)} />
            <LinkRow icon="handyman" label={`View Unit ${unit.unit} Repair History`} onPress={() => go(() => openRepairs(navigation, role, { propertyId: property.id, unit: unit.unit }))} />
            <LinkRow icon="add-a-photo" label={`Log Repair for Unit ${unit.unit}`} onPress={() => go(() => navigation.navigate('LogIssue', { propertyId: property.id, unit: unit.unit }))} />
            {canManage && <LinkRow icon="edit" label="Edit Tenant Details" sub="Name, phone, email, rent, arrears" onPress={startEdit} />}
            <LinkRow icon="assignment" label="Start Move-Out Inspection" onPress={() => go(() => navigation.navigate('MoveOutInspection', { propertyId: property.id, unitId: unit.unit }))} />
            {canManage && <LinkRow icon="person-remove" label="Vacate & Remove Tenant" sub="Archives the tenant and frees the unit" danger onPress={() => setConfirmVacate(true)} />}
          </>
        )}

        {view === 'history' && (
          <>
            <SheetHeader title="Water & Billing History" sub={`${unit.tenant} · Unit ${unit.unit}`} onBack={() => setView('home')} />
            <View style={s.baseline}>
              <MaterialIcons name="flag" size={18} color={colors.primaryMid} />
              <Text style={s.baselineTxt}>
                Joined: {unit.moveInDate ? fmtDay(unit.moveInDate) : 'not recorded'} · Starting meter: {n0(unit.moveInMeterReading ?? 0)} units · Lifetime consumption: {n0(lifetime)} units
              </Text>
            </View>

            <View style={s.bill}>
              <View style={s.billHead}>
                <Text style={s.billMonth}>{monthLabel()} · Current</Text>
                <Badge label="Due" text={BILL_STATUS.Due.text} bg={BILL_STATUS.Due.bg} border={BILL_STATUS.Due.border} />
              </View>
              <Text style={s.billLine}>{n0(unit.prevReading)} → {n0(unit.presentReading)} · {n0(Math.max(0, unit.presentReading - unit.prevReading))} units at {kes(rate)}</Text>
              <Text style={s.billTotal}>Total due {kes(Math.max(0, unit.presentReading - unit.prevReading) * rate + (unit.arrears || 0))}{unit.arrears > 0 ? ` (includes ${kes(unit.arrears)} arrears)` : ''}</Text>
              <View style={s.billBtns}>
                <RowBtn icon="receipt-long" label="View Slip" onPress={() => setSlip(currentBill)} />
                <RowBtn icon="chat" label="WhatsApp" onPress={async () => setNotice(await sendBill('whatsapp', currentBill))} />
                <RowBtn icon="sms" label="SMS" onPress={async () => setNotice(await sendBill('sms', currentBill))} />
              </View>
            </View>
            {notice ? <Text style={s.notice}>{notice}</Text> : null}

            <SectionLabel>Past Bills ({history.length})</SectionLabel>
            {history.length === 0 && <Text style={s.empty}>No closed bills yet. The first one appears after this month is billed.</Text>}
            {history.map(r => {
              const bs = BILL_STATUS[r.status] || BILL_STATUS.Paid;
              return (
                <View key={r.id} style={s.bill}>
                  <View style={s.billHead}>
                    <Text style={s.billMonth}>{r.month}</Text>
                    <Badge label={r.status} text={bs.text} bg={bs.bg} border={bs.border} />
                  </View>
                  <Text style={s.billLine}>{n0(r.prevReading)} → {n0(r.presentReading)} · {n0(r.consumption)} units at {kes(r.unitRate)}</Text>
                  <Text style={s.billTotal}>Billed {kes(r.totalDue)} · Paid {kes(r.paidAmount)}</Text>
                  <Text style={s.billMeta}>Recorded {r.recordedAt}</Text>
                  <View style={s.billBtns}>
                    <RowBtn icon="receipt-long" label="View Slip" onPress={() => setSlip(pastBill(r))} />
                    <RowBtn icon="photo-camera" label="Meter Photo" onPress={() => setPhoto({ uri: r.meterPhotoUrl, month: r.month })} />
                    <RowBtn icon="chat" label="WhatsApp" onPress={async () => setNotice(await sendBill('whatsapp', pastBill(r)))} />
                    <RowBtn icon="sms" label="SMS" onPress={async () => setNotice(await sendBill('sms', pastBill(r)))} />
                  </View>
                </View>
              );
            })}
          </>
        )}

        {view === 'edit' && (
          <>
            <SheetHeader title="Edit Tenant Details" sub={`${property.name} · Unit ${unit.unit}`} onBack={() => setView('home')} />
            <SectionLabel>Contact</SectionLabel>
            <Field label="Tenant full name" value={form.tenant} onChangeText={v => setForm(f => ({ ...f, tenant: v }))} />
            <Field label="Phone" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder="+254..." />
            <Field label="Email" value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
            <SectionLabel>Money</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field style={{ flex: 1 }} label="Monthly rent (KES)" value={form.rent} onChangeText={v => setForm(f => ({ ...f, rent: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
              <Field style={{ flex: 1 }} label="Water arrears (KES)" value={form.arrears} onChangeText={v => setForm(f => ({ ...f, arrears: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
            </View>
            {formError ? <Text style={s.notice}>{formError}</Text> : null}
            <Btn label="Save Details" icon="save" onPress={saveEdit} />
          </>
        )}

        <BillSlip bill={slip} onClose={() => setSlip(null)} />

        <Modal visible={!!photo} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPhoto(null)}>
          <View style={s.photoOverlay}>
            <View style={s.photoBox}>
              <Text style={s.photoTitle}>Meter Photo · {photo?.month}</Text>
              {photo?.uri ? (
                <Image source={{ uri: photo.uri }} style={s.photoImg} resizeMode="cover" />
              ) : (
                <View style={s.photoNone}>
                  <MaterialIcons name="no-photography" size={36} color={colors.textMuted} />
                  <Text style={s.empty}>No meter photo was saved with this reading.</Text>
                </View>
              )}
              <Btn label="Close Photo" outline color={colors.textSecondary} onPress={() => setPhoto(null)} />
            </View>
          </View>
        </Modal>

        <ConfirmModal
          visible={confirmVacate}
          title={`Vacate ${unit.tenant}?`}
          message={`Unit ${unit.unit} becomes vacant. The tenant and their water ledger move to the unit's past tenants, and the closing reading of ${n0(unit.presentReading)} units is kept for the next tenant.${unit.arrears > 0 ? ` ${kes(unit.arrears)} in arrears is still owed.` : ''}`}
          confirmLabel="Vacate Tenant"
          icon="person-remove"
          onCancel={() => setConfirmVacate(false)}
          onConfirm={() => { setConfirmVacate(false); vacateTenant(property.id, unit.id); onClose(); }}
        />
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 20, fontWeight: '700', color: colors.primaryMid },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  contact: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 12 },
  tenure: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  commBar: { flexDirection: 'row', gap: 8, marginTop: 16 },
  comm: { flex: 1, height: 50, borderRadius: 8, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', gap: 2 },
  commTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },
  notice: { fontSize: 12, fontWeight: '500', color: colors.dangerMid, marginTop: 10, marginBottom: 4 },
  snapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 12 },
  snap: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  snapLbl: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  snapVal: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2, fontVariant: ['tabular-nums'] },
  baseline: { flexDirection: 'row', gap: 8, backgroundColor: colors.primaryXLight, borderWidth: 1, borderColor: colors.primaryLight, borderRadius: 8, padding: 12, marginBottom: 14 },
  baselineTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.info, lineHeight: 18 },
  bill: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 12 },
  billHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  billMonth: { fontSize: 15, fontWeight: '700', color: colors.text },
  billLine: { fontSize: 13, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  billTotal: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 4, fontVariant: ['tabular-nums'] },
  billMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  billBtns: { flexDirection: 'row', gap: 6, marginTop: 10 },
  rowBtn: { flex: 1, minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.primaryLight, backgroundColor: colors.primaryXLight, justifyContent: 'center', alignItems: 'center', gap: 2, paddingHorizontal: 2 },
  rowBtnTxt: { fontSize: 10, fontWeight: '700', color: colors.primaryMid },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginVertical: 10 },
  photoOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 24 },
  photoBox: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 },
  photoTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  photoImg: { width: '100%', height: 260, borderRadius: 8 },
  photoNone: { height: 160, borderRadius: 8, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
});
