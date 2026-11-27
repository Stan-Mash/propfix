import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator,
  Linking, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import { usePortfolio } from '../../context/PortfolioContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import ScreenHeader from '../../components/ScreenHeader';
import MasterMeterSheet from '../../components/MasterMeterSheet';
import { colors, spacing, radius, card } from '../../theme';

// ---- constants ----
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();

// ---- helpers ----
const fmt = (n) => Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 });
const fmtDec = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKey = (m, y) => `${m}-${y}`;

function waterCharge(unit, waterRate) {
  const cons = Math.max(0, (unit.presentReading || 0) - (unit.prevReading || 0));
  const p = (unit.payables || []).find(x => x.type === 'metered_water' && x.enabled !== false);
  const rate = p ? (p.rate || waterRate || 65) : waterRate || 65;
  return { cons, rate, charge: cons * rate };
}

function computeStatement(unit, prop) {
  const payables = unit.payables || [];
  const lines = [];
  let subtotal = 0;

  payables.forEach(p => {
    if (!p.enabled && p.enabled !== undefined) return;
    if (p.type === 'metered_water') {
      const { cons, rate, charge } = waterCharge(unit, prop?.waterRate);
      lines.push({ id: p.id, label: `Water (${cons} units x KES ${rate})`, amount: charge, type: 'metered_water', cons, rate });
      subtotal += charge;
    } else if (p.type === 'fixed' && (p.amount || 0) > 0) {
      lines.push({ id: p.id, label: p.label, amount: p.amount, type: 'fixed' });
      subtotal += p.amount || 0;
    }
  });

  // Fallback for units without payables (legacy)
  if (payables.length === 0 && unit.rent > 0) {
    lines.push({ id: 'rent', label: 'Rent', amount: unit.rent, type: 'fixed' });
    subtotal += unit.rent;
    const { cons, rate, charge } = waterCharge(unit, prop?.waterRate);
    if (cons > 0) {
      lines.push({ id: 'water', label: `Water (${cons} units x KES ${rate})`, amount: charge, type: 'metered_water', cons, rate });
      subtotal += charge;
    }
  }

  const arrears = unit.arrears || 0;
  const total = subtotal + arrears;
  return { lines, subtotal, arrears, total };
}

