import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Linking, Share, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme';

const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cleanPhone = (p = '') => p.replace(/[\s\-()]/g, '');

// Plain-text version of a bill, shared by WhatsApp, SMS and email
export function billText(b) {
  const cons = Math.max(0, (b.pres || 0) - (b.prev || 0));
  const charge = cons * (b.rate || 0);
  const total = charge + (b.arrears || 0);
  let t = `${(b.company || '').toUpperCase()}\nPRIVATE BILL · ${b.billType || 'WATER BILL'} · ${(b.month || '').toUpperCase()}\n${'─'.repeat(30)}\n`;
  if (b.tenant) t += `Dear ${b.tenant},\n`;
  if (b.propertyName) t += `Property: ${b.propertyName}\n`;
  t += `Flat: ${b.flat}\n${'─'.repeat(30)}\n`;
  t += `Previous Reading:  ${b.prev || 0}\nPresent Reading:   ${b.pres || 0}\nUnits Consumed:    ${cons}\nUnit Cost:         KES ${money(b.rate)}\n`;
  if (b.arrears > 0) t += `Arrears:           KES ${money(b.arrears)}\n`;
  t += `${'─'.repeat(30)}\nTOTAL DUE: KES ${money(total)}\n`;
  if (b.paidAmount != null && b.status) t += `Status: ${b.status} (paid KES ${money(b.paidAmount)})\n`;
  if (b.note) t += `\n${b.note}\n`;
  return t;
}

export async function sendBill(channel, b) {
  const text = billText(b);
  const phone = cleanPhone(b.phone);
  try {
    if (channel === 'whatsapp') {
      if (!phone) return 'No phone number is saved for this tenant.';
      const url = `whatsapp://send?phone=${phone.replace(/^\+/, '')}&text=${encodeURIComponent(text)}`;
      if (await Linking.canOpenURL(url)) { await Linking.openURL(url); return ''; }
      await Share.share({ message: text });
      return '';
    }
    if (channel === 'sms') {
      if (!phone) return 'No phone number is saved for this tenant.';
      const cons = Math.max(0, (b.pres || 0) - (b.prev || 0));
      const short = `Dear ${b.tenant || `Flat ${b.flat}`}, your ${b.billType || 'WATER BILL'} for ${b.month}: KES ${money(cons * (b.rate || 0) + (b.arrears || 0))}. ${b.company || ''}`;
      await Linking.openURL(`sms:${phone}?body=${encodeURIComponent(short)}`);
      return '';
    }
    if (!b.email) return 'No email address is saved for this tenant.';
    await Linking.openURL(`mailto:${b.email}?subject=${encodeURIComponent(`${b.billType || 'WATER BILL'} · ${b.month} · Flat ${b.flat}`)}&body=${encodeURIComponent(text)}`);
    return '';
  } catch (_) {
    return channel === 'email' ? 'No email app is set up on this phone.' : 'Could not open the messaging app on this phone.';
  }
}

function Line({ label, value, strong, danger }) {
  return (
    <View style={[s.line, strong && s.lineTotal]}>
      <Text style={[s.lineLbl, strong && { color: '#CBD5E1' }]}>{label}</Text>
      <Text style={[s.lineVal, strong && { color: '#fff', fontSize: 16 }, danger && { color: colors.dangerMid }]}>{value}</Text>
    </View>
  );
}

// Bordered private bill slip with one-tap dispatch
export default function BillSlip({ bill, onClose }) {
  const [notice, setNotice] = useState('');
  if (!bill) return null;
  const cons = Math.max(0, (bill.pres || 0) - (bill.prev || 0));
  const charge = cons * (bill.rate || 0);
  const total = charge + (bill.arrears || 0);
  const send = async (channel) => setNotice(await sendBill(channel, bill));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent hardwareAccelerated onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.company}>{(bill.company || '').toUpperCase()} - PRIVATE BILL</Text>
              <Text style={s.sub}>{bill.billType || 'WATER BILL'} · {(bill.month || '').toUpperCase()}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.close} activeOpacity={0.7}>
              <MaterialIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={s.who}>
            <Text style={s.whoTxt}>Tenant: <Text style={s.whoVal}>{bill.tenant || `Flat ${bill.flat}`}</Text></Text>
            <Text style={s.whoTxt}>Flat: <Text style={s.whoVal}>{bill.flat}</Text>{bill.propertyName ? <Text>  ·  Property: <Text style={s.whoVal}>{bill.propertyName}</Text></Text> : null}</Text>
          </View>
          <Line label="Previous reading" value={String(bill.prev || 0)} />
          <Line label="Present reading" value={String(bill.pres || 0)} />
          <Line label="Consumption" value={`${cons} units`} />
          <Line label="Unit cost" value={`KES ${money(bill.rate)}`} />
          <Line label="Water charge" value={`KES ${money(charge)}`} />
          {bill.arrears > 0 ? <Line label="Arrears" value={`KES ${money(bill.arrears)}`} danger /> : null}
          <Line label="TOTAL DUE" value={`KES ${money(total)}`} strong />
          {bill.status ? <Text style={s.status}>{bill.status}{bill.paidAmount != null ? ` · Paid KES ${money(bill.paidAmount)}` : ''}</Text> : null}
          {notice ? <Text style={s.notice}>{notice}</Text> : null}
          <View style={s.actions}>
            <TouchableOpacity style={[s.act, { backgroundColor: '#128C7E' }]} onPress={() => send('whatsapp')} activeOpacity={0.85}>
              <MaterialIcons name="chat" size={18} color="#fff" /><Text style={s.actTxt}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.act, { backgroundColor: colors.primaryMid }]} onPress={() => send('sms')} activeOpacity={0.85}>
              <MaterialIcons name="sms" size={18} color="#fff" /><Text style={s.actTxt}>SMS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.act, { backgroundColor: '#475569' }]} onPress={() => send('email')} activeOpacity={0.85}>
              <MaterialIcons name="email" size={18} color="#fff" /><Text style={s.actTxt}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { backgroundColor: colors.surface, borderRadius: 16, width: '100%', maxWidth: 380, overflow: 'hidden', borderWidth: 2, borderColor: '#0F172A' },
  head: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', padding: 14, gap: 10 },
  company: { fontSize: 13, fontWeight: '700', color: '#fff' },
  sub: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 2 },
  close: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  who: { padding: 12, gap: 3, borderBottomWidth: 1, borderBottomColor: colors.border },
  whoTxt: { fontSize: 12, color: colors.textMuted },
  whoVal: { fontWeight: '700', color: colors.text },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  lineTotal: { backgroundColor: '#1E293B', borderBottomWidth: 0 },
  lineLbl: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  lineVal: { fontSize: 14, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  status: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', paddingTop: 10 },
  notice: { fontSize: 12, fontWeight: '500', color: colors.dangerMid, textAlign: 'center', paddingTop: 10, paddingHorizontal: 12 },
  actions: { flexDirection: 'row', gap: 8, padding: 12 },
  act: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 50, borderRadius: 8 },
  actTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
