import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, card } from '../../theme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const STATUS_COLOR = {
  pending:  { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  approved: { bg: '#D1FAE5', text: '#065F46', dot: '#16A34A' },
  rejected: { bg: '#FEE2E2', text: '#991B1B', dot: '#DC2626' },
};

export default function QuotationDetailScreen({ route, navigation }) {
  const { quotationId } = route.params;
  const { userProfile } = useAuth();
  const [quot, setQuot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(false);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const role = userProfile?.role || 'landlord';
  const canApprove = role === 'landlord' || role === 'manager';

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'quotations', quotationId), snap => {
      setQuot(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    return unsub;
  }, [quotationId]);

  const approve = async () => {
    setActing(true);
    try {
      await updateDoc(doc(db, 'quotations', quotationId), {
        status: 'approved',
        approvedByUid: userProfile.uid,
        approvedByName: userProfile.name || userProfile.email,
        approvedAt: serverTimestamp(),
      });
    } catch (e) { Alert.alert('Error', e.message); }
    setActing(false);
  };

  const reject = async () => {
    if (!reason.trim()) return Alert.alert('Required', 'Please enter a rejection reason.');
    setActing(true);
    try {
      await updateDoc(doc(db, 'quotations', quotationId), {
        status: 'rejected',
        rejectionReason: reason.trim(),
        rejectedAt: serverTimestamp(),
      });
      setRejectModal(false);
    } catch (e) { Alert.alert('Error', e.message); }
    setActing(false);
  };

  const exportPDF = async () => {
    if (!quot) return;
    setExporting(true);
    try {
      const date = quot.createdAt?.toDate ? quot.createdAt.toDate() : new Date();
      const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const approvedStr = quot.approvedAt?.toDate
        ? quot.approvedAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';

      const rows = (quot.items || []).map((it, i) => `
        <tr style="background:${i % 2 === 0 ? '#0D1B2A' : '#0A1628'}">
          <td style="padding:10px 12px;color:#E2E8F0;font-size:12px">${it.description}</td>
          <td style="padding:10px 12px;color:#E2E8F0;font-size:12px;text-align:center">${it.qty}</td>
          <td style="padding:10px 12px;color:#E2E8F0;font-size:12px;text-align:center">${it.unit}</td>
          <td style="padding:10px 12px;color:#E2E8F0;font-size:12px">${it.supplier}</td>
          <td style="padding:10px 12px;color:#E2E8F0;font-size:12px;text-align:right">KES ${(parseFloat(it.unitPrice) || 0).toLocaleString()}</td>
          <td style="padding:10px 12px;color:#60A5FA;font-size:12px;font-weight:700;text-align:right">KES ${(it.total || 0).toLocaleString()}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#060E1C;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:800px;margin:0 auto;padding:32px}
  .hdr{background:#0F2D57;border-radius:12px;padding:28px 32px;margin-bottom:24px}
  .hdr-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
  .company{color:#60A5FA;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .prop{color:#FFFFFF;font-size:22px;font-weight:900;margin-top:4px}
  .ref-box{background:#1E3A5F;border-radius:8px;padding:12px 18px;text-align:right}
  .ref-lbl{color:#93C5FD;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .ref-val{color:#FFFFFF;font-size:16px;font-weight:900;margin-top:3px}
  .meta{display:flex;gap:16px;margin-top:8px}
  .meta-item{flex:1;background:#1E3A5F;border-radius:8px;padding:10px 14px}
  .meta-lbl{color:#93C5FD;font-size:9px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:3px}
  .meta-val{color:#FFFFFF;font-size:12px;font-weight:700}
  .status-badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
  .status-approved{background:#065F46;color:#D1FAE5}
  .status-pending{background:#92400E;color:#FEF3C7}
  .sec-hdr{color:#93C5FD;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:20px 0 10px}
  table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden}
  thead tr{background:#0F2D57}
  thead th{padding:10px 12px;color:#93C5FD;font-size:9px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;text-align:left}
  thead th:last-child,thead th:nth-child(5){text-align:right}
  thead th:nth-child(2),thead th:nth-child(3){text-align:center}
  .total-bar{background:#0F2D57;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:16px}
  .total-lbl{color:#93C5FD;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase}
  .total-amt{color:#FFFFFF;font-size:24px;font-weight:900}
  .terms{background:#0D1B2A;border-radius:10px;padding:16px 20px;margin-top:20px}
  .terms-hdr{color:#60A5FA;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px}
  .terms-item{color:#94A3B8;font-size:11px;line-height:1.6;margin-bottom:4px}
  .foot{display:flex;justify-content:space-between;align-items:center;margin-top:24px;padding-top:16px;border-top:1px solid #1E3A5F}
  .foot-left{color:#64748B;font-size:10px}
  .foot-right{color:#60A5FA;font-size:10px;font-weight:700;letter-spacing:0.5px}
  .approved-box{background:#065F46;border-radius:10px;padding:12px 20px;margin-top:16px;display:flex;justify-content:space-between}
  .approved-lbl{color:#D1FAE5;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase}
  .approved-val{color:#FFFFFF;font-size:12px;font-weight:700;margin-top:2px}
</style></head><body><div class="page">
  <div class="hdr">
    <div class="hdr-top">
      <div>
        <div class="company">QUOTATION</div>
        <div class="prop">${quot.propertyName}</div>
        <div style="margin-top:8px"><span class="status-badge status-${quot.status}">${quot.status.toUpperCase()}</span></div>
      </div>
      <div class="ref-box">
        <div class="ref-lbl">Reference No.</div>
        <div class="ref-val">${quot.refNumber}</div>
      </div>
    </div>
    <div class="meta">
      <div class="meta-item"><div class="meta-lbl">Date Issued</div><div class="meta-val">${dateStr}</div></div>
      <div class="meta-item"><div class="meta-lbl">Prepared By</div><div class="meta-val">${quot.createdByName}</div></div>
      <div class="meta-item"><div class="meta-lbl">Description</div><div class="meta-val">${quot.title}</div></div>
    </div>
  </div>

  <div class="sec-hdr">Bill of Quantities</div>
  <table>
    <thead><tr>
      <th style="width:30%">Description</th>
      <th style="width:8%">Qty</th>
      <th style="width:8%">Unit</th>
      <th style="width:22%">Supplier</th>
      <th style="width:16%">Unit Price</th>
      <th style="width:16%">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="total-bar">
    <div class="total-lbl">Grand Total</div>
    <div class="total-amt">KES ${(quot.grandTotal || 0).toLocaleString()}</div>
  </div>

  ${quot.status === 'approved' && approvedStr ? `
  <div class="approved-box">
    <div><div class="approved-lbl">Approved By</div><div class="approved-val">${quot.approvedByName || ''}</div></div>
    <div><div class="approved-lbl">Approved On</div><div class="approved-val">${approvedStr}</div></div>
  </div>` : ''}

  ${quot.notes ? `<div class="terms" style="margin-top:16px"><div class="terms-hdr">Notes</div><div class="terms-item">${quot.notes}</div></div>` : ''}

  <div class="terms">
    <div class="terms-hdr">Terms &amp; Conditions</div>
    <div class="terms-item">1. This quotation is valid for 30 days from the date of issue.</div>
    <div class="terms-item">2. All prices are inclusive of delivery to site unless otherwise stated.</div>
    <div class="terms-item">3. Work to commence only upon written approval from the property owner.</div>
    <div class="terms-item">4. Payment terms: 50% deposit upon approval, balance upon completion.</div>
    <div class="terms-item">5. Any variations to scope of work will require a revised quotation.</div>
  </div>

  <div class="foot">
    <div class="foot-left">Generated by PropFix &bull; ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
    <div class="foot-right">PROPFIX APP</div>
  </div>
</div></body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${quot.refNumber} · ${quot.propertyName} · ${quot.title}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) { Alert.alert('Error', e.message); }
    setExporting(false);
  };

  if (loading) return <View style={styles.safe}><ActivityIndicator style={{ marginTop: 60 }} color={colors.primaryMid} /></View>;
  if (!quot) return <View style={styles.safe}><Text style={{ padding: 24, color: colors.textSecondary }}>Quotation not found.</Text></View>;

  const statusC = STATUS_COLOR[quot.status] || STATUS_COLOR.pending;
  const date = quot.createdAt?.toDate ? quot.createdAt.toDate() : new Date();

  return (
    <View style={styles.safe}>
      <ScreenHeader title={quot.refNumber} subtitle={quot.propertyName} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Status + meta */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.title}>{quot.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: statusC.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusC.dot }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: statusC.text, textTransform: 'capitalize' }}>{quot.status}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            {[
              { label: 'Created', value: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
              { label: 'By', value: quot.createdByName },
              { label: 'Property', value: quot.propertyName },
            ].map(m => (
              <View key={m.label} style={styles.metaItem}>
                <Text style={styles.metaLabel}>{m.label}</Text>
                <Text style={styles.metaValue} numberOfLines={1}>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* BoQ Table */}
        <Text style={styles.sectionLabel}>BILL OF QUANTITIES</Text>
        <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          <View style={styles.thead}>
            {['Description', 'Qty', 'Unit', 'Supplier', 'Price', 'Total'].map(h => (
              <Text key={h} style={[styles.th, h === 'Description' ? { flex: 3 } : h === 'Supplier' ? { flex: 2 } : { flex: 1 }]}>{h}</Text>
            ))}
          </View>
          {(quot.items || []).map((it, i) => (
            <View key={i} style={[styles.trow, i % 2 === 1 && { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.td, { flex: 3 }]} numberOfLines={2}>{it.description}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{it.qty}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: 'center', color: colors.primaryMid }]}>{it.unit}</Text>
              <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{it.supplier}</Text>
              <Text style={[styles.td, { flex: 1 }]}>{(parseFloat(it.unitPrice) || 0).toLocaleString()}</Text>
              <Text style={[styles.td, { flex: 1, fontWeight: '700', color: colors.primaryMid }]}>{(it.total || 0).toLocaleString()}</Text>
            </View>
          ))}
          <View style={styles.totalBar}>
            <Text style={styles.totalLabel}>GRAND TOTAL</Text>
            <Text style={styles.totalAmt}>KES {(quot.grandTotal || 0).toLocaleString()}</Text>
          </View>
        </View>

        {/* Rejection reason */}
        {quot.status === 'rejected' && quot.rejectionReason && (
          <View style={[styles.card, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#991B1B', letterSpacing: 0.5, marginBottom: 4 }}>REJECTION REASON</Text>
            <Text style={{ fontSize: 13, color: '#7F1D1D' }}>{quot.rejectionReason}</Text>
          </View>
        )}

        {/* Notes */}
        {!!quot.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>{quot.notes}</Text>
          </View>
        )}

        {/* Actions */}
        {canApprove && quot.status === 'pending' && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.successMid, flex: 1 }]} onPress={approve} disabled={acting}>
              {acting ? <ActivityIndicator color="#fff" size="small" /> : <><MaterialIcons name="check" size={18} color="#fff" /><Text style={styles.actionTxt}>Approve</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.dangerMid, flex: 1 }]} onPress={() => setRejectModal(true)} disabled={acting}>
              <MaterialIcons name="close" size={18} color="#fff" />
              <Text style={styles.actionTxt}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {quot.status === 'approved' && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0F2D57', marginTop: 8 }]} onPress={exportPDF} disabled={exporting}>
            {exporting ? <ActivityIndicator color="#fff" size="small" /> : (
              <><MaterialIcons name="picture-as-pdf" size={18} color="#60A5FA" /><Text style={[styles.actionTxt, { color: '#60A5FA' }]}>Export PDF &amp; Share to Accountant</Text></>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Reject modal */}
      <Modal visible={rejectModal} transparent animationType="fade" onRequestClose={() => setRejectModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Reject Quotation</Text>
            <Text style={styles.modalSub}>Enter a reason so the caretaker can revise and resubmit.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for rejection..."
              placeholderTextColor={colors.textMuted}
              value={reason}
              onChangeText={setReason}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surfaceAlt, flex: 1 }]} onPress={() => setRejectModal(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.dangerMid, flex: 1 }]} onPress={reject} disabled={acting}>
                {acting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm Reject</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { ...card, padding: 14, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, flex: 1, marginRight: 8 },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 12, fontWeight: '600', color: colors.text },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  thead: { flexDirection: 'row', backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 8 },
  th: { fontSize: 9, fontWeight: '700', color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  trow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  td: { fontSize: 11, color: colors.text, flex: 1 },
  totalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F2D57', paddingHorizontal: 14, paddingVertical: 12 },
  totalLabel: { fontSize: 10, fontWeight: '700', color: '#93C5FD', letterSpacing: 0.5, textTransform: 'uppercase' },
  totalAmt: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  actionTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6 },
  modalSub: { fontSize: 13, color: colors.textSecondary, marginBottom: 14 },
  modalInput: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, minHeight: 80, textAlignVertical: 'top' },
  modalBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