// ---- Recon bar ----
function MasterMeterBar({ prop, units, onPress }) {
  if (!prop) return null;
  const masterConsumed = Math.max(0, (prop.masterMeterReading || 0) - (prop.lastMasterMeter || 0));
  const subTotal = (units || []).reduce((s, u) => s + Math.max(0, (u.presentReading || 0) - (u.prevReading || 0)), 0);
  const variance = masterConsumed - subTotal;
  const pct = masterConsumed > 0 ? (subTotal / masterConsumed) * 100 : 100;
  const hasLeak = variance > 0 && masterConsumed > 0 && (variance / masterConsumed) * 100 > 10;

  return (
    <TouchableOpacity style={s.reconCard} onPress={onPress} activeOpacity={0.8}>
      <View style={s.reconHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialIcons name="water-drop" size={14} color={hasLeak ? colors.dangerMid : colors.primaryMid} />
          <Text style={s.reconTitle}>Master Meter Reconciliation</Text>
        </View>
        <MaterialIcons name="open-in-new" size={14} color={colors.textMuted} />
      </View>

      <View style={s.reconStats}>
        <View style={s.reconStat}>
          <Text style={s.reconStatN}>{fmt(prop.lastMasterMeter)}</Text>
          <Text style={s.reconStatL}>Previous</Text>
        </View>
        <View style={s.reconStat}>
          <Text style={s.reconStatN}>{fmt(prop.masterMeterReading)}</Text>
          <Text style={s.reconStatL}>Current</Text>
        </View>
        <View style={s.reconStat}>
          <Text style={[s.reconStatN, { color: colors.primaryMid }]}>{fmt(masterConsumed)}</Text>
          <Text style={s.reconStatL}>Consumed</Text>
        </View>
        <View style={s.reconStat}>
          <Text style={[s.reconStatN, hasLeak && { color: colors.dangerMid }]}>{fmt(subTotal)}</Text>
          <Text style={s.reconStatL}>Sub-meters</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.min(100, pct)}%`, backgroundColor: hasLeak ? colors.dangerMid : colors.primaryMid }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={s.barLabel}>{pct.toFixed(1)}% accounted</Text>
        {variance > 0 ? (
          <Text style={[s.barLabel, hasLeak && { color: colors.dangerMid, fontWeight: '700' }]}>
            {hasLeak ? 'Leak alert: ' : 'Variance: '}{fmt(variance)} units ({masterConsumed > 0 ? ((variance/masterConsumed)*100).toFixed(1) : 0}%)
          </Text>
        ) : <Text style={[s.barLabel, { color: colors.successMid }]}>All units accounted</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ---- Statement card ----
function StatementCard({ unit, prop, monthK, paidTotal, payments, onLogPayment, onWhatsApp, onExportPDF, onRemovePayment }) {
  const [expanded, setExpanded] = useState(false);
  const [showPayHistory, setShowPayHistory] = useState(false);
  const stmt = useMemo(() => computeStatement(unit, prop), [unit, prop]);
  const paid = paidTotal || 0;
  const remaining = Math.max(0, stmt.total - paid);
  const isPaid = paid >= stmt.total && stmt.total > 0;
  const isVacant = !unit.tenant;
  const hasContact = !!unit.phone;

  if (isVacant && stmt.total === 0) return null;

  return (
    <View style={[s.stmtCard, isPaid && s.stmtCardPaid]}>
      {/* Header row */}
      <TouchableOpacity style={s.stmtHead} onPress={() => setExpanded(e => !e)} activeOpacity={0.75}>
        <View style={s.stmtHeadLeft}>
          <View style={s.unitBadge}><Text style={s.unitBadgeTxt}>{unit.unit}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.tenantName} numberOfLines={1}>{unit.tenant || 'Vacant'}</Text>
            {unit.phone ? <Text style={s.tenantPhone} numberOfLines={1}>{unit.phone}</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[s.statusBadge, isPaid ? s.statusPaid : s.statusDue]}>
            <Text style={[s.statusTxt, isPaid ? s.statusPaidTxt : s.statusDueTxt]}>
              {isPaid ? 'Paid' : remaining > 0 && paid > 0 ? `KES ${fmt(remaining)} left` : 'Outstanding'}
            </Text>
          </View>
          <Text style={[s.stmtTotal, !isPaid && { color: colors.text }]}>KES {fmt(stmt.total)}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={colors.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {expanded && (
        <View style={s.stmtBody}>
          {/* Payables lines */}
          {stmt.lines.map(line => (
            <View key={line.id} style={s.lineRow}>
              <Text style={s.lineLabel} numberOfLines={1}>{line.label}</Text>
              <Text style={s.lineAmt}>KES {fmt(line.amount)}</Text>
            </View>
          ))}
          {stmt.arrears > 0 && (
            <View style={[s.lineRow, s.lineRowArrears]}>
              <Text style={[s.lineLabel, { color: colors.dangerMid }]}>Outstanding Arrears</Text>
              <Text style={[s.lineAmt, { color: colors.dangerMid }]}>+ KES {fmt(stmt.arrears)}</Text>
            </View>
          )}
          <View style={s.totalLine}>
            <Text style={s.totalLabel}>TOTAL DUE</Text>
            <Text style={s.totalAmt}>KES {fmt(stmt.total)}</Text>
          </View>
          {paid > 0 && (
            <View style={[s.lineRow, { backgroundColor: colors.successBg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 }]}>
              <Text style={[s.lineLabel, { color: colors.successMid }]}>Paid this month</Text>
              <Text style={[s.lineAmt, { color: colors.successMid }]}>KES {fmt(paid)}</Text>
            </View>
          )}

          {/* Action row */}
          <View style={s.actionRow}>
            {hasContact && (
              <TouchableOpacity style={s.actionBtn} onPress={() => onWhatsApp(unit, stmt)}>
                <MaterialIcons name="send" size={14} color="#25D366" />
                <Text style={[s.actionTxt, { color: '#25D366' }]}>WhatsApp</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.actionBtn} onPress={() => onExportPDF(unit, stmt)}>
              <MaterialIcons name="picture-as-pdf" size={14} color={colors.primaryMid} />
              <Text style={[s.actionTxt, { color: colors.primaryMid }]}>PDF</Text>
            </TouchableOpacity>
            {stmt.total > 0 && (
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.successBg }]} onPress={() => onLogPayment(unit, stmt)}>
                <MaterialIcons name="check-circle" size={14} color={colors.successMid} />
                <Text style={[s.actionTxt, { color: colors.successMid }]}>Log Payment</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Payment history toggle */}
          {payments && payments.length > 0 && (
            <TouchableOpacity style={s.payHistoryToggle} onPress={() => setShowPayHistory(h => !h)}>
              <MaterialIcons name="history" size={13} color={colors.primaryMid} />
              <Text style={s.payHistoryToggleTxt}>{payments.length} payment{payments.length !== 1 ? 's' : ''} this month</Text>
              <MaterialIcons name={showPayHistory ? 'expand-less' : 'expand-more'} size={14} color={colors.primaryMid} />
            </TouchableOpacity>
          )}
          {showPayHistory && payments && payments.map(pay => (
            <View key={pay.id} style={s.payRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.payAmt}>KES {fmt(pay.amount)}</Text>
                <Text style={s.payMeta}>{pay.paidAt}{pay.mpesaRef ? ` · ${pay.mpesaRef}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => onRemovePayment(unit, pay.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="delete-outline" size={16} color={colors.dangerMid} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---- Payment modal ----
function PaymentModal({ visible, unit, stmt, onClose, onConfirm }) {
  const [amount, setAmount] = useState('');
  const [mpesaRef, setMpesaRef] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount', 'Enter a valid payment amount.'); return; }
    setLoading(true);
    await onConfirm({ amount: amt, mpesaRef });
    setLoading(false);
    setAmount('');
    setMpesaRef('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Log M-Pesa Payment</Text>
              <TouchableOpacity onPress={onClose} style={s.modalClose}>
                <MaterialIcons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {unit && (
              <View style={s.modalMeta}>
                <Text style={s.modalMetaTxt}>Unit: <Text style={{ fontWeight: '800', color: colors.text }}>{unit.unit}</Text></Text>
                <Text style={s.modalMetaTxt}>Tenant: <Text style={{ fontWeight: '700', color: colors.text }}>{unit.tenant || 'Vacant'}</Text></Text>
                <Text style={s.modalMetaTxt}>Total Due: <Text style={{ fontWeight: '800', color: colors.dangerMid }}>KES {fmt(stmt?.total)}</Text></Text>
              </View>
            )}
            <Text style={s.modalLabel}>Amount Received (KES)</Text>
            <TextInput
              style={s.modalInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder={stmt ? String(Math.round(stmt.total)) : '0'}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={s.modalLabel}>M-Pesa Ref (optional)</Text>
            <TextInput
              style={s.modalInput}
              value={mpesaRef}
              onChangeText={v => setMpesaRef(v.toUpperCase())}
              placeholder="e.g. QB7K3LM4TZ"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={onClose}>
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirm, loading && { opacity: 0.6 }]} onPress={handleConfirm} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <MaterialIcons name="check" size={16} color="#fff" />
                    <Text style={s.modalConfirmTxt}>Confirm Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---- Main screen ----
export default function StatementScreen({ navigation }) {
  const { properties, units: allUnits, getVariance, logPayment, removePayment, rollArrears, paymentsFor, paidTotal: getPaidTotal } = usePortfolio();
  const { settings } = useAppSettings();

  const [selectedPropId, setSelectedPropId] = useState(properties[0]?.id || '');
  const [month, setMonth] = useState(MONTHS[now.getMonth()]);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showMasterMeter, setShowMasterMeter] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null); // { unit, stmt }
  const [expandAll, setExpandAll] = useState(false);

  const prop = properties.find(p => p.id === selectedPropId);
  const units = useMemo(() => allUnits[selectedPropId] || [], [allUnits, selectedPropId]);
  const mk = monthKey(month, year);

  const paybill = settings.mpesaPaybill || settings.paybill || prop?.paybill || '';

  const stats = useMemo(() => {
    let totalDue = 0, totalPaid = 0, paidCount = 0, pendingCount = 0;
    units.forEach(u => {
      const stmt = computeStatement(u, prop);
      if (stmt.total <= 0 && !u.tenant) return;
      totalDue += stmt.total;
      const paid = getPaidTotal(selectedPropId, u.id, mk);
      totalPaid += paid;
      if (paid >= stmt.total && stmt.total > 0) paidCount++;
      else pendingCount++;
    });
    return { totalDue, totalPaid, paidCount, pendingCount, collection: totalDue > 0 ? (totalPaid / totalDue) * 100 : 0 };
  }, [units, prop, selectedPropId, mk, getPaidTotal]);

  const whatsApp = useCallback((unit, stmt) => {
    const lines = stmt.lines.map(l => `${l.label}: KES ${fmt(l.amount)}`).join('\n');
    const arrLine = stmt.arrears > 0 ? `\nOutstanding Arrears: KES ${fmt(stmt.arrears)}` : '';
    const paybillLine = paybill ? `\n\nPay via M-Pesa:\nPaybill: ${paybill}\nAccount: ${unit.unit}\nAmount: KES ${fmt(stmt.total)}` : '';
    const text = `*MONTHLY STATEMENT - ${month.toUpperCase()} ${year}*\n${prop?.name || ''}\nUnit: ${unit.unit}\nTenant: ${unit.tenant || '-'}\n\n*CHARGES:*\n${lines}${arrLine}\n${'─'.repeat(28)}\n*TOTAL DUE: KES ${fmt(stmt.total)}*${paybillLine}\n\nGenerated by PropFix App`;
    if (unit.phone) {
      const phone = unit.phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
      if (/^\d{7,}$/.test(phone)) {
        const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
        Linking.canOpenURL(url).then(ok => {
          if (ok) Linking.openURL(url).catch(() => {});
          else Alert.alert('WhatsApp not installed', text);
        }).catch(() => Alert.alert('WhatsApp', text));
        return;
      }
    }
    Alert.alert('No phone number', 'Add a phone number for this tenant to send via WhatsApp.');
  }, [prop, month, year, paybill]);

  const exportPDF = useCallback(async (unit, stmt) => {
    const ref = `${(prop?.name || 'PROP').replace(/\s+/g, '').substring(0, 3).toUpperCase()}-${(unit.unit || '').replace(/\s+/g, '')}-${month.substring(0, 3).toUpperCase()}${year.slice(-2)}`;
    const monthIdx = MONTHS.indexOf(month);
    const dueMonth = MONTHS[(monthIdx + 1) % 12];
    const dueYear = monthIdx === 11 ? String(parseInt(year, 10) + 1) : year;
    const genDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const company = settings.companyName || 'PropFix';

    const lineRows = stmt.lines.map(l =>
      `<tr><td>${l.label}</td><td class="num">KES ${fmt(l.amount)}</td></tr>`
    ).join('');
    const arrearsRow = stmt.arrears > 0
      ? `<tr class="arr-row"><td>Outstanding Arrears</td><td class="num arr">+ KES ${fmt(stmt.arrears)}</td></tr>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#0B1320;padding:8mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .bill{max-width:160mm;margin:0 auto;border:1px solid #E4E7EC;border-radius:10px;overflow:hidden}
      .hdr{background:#0B1320;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start}
      .hdr-prop{color:#fff;font-size:16px;font-weight:800}
      .hdr-mgd{color:#93C5FD;font-size:9px;text-transform:uppercase;letter-spacing:.6px;margin-top:3px}
      .due-box{border:1.5px solid rgba(255,255,255,.3);border-radius:8px;padding:8px 14px;text-align:right}
      .due-lbl{color:#93C5FD;font-size:8px;text-transform:uppercase;letter-spacing:.5px}
      .due-amt{color:#fff;font-size:20px;font-weight:900;margin-top:3px}
      .meta{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #E4E7EC}
      .mc{padding:12px 16px;border-right:1px solid #E4E7EC}
      .mc:last-child{border-right:none}
      .mc-l{color:#1D4ED8;font-size:8px;text-transform:uppercase;letter-spacing:.5px}
      .mc-v{color:#0B1320;font-size:11px;font-weight:700;margin-top:4px}
      .tgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px 16px;border-bottom:1px solid #E4E7EC}
      .tc{background:#F6F7F9;border:1px solid #E4E7EC;border-radius:6px;padding:10px 12px}
      .tc-l{color:#64748B;font-size:7.5px;text-transform:uppercase;letter-spacing:.5px}
      .tc-v{color:#0B1320;font-size:11px;font-weight:700;margin-top:4px}
      .sec-hdr{color:#1D4ED8;font-size:8px;text-transform:uppercase;letter-spacing:.7px;padding:12px 16px 6px}
      .chg-tbl{width:100%;border-collapse:collapse;padding:0 16px;margin-bottom:0}
      .chg-tbl td{padding:9px 16px;border-bottom:1px solid #E4E7EC;font-size:10px;color:#374151}
      .chg-tbl td.num{text-align:right;font-weight:600;color:#0B1320}
      .arr-row td{color:#B91C1C}
      .arr-row td.arr{color:#B91C1C;font-weight:700}
      .total-bar{background:#0B1320;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
      .tl-lbl{color:#93C5FD;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
      .tl-amt{color:#fff;font-size:22px;font-weight:900}
      .mpesa-hdr{background:#F6F7F9;padding:7px 16px;color:#1D4ED8;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;border-top:1px solid #E4E7EC}
      .mpesa-steps{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid #E4E7EC}
      .ms{padding:10px;text-align:center;border-right:1px solid #E4E7EC;background:#F6F7F9}
      .ms:last-child{border-right:none}
      .ms-step{color:#1D4ED8;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
      .ms-desc{color:#64748B;font-size:7px;margin-top:2px}
      .ms-val{color:#0B1320;font-size:12px;font-weight:900;margin-top:3px}
      .foot{display:flex;justify-content:space-between;align-items:flex-end;padding:10px 16px;border-top:1px solid #E4E7EC;background:#F6F7F9;font-size:8px;color:#64748B}
    </style></head><body>
      <div class="bill">
        <div class="hdr">
          <div><div class="hdr-prop">${prop?.name || company}</div><div class="hdr-mgd">Managed by ${company}</div></div>
          <div class="due-box"><div class="due-lbl">TOTAL DUE</div><div class="due-amt">KES ${fmt(stmt.total)}</div></div>
        </div>
        <div class="meta">
          <div class="mc"><div class="mc-l">BILL PERIOD</div><div class="mc-v">${month} ${year}</div></div>
          <div class="mc"><div class="mc-l">DUE DATE</div><div class="mc-v">${settings.billingDueDay || prop?.billingDueDay || 15} ${dueMonth} ${dueYear}</div></div>
          <div class="mc"><div class="mc-l">REFERENCE</div><div class="mc-v">${ref}</div></div>
        </div>
        <div class="sec-hdr">TENANT DETAILS</div>
        <div class="tgrid">
          <div class="tc"><div class="tc-l">TENANT NAME</div><div class="tc-v">${unit.tenant || '-'}</div></div>
          <div class="tc"><div class="tc-l">UNIT / FLAT</div><div class="tc-v">${unit.unit}</div></div>
          <div class="tc"><div class="tc-l">PROPERTY</div><div class="tc-v">${prop?.name || '-'}</div></div>
          <div class="tc"><div class="tc-l">BILLING PERIOD</div><div class="tc-v">${month} ${year}</div></div>
        </div>
        <div class="sec-hdr">CHARGES BREAKDOWN</div>
        <table class="chg-tbl">
          ${lineRows}
          ${arrearsRow}
        </table>
        <div class="total-bar">
          <span class="tl-lbl">Total Amount Due</span>
          <span class="tl-amt">KES ${fmt(stmt.total)}</span>
        </div>
        ${paybill ? `
        <div class="mpesa-hdr">Pay via M-Pesa Paybill</div>
        <div class="mpesa-steps">
          <div class="ms"><div class="ms-step">STEP 1</div><div class="ms-desc">Paybill Number</div><div class="ms-val">${paybill}</div></div>
          <div class="ms"><div class="ms-step">STEP 2</div><div class="ms-desc">Account Number</div><div class="ms-val">${unit.unit}</div></div>
          <div class="ms"><div class="ms-step">STEP 3</div><div class="ms-desc">Amount (KES)</div><div class="ms-val">${fmt(stmt.total)}</div></div>
        </div>` : ''}
        <div class="foot">
          <span>${settings.companyName || 'PropFix'} · ${genDate} · PropFix App</span>
          <span>Ref: ${ref}</span>
        </div>
      </div>
    </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Statement · ${unit.unit} · ${month} ${year}`, UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert('PDF Error', e.message);
    }
  }, [prop, month, year, settings, paybill]);

  const exportAllPDF = useCallback(async () => {
    const company = settings.companyName || 'PropFix';
    const monthIdx = MONTHS.indexOf(month);
    const dueMonth = MONTHS[(monthIdx + 1) % 12];
    const dueYear = monthIdx === 11 ? String(parseInt(year, 10) + 1) : year;
    const genDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const slipRows = units.map(unit => {
      const stmt = computeStatement(unit, prop);
      if (!unit.tenant && stmt.total === 0) return '';
      const ref = `${(prop?.name || 'P').replace(/\s+/g,''). substring(0,3).toUpperCase()}-${unit.unit.replace(/\s+/g,'')}-${month.substring(0,3).toUpperCase()}${year.slice(-2)}`;
      const lineRows2 = stmt.lines.map(l =>
        `<tr><td>${l.label}</td><td class="num">KES ${fmt(l.amount)}</td></tr>`
      ).join('');
      const arrearsRow2 = stmt.arrears > 0 ? `<tr class="arr-row"><td>Arrears</td><td class="num arr">+ KES ${fmt(stmt.arrears)}</td></tr>` : '';
      return `<div class="slip">
        <div class="sh"><div><div class="sh-co">${company}</div><div class="sh-ty">${month.toUpperCase()} ${year} · Monthly Statement</div></div>
        <div class="sh-due"><div class="sh-dl">TOTAL DUE</div><div class="sh-da">KES ${fmt(stmt.total)}</div></div></div>
        <div class="ref">${ref} · Due: ${settings.billingDueDay || prop?.billingDueDay || 15} ${dueMonth} ${dueYear}</div>
        <div class="info"><span>Unit: <b>${unit.unit}</b></span><span>Tenant: <b>${unit.tenant || '-'}</b></span><span>${prop?.name || ''}</span></div>
        <table class="ct"><thead><tr><th>Charge</th><th class="num">Amount</th></tr></thead>
        <tbody>${lineRows2}${arrearsRow2}</tbody></table>
        <div class="tot"><span>TOTAL DUE</span><span>KES ${fmt(stmt.total)}</span></div>
        ${paybill ? `<div class="mp"><span>M-Pesa Paybill: <b>${paybill}</b></span><span>Account: <b>${unit.unit}</b></span><span>Amount: <b>KES ${fmt(stmt.total)}</b></span></div>` : ''}
      </div>`;
    }).filter(Boolean);

    if (slipRows.length === 0) { Alert.alert('No units', 'No occupied units found.'); return; }

    const slipCss = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff;color:#0B1320;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .page{width:210mm;min-height:297mm;padding:8mm;page-break-after:always;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;gap:5mm;align-content:start}
      .slip{border:1px solid #E4E7EC;border-radius:6px;overflow:hidden;background:#fff}
      .sh{background:#0B1320;padding:9px 10px;display:flex;justify-content:space-between;align-items:flex-start}
      .sh-co{color:#fff;font-size:9px;font-weight:700}.sh-ty{color:#93C5FD;font-size:7px;margin-top:2px;text-transform:uppercase;letter-spacing:.4px}
      .sh-due{text-align:right}.sh-dl{color:#93C5FD;font-size:7px;text-transform:uppercase;letter-spacing:.4px}.sh-da{color:#fff;font-size:11px;font-weight:800;margin-top:1px}
      .ref{padding:4px 10px;font-size:7px;color:#64748B;background:#F6F7F9;border-bottom:1px solid #E4E7EC}
      .info{display:flex;gap:8px;padding:5px 10px;font-size:7.5px;border-bottom:1px solid #E4E7EC;color:#374151}
      .ct{width:100%;border-collapse:collapse;font-size:8px}
      .ct thead{background:#F6F7F9}.ct th{padding:4px 10px;font-size:7px;color:#64748B;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid #E4E7EC}
      .ct th.num{text-align:right}.ct td{padding:5px 10px;border-bottom:1px solid #E4E7EC;color:#374151}.ct td.num{text-align:right;font-weight:600}
      .arr-row td{color:#B91C1C}.arr-row td.arr{font-weight:700}
      .tot{background:#0B1320;padding:7px 10px;display:flex;justify-content:space-between;align-items:center;font-size:9px;font-weight:700;color:#fff}
      .mp{display:flex;gap:8px;padding:5px 10px;font-size:7.5px;color:#374151;border-top:1px solid #E4E7EC;background:#F6F7F9}
      @media print{.page{page-break-after:always}}`;

    // Group into pages of 4
    const pages = [];
    for (let i = 0; i < slipRows.length; i += 4) {
      pages.push(`<div class="page">${slipRows.slice(i, i + 4).join('')}</div>`);
    }

    const sumRows = units.map(u => {
      const stmt = computeStatement(u, prop);
      if (!u.tenant && stmt.total === 0) return '';
      const paid = getPaidTotal(selectedPropId, u.id, mk);
      const isPaid = paid >= stmt.total && stmt.total > 0;
      return `<tr><td class="unit">${u.unit}</td><td>${u.tenant || '-'}</td>
        ${stmt.lines.map(l => `<td class="num">${fmt(l.amount)}</td>`).join('')}
        <td class="num ${stmt.arrears > 0 ? 'arr' : ''}">${stmt.arrears > 0 ? fmt(stmt.arrears) : '-'}</td>
        <td class="num bold">KES ${fmt(stmt.total)}</td>
        <td><span class="badge ${isPaid ? 'paid' : 'due'}">${isPaid ? 'PAID' : 'DUE'}</span></td></tr>`;
    }).filter(Boolean);

    const maxPayableCols = Math.max(...units.map(u => computeStatement(u, prop).lines.length));
    const headerLabels = units.length > 0 ? computeStatement(units[0], prop).lines.map(l => {
      const short = l.label.split('(')[0].trim();
      return `<th class="num">${short}</th>`;
    }).join('') : '';

    const summaryPage = `<div class="sum-page">
      <div class="sum-hdr"><div><div class="sum-prop">${prop?.name || company} - ${month} ${year}</div>
      <div class="sum-sub">Monthly Statement Summary - ${company}</div></div>
      <div class="sum-total"><div class="st-lbl">TOTAL BILLED</div><div class="st-amt">KES ${fmt(stats.totalDue)}</div></div></div>
      <div class="sum-stats">
        <div class="ss"><div class="ss-n">${units.filter(u => u.tenant).length}</div><div class="ss-l">OCCUPIED</div></div>
        <div class="ss"><div class="ss-n">${stats.paidCount}</div><div class="ss-l">PAID</div></div>
        <div class="ss"><div class="ss-n">${stats.pendingCount}</div><div class="ss-l">OUTSTANDING</div></div>
        <div class="ss ${stats.collection >= 80 ? '' : 'warn'}"><div class="ss-n ${stats.collection >= 80 ? '' : 'warn'}">${stats.collection.toFixed(0)}%</div><div class="ss-l">COLLECTION</div></div>
      </div>
      <table class="sum-tbl"><thead><tr><th>UNIT</th><th>TENANT</th>${headerLabels}<th class="num">ARREARS</th><th class="num">TOTAL</th><th>STATUS</th></tr></thead>
      <tbody>${sumRows.join('')}<tr class="totals"><td colspan="2"><b>TOTALS</b></td>
        <td class="num bold" colspan="${maxPayableCols + 1}">KES ${fmt(stats.totalDue)}</td>
        <td></td></tr></tbody></table>
      <div class="sum-foot"><span>${company} · ${prop?.name || ''} · ${month} ${year} · Generated ${genDate}</span>
      ${paybill ? `<span>Paybill: ${paybill}</span>` : ''}</div>
    </div>`;

    const sumCss = `.sum-page{width:210mm;min-height:297mm;padding:10mm;background:#fff}
      .sum-hdr{background:#0B1320;padding:14px 18px;border-radius:8px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
      .sum-prop{color:#fff;font-size:14px;font-weight:800}.sum-sub{color:#93C5FD;font-size:8px;text-transform:uppercase;letter-spacing:.6px;margin-top:4px}
      .sum-total{border:1.5px solid rgba(255,255,255,.3);border-radius:8px;padding:8px 14px;text-align:right}
      .st-lbl{color:#93C5FD;font-size:7px;text-transform:uppercase;letter-spacing:.5px}.st-amt{color:#fff;font-size:16px;font-weight:900;margin-top:3px}
      .sum-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
      .ss{background:#fff;border:1px solid #E4E7EC;border-radius:6px;padding:10px;text-align:center}
      .ss-n{font-size:16px;font-weight:800;color:#1D4ED8}.ss-n.warn{color:#B45309}.ss.warn{background:#FFFBEB;border-color:#D97706}
      .ss-l{font-size:7px;text-transform:uppercase;letter-spacing:.5px;color:#64748B;margin-top:2px}
      .sum-tbl{width:100%;border-collapse:collapse;font-size:9px}
      .sum-tbl thead{background:#F6F7F9}.sum-tbl th{padding:7px 10px;text-align:left;color:#1D4ED8;font-size:7.5px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #E4E7EC}
      .sum-tbl th.num,.sum-tbl td.num{text-align:right}.sum-tbl td{padding:7px 10px;border-bottom:1px solid #E4E7EC;color:#374151}
      .sum-tbl td.unit{font-weight:800;color:#1D4ED8}.sum-tbl td.bold{font-weight:700;color:#0B1320}.sum-tbl td.arr{color:#B91C1C;font-weight:700}
      .sum-tbl tr:nth-child(even) td{background:#F6F7F9}.totals td{background:#0B1320!important;color:#93C5FD;font-weight:700}
      .badge{font-size:7px;font-weight:800;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:.4px}
      .badge.paid{background:#DCFCE7;color:#15803D;border:1px solid #86EFAC}.badge.due{background:#FEE2E2;color:#991B1B;border:1px solid #FECACA}
      .sum-foot{display:flex;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid #E4E7EC;font-size:8px;color:#64748B}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${slipCss}${sumCss}</style></head><body>${pages.join('')}${summaryPage}</body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Statements · ${prop?.name || ''} · ${month} ${year}`, UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert('PDF Error', e.message);
    }
  }, [units, prop, month, year, settings, paybill, stats, selectedPropId, mk, getPaidTotal]);

  const handleLogPayment = useCallback(async (data) => {
    if (!paymentTarget) return;
    logPayment(selectedPropId, paymentTarget.unit.id, mk, data);
    Alert.alert('Payment logged', `KES ${fmt(data.amount)} recorded for ${paymentTarget.unit.unit}.`);
  }, [paymentTarget, selectedPropId, mk, logPayment]);

  if (properties.length === 0) {
    return (
      <View style={s.root}>
        <ScreenHeader title="Monthly Statements" subtitle="Billing engine" />
        <View style={s.empty}>
          <MaterialIcons name="apartment" size={44} color={colors.borderStrong} />
          <Text style={s.emptyTxt}>No properties yet</Text>
          <Text style={s.emptySub}>Add a property in the Portfolio tab to generate statements.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Monthly Statements"
        subtitle={prop ? `${prop.name} · ${month} ${year}` : 'Select a property'}
        rightAction={
          <TouchableOpacity style={s.monthBtn} onPress={() => setShowMonthModal(true)}>
            <MaterialIcons name="date-range" size={13} color={colors.primaryMid} />
            <Text style={s.monthBtnTxt}>{month.substring(0, 3)} {year}</Text>
            <MaterialIcons name="expand-more" size={13} color={colors.primaryMid} />
          </TouchableOpacity>
        }
      />

      {/* Property chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.propChips} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, paddingVertical: 10 }}>
        {properties.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[s.propChip, selectedPropId === p.id && s.propChipActive]}
            onPress={() => setSelectedPropId(p.id)}
          >
            <Text style={[s.propChipTxt, selectedPropId === p.id && s.propChipTxtActive]} numberOfLines={1}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats strip */}
      {prop && (
        <View style={s.statsStrip}>
          <View style={s.statCell}>
            <Text style={s.statN}>KES {fmt(stats.totalDue)}</Text>
            <Text style={s.statL}>Total Billed</Text>
          </View>
          <View style={s.statCell}>
            <Text style={[s.statN, { color: colors.successMid }]}>KES {fmt(stats.totalPaid)}</Text>
            <Text style={s.statL}>Collected</Text>
          </View>
          <View style={s.statCell}>
            <Text style={[s.statN, { color: colors.primaryMid }]}>{stats.paidCount}/{stats.paidCount + stats.pendingCount}</Text>
            <Text style={s.statL}>Units Paid</Text>
          </View>
          <View style={s.statCell}>
            <Text style={[s.statN, stats.collection < 80 && { color: colors.warningMid }]}>{stats.collection.toFixed(0)}%</Text>
            <Text style={s.statL}>Collection</Text>
          </View>
        </View>
      )}

      <FlatList
        data={units}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          prop ? (
            <MasterMeterBar
              prop={prop}
              units={units}
              onPress={() => setShowMasterMeter(true)}
            />
          ) : null
        }
        renderItem={({ item: unit }) => (
          <StatementCard
            unit={unit}
            prop={prop}
            monthK={mk}
            paidTotal={getPaidTotal(selectedPropId, unit.id, mk)}
            payments={paymentsFor(selectedPropId, unit.id, mk)}
            onLogPayment={(u, stmt) => setPaymentTarget({ unit: u, stmt })}
            onWhatsApp={whatsApp}
            onExportPDF={exportPDF}
            onRemovePayment={(u, payId) => {
              Alert.alert('Remove payment?', 'This will delete this payment record.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removePayment(selectedPropId, u.id, mk, payId) },
              ]);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialIcons name="inbox" size={40} color={colors.borderStrong} />
            <Text style={s.emptyTxt}>No units in this property</Text>
            <Text style={s.emptySub}>Add units in the Portfolio tab.</Text>
          </View>
        }
      />

      {/* Sticky bottom bar */}
      {units.length > 0 && (
        <View style={s.stickyBar}>
          <TouchableOpacity style={s.stickyBtn} onPress={exportAllPDF}>
            <MaterialIcons name="picture-as-pdf" size={16} color="#fff" />
            <Text style={s.stickyBtnTxt}>Export All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.stickyBtn, { backgroundColor: colors.warningMid }]}
            onPress={() => {
              Alert.alert(
                `Roll Arrears: ${month} ${year}`,
                'Unpaid balances for this month will be carried forward as arrears on each unit. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Roll Arrears', style: 'destructive', onPress: () => {
                    const count = rollArrears(selectedPropId, mk);
                    Alert.alert('Done', count > 0 ? `Arrears updated for ${count} unit${count !== 1 ? 's' : ''}.` : 'All units are fully paid — no arrears to roll.');
                  }},
                ]
              );
            }}
          >
            <MaterialIcons name="update" size={16} color="#fff" />
            <Text style={s.stickyBtnTxt}>Roll Arrears</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.stickyBtn, { backgroundColor: '#25D366' }]}
            onPress={() => {
              const unitsWithPhone = units.filter(u => u.phone && u.tenant);
              if (unitsWithPhone.length === 0) { Alert.alert('No contacts', 'No tenants with phone numbers found.'); return; }
              Alert.alert(
                `Send to ${unitsWithPhone.length} tenants?`,
                'This will open WhatsApp for each tenant one by one.',
                [{ text: 'Cancel', style: 'cancel' }, { text: 'Send', onPress: () => { unitsWithPhone.forEach((u, i) => setTimeout(() => { const stmt = computeStatement(u, prop); whatsApp(u, stmt); }, i * 1200)); } }]
              );
            }}
          >
            <MaterialIcons name="send" size={16} color="#fff" />
            <Text style={s.stickyBtnTxt}>Send to All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Month picker modal */}
      <Modal visible={showMonthModal} transparent animationType="slide" onRequestClose={() => setShowMonthModal(false)}>
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setShowMonthModal(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Select Month</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: spacing.md }}>
              {MONTHS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.moPill, m === month && s.moPillActive]}
                  onPress={() => { setMonth(m); setShowMonthModal(false); }}
                >
                  <Text style={[s.moPillTxt, m === month && s.moPillTxtActive]}>{m.substring(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ paddingHorizontal: spacing.md, paddingBottom: 20 }}>
              <Text style={s.fieldLabel}>Year</Text>
              <TextInput
                style={s.yearInput}
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="2026"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <PaymentModal
        visible={!!paymentTarget}
        unit={paymentTarget?.unit}
        stmt={paymentTarget?.stmt}
        onClose={() => setPaymentTarget(null)}
        onConfirm={handleLogPayment}
      />

      <MasterMeterSheet
        propertyId={selectedPropId}
        visible={showMasterMeter}
        onClose={() => setShowMasterMeter(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Property chips
  propChips: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 },
  propChip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, maxWidth: 180 },
  propChipActive: { backgroundColor: colors.primaryMid, borderColor: colors.primaryMid },
  propChipTxt: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  propChipTxtActive: { color: '#fff' },

  // Stats strip
  statsStrip: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRightWidth: 1, borderRightColor: colors.border },
  statN: { fontSize: 13, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  statL: { fontSize: 9, fontWeight: '600', color: colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Recon bar
  reconCard: { ...card, padding: 14, marginBottom: 14 },
  reconHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  reconTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
  reconStats: { flexDirection: 'row', marginBottom: 10 },
  reconStat: { flex: 1, alignItems: 'center' },
  reconStatN: { fontSize: 15, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  reconStatL: { fontSize: 9, fontWeight: '600', color: colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  barTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },

  // Statement card
  stmtCard: { ...card, padding: 0, marginBottom: 10, overflow: 'hidden' },
  stmtCardPaid: { opacity: 0.8 },
  stmtHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 4 },
  stmtHeadLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  unitBadge: { backgroundColor: colors.primaryXLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, minWidth: 44, alignItems: 'center' },
  unitBadgeTxt: { fontSize: 13, fontWeight: '800', color: colors.primaryMid },
  tenantName: { fontSize: 14, fontWeight: '700', color: colors.text },
  tenantPhone: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusPaid: { backgroundColor: colors.successBg },
  statusDue: { backgroundColor: colors.dangerBg },
  statusTxt: { fontSize: 10, fontWeight: '700' },
  statusPaidTxt: { color: colors.successMid },
  statusDueTxt: { color: colors.dangerMid },
  stmtTotal: { fontSize: 15, fontWeight: '800', color: colors.dangerMid, fontVariant: ['tabular-nums'] },

  // Statement body
  stmtBody: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8 },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  lineRowArrears: { borderBottomWidth: 0 },
  lineLabel: { flex: 1, fontSize: 13, color: colors.textSecondary },
  lineAmt: { fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  totalLine: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B1320', marginHorizontal: -14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  totalLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalAmt: { fontSize: 17, fontWeight: '900', color: '#fff', fontVariant: ['tabular-nums'] },

  // Actions
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, flex: 1, justifyContent: 'center' },
  actionTxt: { fontSize: 12, fontWeight: '700', color: colors.text },

  // Month picker
  monthBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryXLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.primaryLight },
  monthBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.primaryMid },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginVertical: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.md, marginBottom: 4 },
  moPill: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  moPillActive: { backgroundColor: colors.primaryMid, borderColor: colors.primaryMid },
  moPillTxt: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  moPillTxtActive: { color: '#fff' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  yearInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, backgroundColor: colors.inputBg },

  // Payment modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.md, paddingBottom: 32 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalClose: { backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 6 },
  modalMeta: { backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 14, gap: 4 },
  modalMetaTxt: { fontSize: 13, color: colors.textSecondary },
  modalLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  modalInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.text, backgroundColor: colors.inputBg },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14 },
  modalCancelTxt: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  modalConfirm: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.successMid, borderRadius: radius.md, paddingVertical: 14 },
  modalConfirmTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Payment history
  payHistoryToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  payHistoryToggleTxt: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.primaryMid },
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  payAmt: { fontSize: 13, fontWeight: '800', color: colors.successMid, fontVariant: ['tabular-nums'] },
  payMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Sticky bar
  stickyBar: { flexDirection: 'row', gap: 10, padding: spacing.md, paddingBottom: 24, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  stickyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.primaryMid, borderRadius: radius.md, paddingVertical: 14 },
  stickyBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.md, gap: 10 },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  surfaceAlt: colors.surfaceAlt,
});
