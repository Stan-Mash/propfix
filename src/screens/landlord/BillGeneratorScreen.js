import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput, Share, Linking, Alert,
  Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow, card, accent } from '../../theme';
import { UNIT_COST_PER_M3 } from '../../data/seed';
import { usePortfolio } from '../../context/PortfolioContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { logAudit } from '../../utils/auditLog';
import ScreenHeader from '../../components/ScreenHeader';
import PhotoPicker from '../../components/PhotoPicker';
import TenantSheet from '../../components/TenantSheet';
import MasterMeterSheet from '../../components/MasterMeterSheet';

const BILL_TYPES = ['WATER BILL', 'ELECTRICITY BILL', 'SERVICE CHARGE', 'RENT BILL', 'GARBAGE BILL'];
const CURRENCIES = ['KES', 'USD', 'UGX', 'TZS', 'ZAR', 'NGN', 'GHS'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

let rowCounter = 0;
const newRow = (flat = '') => ({ id: String(rowCounter++), flat, tenantName: '', contact: '', prev: '', pres: '', arrears: '', fromSeed: false });

function calcRow(row, unitCost) {
  const prev = parseFloat(row.prev) || 0;
  const pres = parseFloat(row.pres) || 0;
  const cons = Math.max(0, pres - prev);
  const arr = parseFloat(row.arrears) || 0;
  const uc = parseFloat(unitCost) || 0;
  return { prev, pres, cons, total: cons * uc + arr, isPrevError: pres > 0 && prev > 0 && pres < prev };
}

function SlipRow({ label, value, total, danger }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: total ? '#1E293B' : undefined }}>
      <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: total ? '#94A3B8' : colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</Text>
      <Text style={{ fontSize: total ? 15 : 13, fontWeight: total ? '900' : '700', color: total ? '#FFFFFF' : danger ? colors.dangerMid : colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function PickerModal({ visible, onClose, options, onSelect, selected }) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent hardwareAccelerated onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          {options.map(opt => (
            <TouchableOpacity key={opt} style={styles.pickerOption} onPress={() => { onSelect(opt); onClose(); }}>
              <Text style={[styles.pickerOptionText, opt === selected && styles.pickerSelected]}>{opt}</Text>
              {opt === selected && <MaterialIcons name="check" size={18} color={colors.primaryMid} />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function LockedField({ label, value, danger }) {
  return (
    <View style={styles.lockRow}>
      <Text style={styles.lockLabel}>{label}</Text>
      <Text style={[styles.lockValue, danger && { color: colors.dangerMid }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function BillGeneratorScreen({ navigation }) {
  const { settings } = useAppSettings();
  const { userProfile } = useAuth();
  // Caretakers get a meter walk-sheet: tenant and billing fields are locked, only this month's reading is entered
  const isCaretaker = userProfile?.role === 'caretaker';
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('billing');
  const now = new Date();
  const [company, setCompany] = useState(settings.companyName.toUpperCase());
  const [billType, setBillType] = useState('WATER BILL');
  const [currency, setCurrency] = useState('KES');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [house, setHouse] = useState('');
  const [room, setRoom] = useState('');
  const [month, setMonth] = useState(MONTHS[now.getMonth()]);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [unitCost, setUnitCost] = useState(String(settings.unitCostDefault));
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([]);
  const [rowPhotos, setRowPhotos] = useState({});
  const [expandedRows, setExpandedRows] = useState({});

  const isMeterBill = billType === 'WATER BILL' || billType === 'ELECTRICITY BILL';

  const [showPropModal, setShowPropModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [tenantSheetTarget, setTenantSheetTarget] = useState(null);
  const [showMasterMeterSheet, setShowMasterMeterSheet] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [slipRow, setSlipRow] = useState(null);

  const { properties, units: allUnits, getVariance } = usePortfolio();
  const selectedProp = properties.find(p => p.id === selectedPropertyId);
  const leak = selectedPropertyId ? getVariance(selectedPropertyId) : null;
  const masterConsumption = selectedProp ? (selectedProp.masterMeterReading - selectedProp.lastMasterMeter) : 0;

  // Spike detection: flag rows where consumption > 2.5x average across all rows
  const avgConsumption = (() => {
    const valid = rows.map(r => calcRow(r, unitCost).cons).filter(c => c > 0);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  })();
  const isSpikeRow = (row) => {
    const { cons } = calcRow(row, unitCost);
    return cons > 0 && avgConsumption > 0 && cons > avgConsumption * 2.5;
  };

  const loadPropertyRows = (propId, blankPresent = false) => {
    const units = allUnits[propId] || [];
    if (units.length === 0) return;
    const prop = properties.find(p => p.id === propId);
    if (prop) setHouse(prop.name);
    setRows(units.map(u => ({
      id: String(rowCounter++),
      flat: u.unit,
      tenantName: u.tenant || '',
      contact: u.phone || '',
      prev: String(u.prevReading || ''),
      pres: blankPresent ? '' : String(u.presentReading || ''),
      arrears: String(u.arrears || ''),
      fromSeed: true,
    })));
    setRowPhotos({});
  };

  useEffect(() => {
    if (isCaretaker) {
      const firstId = userProfile?.assignedProperties?.[0] || properties[0]?.id;
      if (firstId) { setSelectedPropertyId(firstId); loadPropertyRows(firstId, true); }
    }
  }, []);

  const enteredCount = rows.filter(r => String(r.pres).trim() !== '').length;
  const hasReadingError = rows.some(r => calcRow(r, unitCost).isPrevError);

  const submitReadings = async () => {
    if (enteredCount < rows.length) {
      Alert.alert('Readings Missing', `${rows.length - enteredCount} flat${rows.length - enteredCount !== 1 ? 's' : ''} still need this month's reading.`);
      return;
    }
    if (hasReadingError) {
      Alert.alert('Check Readings', 'A reading is lower than last month. Correct it before submitting.');
      return;
    }
    await logAudit({ userId: userProfile?.uid, role: userProfile?.role, action: 'SUBMIT_METER_READINGS', entityId: selectedPropertyId, data: { month, year, readings: rows.map(r => ({ flat: r.flat, pres: r.pres })) } });
    setSubmitted(true);
  };

  const toggleExpand = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const updateRow = (id, field, value) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  const addRow = () => {
    const r = newRow('');
    setRows(prev => [...prev, r]);
    setExpandedRows(prev => ({ ...prev, [r.id]: true }));
  };
  const removeRow = (id) => {
    if (rows.length <= 1) { Alert.alert('Cannot remove', 'You need at least one flat row.'); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    setRowPhotos(p => { const n = { ...p }; delete n[id]; return n; });
  };
  const setRowPhoto = (rowId, photo) => setRowPhotos(p => ({ ...p, [rowId]: photo }));

  const buildHeader = (tenantName = '') => {
    let t = `${company.toUpperCase()}\n${billType} · ${month.toUpperCase()} ${year}\n${'─'.repeat(30)}\n`;
    if (tenantName) t += `Dear ${tenantName},\n`;
    if (house) t += `House: ${house}\n`;
    if (room) t += `Room: ${room}\n`;
    return t;
  };

  const allBillText = () => {
    let t = buildHeader();
    t += `${'─'.repeat(30)}\n`;
    let grand = 0;
    rows.forEach(r => {
      const { cons, total } = calcRow(r, unitCost);
      grand += total;
      const arr = parseFloat(r.arrears) || 0;
      t += `Flat ${r.flat}: ${r.prev || 0} → ${r.pres || 0} (${cons} units)`;
      if (arr > 0) t += ` + arrears ${currency} ${arr.toFixed(2)}`;
      t += ` = ${currency} ${total.toFixed(2)}\n`;
    });
    t += `${'─'.repeat(30)}\nTOTAL DUE: ${currency} ${grand.toFixed(2)}\n`;
    if (note) t += `\n${note}\n`;
    t += `\nGenerated: ${new Date().toLocaleDateString('en-GB')}`;
    return t;
  };

  const singleBillText = (row) => {
    const { cons, total } = calcRow(row, unitCost);
    const arr = parseFloat(row.arrears) || 0;
    const uc = parseFloat(unitCost) || 0;
    let t = buildHeader(row.tenantName);
    t += `Flat: ${row.flat}\n${'─'.repeat(30)}\n`;
    t += `Previous Reading:  ${row.prev || 0}\nPresent Reading:   ${row.pres || 0}\nUnits Consumed:    ${cons}\nUnit Cost:         ${currency} ${uc.toFixed(2)}\n`;
    if (arr > 0) t += `Arrears:           ${currency} ${arr.toFixed(2)}\n`;
    t += `${'─'.repeat(30)}\nTOTAL DUE: ${currency} ${total.toFixed(2)}\n`;
    if (note) t += `\n${note}\n`;
    t += `\nGenerated: ${new Date().toLocaleDateString('en-GB')}`;
    return t;
  };

  const shareViaWA = async (text, contact) => {
    if (contact) {
      const phone = contact.replace(/[\s\-()]/g, '');
      if (/^\+?\d{7,}$/.test(phone)) {
        const num = phone.replace(/^\+/, '');
        const url = `whatsapp://send?phone=${num}&text=${encodeURIComponent(text)}`;
        try { if (await Linking.canOpenURL(url)) { await Linking.openURL(url); return; } } catch (_) {}
      }
    }
    try { await Share.share({ message: text }); } catch (_) {}
  };

  const sendSMS = (row) => {
    const { total } = calcRow(row, unitCost);
    if (!row.contact) { Alert.alert('No contact for this flat'); return; }
    const phone = row.contact.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{7,}$/.test(phone)) { Alert.alert('Invalid phone number'); return; }
    const msg = `Dear ${row.tenantName || `Flat ${row.flat}`}, your ${billType} for ${month} ${year}: ${currency} ${total.toFixed(2)}. ${note || ''}`;
    Linking.openURL(`sms:${phone}?body=${encodeURIComponent(msg)}`).catch(() => Alert.alert('SMS not available'));
  };

  const sendEmail = (row) => {
    const { total } = calcRow(row, unitCost);
    if (!row.contact || !row.contact.includes('@')) { Alert.alert('No valid email for this flat'); return; }
    const subject = `${billType} · ${month} ${year} · Flat ${row.flat}`;
    const body = singleBillText(row);
    Linking.openURL(`mailto:${row.contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() => Alert.alert('Email not available'));
  };

  const exportPDF = async () => {
    const grand = rows.reduce((sum, r) => sum + calcRow(r, unitCost).total, 0);
    const totalArrears = rows.reduce((sum, r) => sum + (parseFloat(r.arrears) || 0), 0);
    const totalUnits = rows.reduce((sum, r) => sum + calcRow(r, unitCost).cons, 0);
    const monthIdx = MONTHS.indexOf(month);
    const dueMonth = MONTHS[(monthIdx + 1) % 12];
    const dueYear = monthIdx === 11 ? String(parseInt(year, 10) + 1) : year;
    const paybill = settings.paybill || settings.mpesaPaybill || '';

    const slipHTML = (r, isEmpty) => {
      if (isEmpty) return `<div class="slip slip-empty"></div>`;
      const { cons, total } = calcRow(r, unitCost);
      const arr = parseFloat(r.arrears) || 0;
      const uc = parseFloat(unitCost) || 0;
      const waterCharge = cons * uc;
      const ref = `${(house || 'PROP').replace(/\s+/g, '').substring(0, 3).toUpperCase()}-${(r.flat || '').replace(/\s+/g, '')}-${month.substring(0, 3).toUpperCase()}${year.slice(-2)}`;
      return `<div class="slip">
        <div class="slip-head">
          <div>
            <div class="sh-co">${company}</div>
            <div class="sh-type">${billType} · ${month.toUpperCase()} ${year}</div>
          </div>
          <div class="sh-due">
            <div class="sh-due-lbl">TOTAL DUE</div>
            <div class="sh-due-amt">${currency} ${total.toFixed(2)}</div>
          </div>
        </div>
        <div class="ref-strip">
          <span>Ref: <b>${ref}</b></span>
          <span>Due: <b>15 ${dueMonth} ${dueYear}</b></span>
        </div>
        <div class="info-grid">
          <div class="ic"><div class="ic-l">TENANT</div><div class="ic-v">${r.tenantName || '—'}</div></div>
          <div class="ic"><div class="ic-l">FLAT</div><div class="ic-v">${r.flat || '—'}</div></div>
          <div class="ic"><div class="ic-l">PROPERTY</div><div class="ic-v">${house || '—'}</div></div>
          <div class="ic"><div class="ic-l">PERIOD</div><div class="ic-v">${month} ${year}</div></div>
        </div>
        <table class="rtbl">
          <thead><tr><th>PREVIOUS</th><th>PRESENT</th><th>CONSUMED</th><th>RATE</th></tr></thead>
          <tbody><tr>
            <td>${r.prev || 0}</td><td>${r.pres || 0}</td>
            <td><b>${cons} units</b></td><td>${currency} ${uc}/unit</td>
          </tr></tbody>
        </table>
        <div class="charges">
          <div class="ch"><span>Water (${cons} × ${currency} ${uc})</span><span>${currency} ${waterCharge.toFixed(2)}</span></div>
          ${arr > 0 ? `<div class="ch ch-arr"><span>Arrears</span><span>+ ${currency} ${arr.toFixed(2)}</span></div>` : ''}
        </div>
        <div class="total-bar"><span>TOTAL DUE</span><span>${currency} ${total.toFixed(2)}</span></div>
        ${paybill ? `<div class="mpesa-row">
          <div class="ms"><div class="ms-l">PAYBILL</div><div class="ms-v">${paybill}</div></div>
          <div class="ms"><div class="ms-l">ACCOUNT</div><div class="ms-v">${r.flat}</div></div>
          <div class="ms"><div class="ms-l">AMOUNT</div><div class="ms-v">${currency} ${total.toFixed(2)}</div></div>
        </div>` : ''}
        ${note ? `<div class="note-row">${note}</div>` : ''}
        <div class="slip-foot">PropFix · ${new Date().toLocaleDateString('en-GB')}</div>
      </div>`;
    };

    const pages = [];
    for (let i = 0; i < rows.length; i += 4) {
      const chunk = rows.slice(i, i + 4);
      const slips = chunk.map(r => slipHTML(r, false));
      while (slips.length < 4) slips.push(slipHTML(null, true));
      pages.push(`<div class="page"><div class="grid4">${slips.join('')}</div></div>`);
    }

    const hasLeak_ = leak?.hasLeak;
    const genDate2 = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const genTime2 = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const overdueRows = rows.filter(r => parseFloat(r.arrears) > 0);
    const pendingRows = rows.filter(r => !(parseFloat(r.arrears) > 0));
    const overdueAmt = overdueRows.reduce((s, r) => s + calcRow(r, unitCost).total, 0);
    const pendingAmt = pendingRows.reduce((s, r) => s + calcRow(r, unitCost).total, 0);

    const summaryRows = rows.map(r => {
      const { cons, total } = calcRow(r, unitCost);
      const arr = parseFloat(r.arrears) || 0;
      const isOverdue = arr > 0;
      const statusBadge = isOverdue
        ? `<span class="badge over">OVERDUE</span>`
        : `<span class="badge pend">PENDING</span>`;
      return `<tr>
        <td class="col-flat">${r.flat}</td>
        <td>${r.tenantName || '—'}</td>
        <td class="num">${Number(r.prev || 0).toLocaleString()}</td>
        <td class="num">${Number(r.pres || 0).toLocaleString()}</td>
        <td class="num">${cons}</td>
        <td class="num">${currency} ${(cons * (parseFloat(unitCost)||0)).toFixed(0)}</td>
        <td class="num ${isOverdue ? 'arr' : ''}">${arr > 0 ? currency + ' ' + arr.toFixed(0) : '—'}</td>
        <td class="num bold">${currency} ${Number(total).toLocaleString()}</td>
        <td class="num">${statusBadge}</td>
      </tr>`;
    }).join('');

    pages.push(`<div class="page sum-page">
      <div class="sum-header">
        <div>
          <div class="sum-prop">${house || company} — ${month} ${year}</div>
          <div class="sum-sub">WATER BILLING SUMMARY · MANAGED BY ${company}</div>
        </div>
        <div class="sum-total-badge">
          <div class="stb-lbl">PROPERTY TOTAL</div>
          <div class="stb-amt">${currency} ${Number(grand).toLocaleString()}</div>
        </div>
      </div>
      <div class="sum-meta">
        <div class="sm-cell"><div class="sm-lbl">BILL PERIOD</div><div class="sm-val">${month} ${year}</div></div>
        <div class="sm-cell"><div class="sm-lbl">DUE DATE</div><div class="sm-val">15 ${dueMonth} ${dueYear}</div></div>
        <div class="sm-cell"><div class="sm-lbl">MASTER METER</div><div class="sm-val">${totalUnits} units used</div></div>
      </div>
      <div class="sum-stats">
        <div class="stat"><div class="stat-n">${rows.length}</div><div class="stat-l">TOTAL UNITS</div></div>
        <div class="stat"><div class="stat-n">${totalUnits}</div><div class="stat-l">SUB-METER UNITS</div></div>
        <div class="stat ${hasLeak_ ? 'warn' : ''}"><div class="stat-n ${hasLeak_ ? 'warn' : ''}">${hasLeak_ ? leak.variance.toFixed(0) : '0'}</div><div class="stat-l">VARIANCE UNITS</div></div>
        <div class="stat ${hasLeak_ ? 'warn' : ''}"><div class="stat-n ${hasLeak_ ? 'warn' : ''}">${hasLeak_ ? leak.variancePct.toFixed(1) + '%' : '0%'}</div><div class="stat-l">NON-REVENUE</div></div>
      </div>
      ${hasLeak_ ? `<div class="leak-alert"><b>Leak alert:</b> Master meter recorded ${totalUnits} units but sub-meters total only ${totalUnits - Math.round(leak.variance)} units — a ${leak.variance.toFixed(0)}-unit (${leak.variancePct.toFixed(1)}%) unaccounted variance. Investigate common-area pipes before finalising bills.</div>` : ''}
      <div class="sum-tbl-hdr">ALL UNITS — READINGS &amp; CHARGES</div>
      <table class="sum-tbl">
        <thead>
          <tr>
            <th>FLAT</th><th>TENANT</th>
            <th class="num">PREV</th><th class="num">PRESENT</th><th class="num">UNITS USED</th>
            <th class="num">CHARGES</th><th class="num">ARREARS</th><th class="num">TOTAL DUE</th><th class="num">STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
          <tr class="totals-row">
            <td colspan="4"><b>PROPERTY TOTALS</b></td>
            <td class="num"><b>${totalUnits} units</b></td>
            <td class="num"><b>${currency} ${Number(grand - totalArrears).toLocaleString()}</b></td>
            <td class="num ${totalArrears > 0 ? 'arr' : ''}"><b>${totalArrears > 0 ? currency + ' ' + Number(totalArrears).toLocaleString() : '—'}</b></td>
            <td class="num"><b>${currency} ${Number(grand).toLocaleString()}</b></td>
            <td></td>
          </tr>
        </tbody>
      </table>
      ${paybill ? `<div class="pay-summary">
        <div class="ps-cell ps-pend">
          <div class="ps-lbl">PENDING</div>
          <div class="ps-count">${pendingRows.length} unit${pendingRows.length !== 1 ? 's' : ''} outstanding</div>
          <div class="ps-amt">${currency} ${Number(pendingAmt).toLocaleString()}</div>
        </div>
        <div class="ps-cell ps-over">
          <div class="ps-lbl">OVERDUE</div>
          <div class="ps-count">${overdueRows.length} unit${overdueRows.length !== 1 ? 's' : ''} with arrears</div>
          <div class="ps-amt">${currency} ${Number(overdueAmt).toLocaleString()}</div>
        </div>
        <div class="ps-cell ps-info">
          <div class="ps-lbl">PAYBILL</div>
          <div class="ps-count">Share individual bills via PropFix</div>
          <div class="ps-amt">${paybill}</div>
        </div>
      </div>` : ''}
      <div class="sum-foot">
        <div class="sf-left">Landlord summary for ${house || company}${note ? ', ' + note : ''}. Rate: ${currency} ${unitCost}/unit.<br>Readings taken ${genDate2}. ${paybill ? 'Paybill: ' + paybill + '.' : ''}</div>
        <div class="sf-right">
          <div class="sf-rlbl">GENERATED</div>
          <div class="sf-rval">${genDate2} · ${genTime2}</div>
          <div class="sf-rapp">PROPFIX APP</div>
        </div>
      </div>
    </div>`);

    const css = `
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;background:#FFFFFF;color:#0B1320;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .page{width:210mm;min-height:297mm;padding:8mm;page-break-after:always;background:#FFFFFF}
      .grid4{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:5mm;height:281mm}
      .slip{border:1px solid #E4E7EC;border-radius:6px;display:flex;flex-direction:column;overflow:hidden;background:#FFFFFF}
      .slip-empty{border:1px dashed #E4E7EC;background:#F6F7F9}
      .slip-head{background:#0B1320;padding:9px 10px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
      .sh-co{color:#fff;font-size:9.5px;font-weight:700;letter-spacing:0.3px}
      .sh-type{color:#93C5FD;font-size:7.5px;margin-top:2px;text-transform:uppercase;letter-spacing:0.4px}
      .sh-due{text-align:right;flex-shrink:0}
      .sh-due-lbl{color:#93C5FD;font-size:7px;text-transform:uppercase;letter-spacing:0.4px}
      .sh-due-amt{color:#fff;font-size:11px;font-weight:800;margin-top:1px}
      .ref-strip{padding:5px 10px;font-size:7.5px;color:#64748B;display:flex;justify-content:space-between;border-bottom:1px solid #E4E7EC;background:#F6F7F9}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;padding:6px 10px 4px;gap:0;border-bottom:1px solid #E4E7EC}
      .ic{padding:3px 0}
      .ic-l{font-size:6.5px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;display:block}
      .ic-v{font-size:8.5px;font-weight:700;color:#0B1320;display:block}
      .rtbl{width:100%;border-collapse:collapse;font-size:7.5px}
      .rtbl thead{background:#F6F7F9}
      .rtbl th{padding:4px 8px;text-align:center;font-size:6.5px;color:#64748B;text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid #E4E7EC}
      .rtbl td{padding:5px 8px;text-align:center;border-bottom:1px solid #E4E7EC;color:#374151}
      .charges{padding:5px 10px;border-bottom:1px solid #E4E7EC;flex:1}
      .ch{display:flex;justify-content:space-between;font-size:7.5px;padding:3px 0;color:#374151}
      .ch-arr{color:#B91C1C;font-weight:600}
      .total-bar{background:#0B1320;padding:7px 10px;display:flex;justify-content:space-between;align-items:center}
      .total-bar span:first-child{color:#93C5FD;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
      .total-bar span:last-child{color:#fff;font-size:12px;font-weight:900}
      .mpesa-row{display:flex;border-top:1px solid #E4E7EC;background:#F6F7F9}
      .ms{flex:1;padding:4px 0;text-align:center;border-right:1px solid #E4E7EC}
      .ms:last-child{border-right:none}
      .ms-l{font-size:6px;color:#64748B;text-transform:uppercase;letter-spacing:0.4px}
      .ms-v{font-size:8.5px;font-weight:800;color:#1D4ED8;margin-top:1px}
      .note-row{padding:4px 10px;font-size:7px;color:#64748B;border-top:1px solid #E4E7EC}
      .slip-foot{font-size:6.5px;color:#94A3B8;text-align:center;padding:4px;border-top:1px solid #E4E7EC;background:#F6F7F9}
      .sum-page{padding:10mm;background:#FFFFFF}
      .sum-header{background:#0B1320;border:1px solid #0B1320;padding:16px 20px;border-radius:8px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
      .sum-prop{color:#fff;font-size:16px;font-weight:800;letter-spacing:-0.3px}
      .sum-sub{color:#93C5FD;font-size:9px;margin-top:4px;text-transform:uppercase;letter-spacing:0.6px}
      .sum-total-badge{border:1.5px solid rgba(255,255,255,0.3);border-radius:8px;padding:8px 14px;text-align:right;flex-shrink:0}
      .stb-lbl{color:#93C5FD;font-size:8px;text-transform:uppercase;letter-spacing:0.5px}
      .stb-amt{color:#fff;font-size:18px;font-weight:900;margin-top:3px}
      .sum-meta{display:grid;grid-template-columns:1fr 1fr 1fr;background:#FFFFFF;border:1px solid #E4E7EC;border-radius:8px;margin-bottom:10px;overflow:hidden}
      .sm-cell{padding:12px 16px;border-right:1px solid #E4E7EC}
      .sm-cell:last-child{border-right:none}
      .sm-lbl{color:#1D4ED8;font-size:8px;text-transform:uppercase;letter-spacing:0.6px}
      .sm-val{color:#0B1320;font-size:11px;font-weight:700;margin-top:4px}
      .sum-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
      .stat{background:#FFFFFF;border:1px solid #E4E7EC;border-radius:6px;padding:10px 12px;text-align:center}
      .stat.warn{background:#FFFBEB;border-color:#D97706}
      .stat-n{font-size:16px;font-weight:800;color:#1D4ED8}
      .stat-n.warn{color:#B45309}
      .stat-l{font-size:7px;text-transform:uppercase;letter-spacing:0.5px;color:#64748B;margin-top:3px}
      .leak-alert{background:#FFFBEB;border:1px solid #D97706;border-radius:6px;padding:10px 14px;font-size:9px;color:#92400E;margin-bottom:10px;line-height:1.5}
      .sum-tbl-hdr{color:#1D4ED8;font-size:8px;text-transform:uppercase;letter-spacing:0.8px;padding:10px 0 6px}
      .sum-tbl{width:100%;border-collapse:collapse;font-size:9px}
      .sum-tbl thead{background:#F6F7F9}
      .sum-tbl th{padding:8px 10px;text-align:left;color:#1D4ED8;font-size:7.5px;text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid #E4E7EC}
      .sum-tbl th.num{text-align:right}
      .sum-tbl td{padding:8px 10px;border-bottom:1px solid #E4E7EC;color:#374151}
      .sum-tbl td.num{text-align:right}
      .sum-tbl td.bold{font-weight:700;color:#0B1320}
      .sum-tbl td.col-flat{font-weight:800;color:#1D4ED8}
      .sum-tbl td.arr{color:#B91C1C;font-weight:700}
      .sum-tbl tr:nth-child(even) td{background:#F6F7F9}
      .sum-tbl tr.totals-row td{background:#0B1320;color:#93C5FD;font-weight:700;border-bottom:none}
      .badge{font-size:7px;font-weight:800;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:0.4px}
      .badge.pend{background:#DCFCE7;color:#15803D;border:1px solid #86EFAC}
      .badge.over{background:#FEE2E2;color:#991B1B;border:1px solid #FECACA}
      .pay-summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}
      .ps-cell{background:#FFFFFF;border:1px solid #E4E7EC;border-radius:6px;padding:12px 14px}
      .ps-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px}
      .ps-pend .ps-lbl{color:#B45309}
      .ps-over .ps-lbl{color:#B91C1C}
      .ps-info .ps-lbl{color:#1D4ED8}
      .ps-count{font-size:8.5px;color:#64748B;margin-top:3px}
      .ps-amt{font-size:14px;font-weight:900;color:#0B1320;margin-top:4px}
      .sum-foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px;padding-top:10px;border-top:1px solid #E4E7EC}
      .sf-left{font-size:8.5px;color:#64748B;line-height:1.6}
      .sf-right{text-align:right}
      .sf-rlbl{color:#94A3B8;font-size:7px;text-transform:uppercase;letter-spacing:0.5px}
      .sf-rval{color:#374151;font-size:9px;font-weight:700}
      .sf-rapp{color:#1D4ED8;font-size:9px;font-weight:800;margin-top:4px}
      @media print{.page{page-break-after:always}}
    `;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${pages.join('')}</body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const hShort = house ? (house.length > 20 ? house.substring(0, 18) + '..' : house) : company.substring(0, 20);
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${billType} · ${month.substring(0,3)} ${year} · ${hShort}`, UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert('PDF Error', String(e.message));
    }
  };

  const exportSinglePDF = async (row) => {
    const { cons, total } = calcRow(row, unitCost);
    const arr = parseFloat(row.arrears) || 0;
    const uc = parseFloat(unitCost) || 0;
    const waterCharge = cons * uc;
    const monthIdx2 = MONTHS.indexOf(month);
    const dueMonth = MONTHS[(monthIdx2 + 1) % 12];
    const dueYear = monthIdx2 === 11 ? String(parseInt(year, 10) + 1) : year;
    const ref = `${(house || 'PROP').replace(/\s+/g, '').substring(0, 3).toUpperCase()}-${(row.flat || '').replace(/\s+/g, '')}-${month.substring(0, 3).toUpperCase()}${year.slice(-2)}`;
    const paybill = settings.paybill || settings.mpesaPaybill || '';
    const genDate = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const genTime = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;background:#FFFFFF;color:#0B1320;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:8mm}
      .bill{max-width:170mm;margin:0 auto;background:#FFFFFF;border:1px solid #E4E7EC;border-radius:10px;overflow:hidden}
      .hdr{background:#0B1320;padding:18px 20px 14px;border-bottom:1px solid #0B1320;display:flex;justify-content:space-between;align-items:flex-start}
      .hdr-left .prop-name{color:#fff;font-size:17px;font-weight:800;letter-spacing:-0.3px}
      .hdr-left .mgd-by{color:#93C5FD;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;margin-top:4px}
      .due-badge{border:1.5px solid rgba(255,255,255,0.3);border-radius:8px;padding:8px 14px;text-align:right}
      .due-badge .due-lbl{color:#93C5FD;font-size:8px;text-transform:uppercase;letter-spacing:0.5px}
      .due-badge .due-amt{color:#fff;font-size:19px;font-weight:900;margin-top:3px}
      .meta-row{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #E4E7EC}
      .meta-cell{padding:12px 20px;border-right:1px solid #E4E7EC}
      .meta-cell:last-child{border-right:none}
      .meta-lbl{color:#1D4ED8;font-size:8px;text-transform:uppercase;letter-spacing:0.6px}
      .meta-val{color:#0B1320;font-size:11px;font-weight:700;margin-top:4px}
      .sec-hdr{color:#1D4ED8;font-size:8px;text-transform:uppercase;letter-spacing:0.8px;padding:12px 20px 8px}
      .tgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 20px 14px}
      .tcard{background:#F6F7F9;border:1px solid #E4E7EC;border-radius:6px;padding:10px 14px}
      .tc-lbl{color:#64748B;font-size:8px;text-transform:uppercase;letter-spacing:0.5px}
      .tc-val{color:#0B1320;font-size:12px;font-weight:700;margin-top:4px}
      .rdg-wrap{padding:0 20px 14px}
      .rtbl{width:100%;border-collapse:collapse;border-radius:6px;overflow:hidden}
      .rtbl thead tr{background:#F6F7F9}
      .rtbl th{padding:9px 10px;text-align:center;font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E4E7EC}
      .rtbl td{padding:12px 10px;text-align:center;border-bottom:1px solid #E4E7EC;color:#374151;font-size:11px}
      .rtbl .rdg-lbl{text-align:left;color:#0B1320;font-weight:700}
      .rtbl .rate-main{font-size:11px;color:#0B1320;font-weight:700}
      .rtbl .rate-sub{font-size:8px;color:#64748B;margin-top:2px}
      .rtbl .cons-val{font-size:12px;font-weight:800;color:#1D4ED8}
      .chg-wrap{padding:0 20px 4px;border-top:1px solid #E4E7EC}
      .ch-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #E4E7EC;font-size:10px}
      .ch-row:last-child{border-bottom:none}
      .ch-lbl{color:#64748B}
      .ch-val{color:#0B1320;font-weight:600}
      .ch-val.zero{color:#94A3B8}
      .ch-val.arr{color:#B91C1C;font-weight:700}
      .total-bar{background:#0B1320;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-top:2px solid #0B1320}
      .total-lbl{color:#93C5FD;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
      .total-amt{color:#fff;font-size:24px;font-weight:900}
      .mpesa-hdr{background:#F6F7F9;padding:8px 20px;color:#1D4ED8;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;border-top:1px solid #E4E7EC}
      .mpesa-steps{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-top:1px solid #E4E7EC}
      .ms{padding:12px 10px;text-align:center;border-right:1px solid #E4E7EC;background:#F6F7F9}
      .ms:last-child{border-right:none}
      .ms-step{color:#1D4ED8;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px}
      .ms-desc{color:#64748B;font-size:7px;margin-top:2px}
      .ms-val{color:#0B1320;font-size:13px;font-weight:900;margin-top:4px}
      .note-row{padding:10px 20px;font-size:9px;color:#64748B;border-top:1px solid #E4E7EC;background:#F6F7F9}
      .foot{display:flex;justify-content:space-between;align-items:flex-end;padding:12px 20px;border-top:1px solid #E4E7EC;background:#F6F7F9}
      .foot-left{font-size:8.5px;color:#64748B;line-height:1.6}
      .foot-right{text-align:right;font-size:8px;color:#64748B}
      .foot-right .gen-label{color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;font-size:7px}
      .foot-right .gen-val{color:#374151;font-weight:700;font-size:9px}
      .foot-right .app-name{color:#1D4ED8;font-weight:800;font-size:9px}
    </style></head><body>
      <div class="bill">
        <div class="hdr">
          <div class="hdr-left">
            <div class="prop-name">${house || company}</div>
            <div class="mgd-by">Managed by ${company}</div>
          </div>
          <div class="due-badge">
            <div class="due-lbl">TOTAL DUE</div>
            <div class="due-amt">${currency} ${Number(total).toLocaleString()}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-cell"><div class="meta-lbl">BILL PERIOD</div><div class="meta-val">${month} ${year}</div></div>
          <div class="meta-cell"><div class="meta-lbl">DUE DATE</div><div class="meta-val">15 ${dueMonth} ${dueYear}</div></div>
          <div class="meta-cell"><div class="meta-lbl">REFERENCE NO.</div><div class="meta-val">${ref}</div></div>
        </div>
        <div class="sec-hdr">TENANT DETAILS</div>
        <div class="tgrid">
          <div class="tcard"><div class="tc-lbl">TENANT NAME</div><div class="tc-val">${row.tenantName || '—'}</div></div>
          <div class="tcard"><div class="tc-lbl">UNIT / FLAT</div><div class="tc-val">${row.flat || '—'}</div></div>
          <div class="tcard"><div class="tc-lbl">PROPERTY</div><div class="tc-val">${house || '—'}</div></div>
          <div class="tcard"><div class="tc-lbl">BILLING PERIOD</div><div class="tc-val">${month} ${year}</div></div>
        </div>
        <div class="sec-hdr">METER READINGS</div>
        <div class="rdg-wrap">
          <table class="rtbl">
            <thead><tr><th style="text-align:left">READING</th><th>PREVIOUS</th><th>PRESENT</th><th>CONSUMPTION</th><th>RATE</th></tr></thead>
            <tbody><tr>
              <td class="rdg-lbl">Water (units)</td>
              <td>${Number(row.prev || 0).toLocaleString()}</td>
              <td>${Number(row.pres || 0).toLocaleString()}</td>
              <td class="cons-val">${cons} units</td>
              <td><div class="rate-main">${currency} ${uc} / unit</div><div class="rate-sub">per unit consumed</div></td>
            </tr></tbody>
          </table>
        </div>
        <div class="sec-hdr">CHARGES BREAKDOWN</div>
        <div class="chg-wrap">
          <div class="ch-row"><span class="ch-lbl">Water charges (${cons} units × ${currency} ${uc})</span><span class="ch-val">${currency} ${Number(waterCharge).toLocaleString()}</span></div>
          <div class="ch-row"><span class="ch-lbl">Outstanding arrears</span><span class="ch-val ${arr > 0 ? 'arr' : 'zero'}">${arr > 0 ? currency + ' ' + arr.toFixed(2) : currency + ' 0.00'}</span></div>
          <div class="ch-row"><span class="ch-lbl">Service charge</span><span class="ch-val zero">${currency} 0.00</span></div>
        </div>
        <div class="total-bar">
          <span class="total-lbl">Total Amount Due</span>
          <span class="total-amt">${currency} ${Number(total).toLocaleString()}</span>
        </div>
        ${paybill ? `
        <div class="mpesa-hdr">Pay via M-Pesa</div>
        <div class="mpesa-steps">
          <div class="ms"><div class="ms-step">STEP 1</div><div class="ms-desc">Paybill Number</div><div class="ms-val">${paybill}</div></div>
          <div class="ms"><div class="ms-step">STEP 2</div><div class="ms-desc">Account Number</div><div class="ms-val">${ref.split('-').slice(0,2).join('-')}</div></div>
          <div class="ms"><div class="ms-step">STEP 3</div><div class="ms-desc">Amount (KES)</div><div class="ms-val">${Number(total).toLocaleString()}</div></div>
        </div>` : ''}
        ${note ? `<div class="note-row">${note}</div>` : ''}
        <div class="foot">
          <div class="foot-left">
            ${note ? note + '<br>' : 'Readings recorded by caretaker. Payment clears within 24 hrs of M-Pesa confirmation.'}
          </div>
          <div class="foot-right">
            <div class="gen-label">BILL GENERATED</div>
            <div class="gen-val">${genDate} · ${genTime}</div>
            <div class="gen-label" style="margin-top:4px">GENERATED BY</div>
            <div class="app-name">PropFix App</div>
          </div>
        </div>
      </div>
    </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const hShort2 = house ? (house.length > 16 ? house.substring(0, 14) + '..' : house) : company.substring(0, 16);
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${billType} · ${month.substring(0,3)} ${year} · ${hShort2} · Unit ${row.flat}`, UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert('PDF Error', String(e.message));
    }
  };

  const grandTotal = rows.reduce((sum, r) => sum + calcRow(r, unitCost).total, 0);

  return (
    <View style={styles.safe}>
      <ScreenHeader
        title={isCaretaker ? 'Meter Walk-Sheet' : 'Bill Generator'}
        subtitle={isCaretaker ? `${house || 'My Site'} · ${month} ${year}` : 'Water · Service Charge · Rent'}
        rightAction={isCaretaker ? null : (
          <TouchableOpacity style={styles.headerPdfBtn} onPress={exportPDF}>
            <MaterialIcons name="picture-as-pdf" size={13} color="#fff" />
            <Text style={styles.headerPdfText}>Preview PDF</Text>
          </TouchableOpacity>
        )}
      />

      {!isCaretaker && (
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tab, activeTab === 'billing' && styles.tabActive]} onPress={() => setActiveTab('billing')} activeOpacity={0.8}>
            <Text style={[styles.tabText, activeTab === 'billing' && styles.tabTextActive]}>Billing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'payments' && styles.tabActive]} onPress={() => setActiveTab('payments')} activeOpacity={0.8}>
            <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>History &amp; Payments</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Property Selector */}
          {!isCaretaker && activeTab === 'billing' && <View style={styles.section}>
            <Text style={styles.sectionLabel}>Property</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.picker} onPress={() => setShowPropModal(true)}>
                <Text style={[styles.pickerVal, !selectedProp && { color: colors.textMuted }]}>
                  {selectedProp ? selectedProp.name : 'Select a property to auto-fill readings'}
                </Text>
                <MaterialIcons name="expand-more" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>}

          {/* Master Meter Strip */}
          {selectedProp && (
            <View style={styles.section}>
              <View style={[styles.card, { gap: 0 }]}>
                <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>Master Meter</Text>
                <View style={{ flexDirection: 'row' }}>
                  {[{ label: 'Previous', value: selectedProp.lastMasterMeter }, { label: 'Current', value: selectedProp.masterMeterReading }, { label: 'Consumption', value: masterConsumption }].map((item, i) => (
                    <View key={item.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.border }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: i === 2 ? colors.primaryMid : colors.text, fontVariant: ['tabular-nums'] }}>{item.value}</Text>
                      <Text style={{ fontSize: 9, color: colors.textMuted }}>units</Text>
                    </View>
                  ))}
                </View>
                {leak?.hasLeak && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: colors.dangerBg, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <MaterialIcons name="warning" size={14} color={colors.dangerMid} />
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: colors.danger }}>Leak Alert: {leak.variancePct.toFixed(1)}% non-revenue water ({leak.variance.toFixed(0)} units)</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, minHeight: 44, borderRadius: 8, backgroundColor: colors.primaryXLight, borderWidth: 1, borderColor: colors.primaryLight }}
                  onPress={() => setShowMasterMeterSheet(true)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryMid }}>View Master Meter History</Text>
                  <MaterialIcons name="arrow-forward" size={16} color={colors.primaryMid} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bill Details */}
          {!isCaretaker && activeTab === 'billing' && <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bill Details</Text>
            <View style={styles.card}>
              {/* Company name is fixed, not editable */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <MaterialIcons name="business" size={14} color={colors.primaryMid} />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.text, marginLeft: 8 }}>{company}</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>KES</Text>
              </View>
              <Text style={styles.label}>Bill Type</Text>
              <TouchableOpacity style={[styles.picker, { marginBottom: 0 }]} onPress={() => setShowTypeModal(true)}>
                <Text style={styles.pickerVal} numberOfLines={1}>{billType}</Text>
                <MaterialIcons name="expand-more" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>}

          {/* Property Info */}
          {!isCaretaker && activeTab === 'billing' && <View style={styles.section}>
            <Text style={styles.sectionLabel}>Billing Period</Text>
            <View style={styles.card}>
              {/* Property name shown as read-only label when selected */}
              {house ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <MaterialIcons name="home" size={14} color={colors.primaryMid} />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.text, marginLeft: 8 }}>{house}</Text>
                </View>
              ) : null}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Billing Month</Text>
                  <TouchableOpacity style={styles.picker} onPress={() => setShowMonthModal(true)}>
                    <Text style={styles.pickerVal}>{month}</Text>
                    <MaterialIcons name="expand-more" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={{ width: 80 }}>
                  <Text style={styles.label}>Year</Text>
                  <TextInput style={styles.input} value={year} onChangeText={setYear} keyboardType="numeric" placeholder="2026" placeholderTextColor={colors.textMuted} maxLength={4} />
                </View>
              </View>
              <Text style={styles.label}>Unit Cost (per unit)</Text>
              <TextInput style={styles.input} value={unitCost} onChangeText={setUnitCost} keyboardType="decimal-pad" placeholder="65" placeholderTextColor={colors.textMuted} />
            </View>
          </View>}

          {/* Flat Rows */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>{isCaretaker ? `Flat Readings · ${enteredCount} of ${rows.length} entered` : 'Flat Readings'}</Text>
              {!isCaretaker && (
                <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
                  <MaterialIcons name="add" size={14} color={colors.primaryMid} />
                  <Text style={styles.addRowText}>Add Flat</Text>
                </TouchableOpacity>
              )}
            </View>

            {rows.map((row) => {
              const { cons, total, isPrevError } = calcRow(row, unitCost);
              const spike = isSpikeRow(row);
              if (isCaretaker) {
                const arr = parseFloat(row.arrears) || 0;
                const entered = String(row.pres).trim() !== '';
                return (
                  <View key={row.id} style={styles.rowCard}>
                    <View style={styles.rowCardHead}>
                      <View style={styles.rowCardTitle}>
                        <View style={styles.flatBadge}><Text style={styles.flatBadgeText}>{row.flat || '?'}</Text></View>
                        <Text style={styles.walkTenant} numberOfLines={1}>{row.tenantName || 'Vacant'}</Text>
                      </View>
                      <View style={styles.lockChip}>
                        <MaterialIcons name="lock" size={12} color={colors.textMuted} />
                        <Text style={styles.lockChipTxt}>Locked</Text>
                      </View>
                    </View>
                    <View style={styles.lockBox}>
                      <LockedField label="Flat No" value={row.flat || '-'} />
                      <LockedField label="Tenant Name" value={row.tenantName || 'Vacant'} />
                      <LockedField label="Phone" value={row.contact || 'No phone'} />
                      <LockedField label="Previous Reading" value={`${row.prev || 0} units`} />
                      <LockedField label="Arrears" value={arr > 0 ? `${currency} ${arr.toLocaleString()}` : 'None'} danger={arr > 0} />
                    </View>
                    <Text style={styles.bigLabel}>This Month Reading</Text>
                    <TextInput
                      style={[styles.bigInput, isPrevError && { borderColor: colors.dangerMid }]}
                      value={row.pres}
                      onChangeText={v => { updateRow(row.id, 'pres', v.replace(/[^0-9.]/g, '')); setSubmitted(false); }}
                      keyboardType="decimal-pad"
                      placeholder="Enter meter reading"
                      placeholderTextColor={colors.textMuted}
                    />
                    {isPrevError && (
                      <View style={[styles.validationError, { marginTop: 8, marginBottom: 0 }]}>
                        <MaterialIcons name="cancel" size={14} color={colors.dangerMid} />
                        <Text style={{ fontSize: 12, color: colors.dangerMid, flex: 1 }}>This reading is lower than last month ({row.prev}). Check the meter again.</Text>
                      </View>
                    )}
                    {!isPrevError && entered && <Text style={styles.usedTxt}>Used this month: {cons} units</Text>}
                    <View style={{ marginTop: 12, marginBottom: -14 }}>
                      <PhotoPicker
                        label="Take Meter Photo"
                        variant="button"
                        value={rowPhotos[row.id] || null}
                        onChange={photo => setRowPhoto(row.id, photo)}
                        propertyName={house || selectedProp?.name}
                        unitLabel={`Flat ${row.flat}`}
                      />
                    </View>
                  </View>
                );
              }
              const isExpanded = !!expandedRows[row.id];
              return (
                <View key={row.id} style={styles.rowCard}>
                  {/* Accordion header — always visible */}
                  <TouchableOpacity style={styles.rowCardHead} onPress={() => toggleExpand(row.id)} activeOpacity={0.7}>
                    <View style={styles.rowCardTitle}>
                      <View style={styles.flatBadge}><Text style={styles.flatBadgeText}>{row.flat || '?'}</Text></View>
                      {row.tenantName ? <Text style={styles.walkTenant} numberOfLines={1}>{row.tenantName}</Text> : null}
                      {total > 0 && <Text style={styles.rowTotal}>{currency} {total.toFixed(2)}</Text>}
                    </View>
                    <View style={styles.rowActions}>
                      {total > 0 && (
                        <TouchableOpacity style={[styles.rowActionBtn, { backgroundColor: colors.primaryXLight }]} onPress={() => setSlipRow(row)}>
                          <MaterialIcons name="receipt" size={12} color={colors.primaryMid} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.rowActionBtn, { backgroundColor: colors.dangerBg }]} onPress={() => removeRow(row.id)}>
                        <MaterialIcons name="close" size={12} color={colors.danger} />
                      </TouchableOpacity>
                      <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={{ marginTop: 4 }}>
                      {/* Validation errors */}
                      {isPrevError && (
                        <View style={styles.validationError}>
                          <MaterialIcons name="cancel" size={12} color={colors.dangerMid} />
                          <Text style={{ fontSize: 11, color: colors.dangerMid, flex: 1 }}>Present reading is lower than previous. Check the meter.</Text>
                        </View>
                      )}
                      {spike && (
                        <View style={styles.spikeAlert}>
                          <MaterialIcons name="flash-on" size={12} color={colors.warningMid} />
                          <Text style={{ fontSize: 11, color: colors.warningMid, flex: 1 }}>Spike: {cons} units is {((cons / avgConsumption - 1) * 100).toFixed(0)}% above average. Verify reading.</Text>
                        </View>
                      )}

                      <View style={styles.row2}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Flat No.</Text>
                          {row.fromSeed ? (
                            <View style={[styles.input, styles.readOnly]}><Text style={styles.readOnlyTxt}>{row.flat || '-'}</Text></View>
                          ) : (
                            <TextInput style={styles.input} value={row.flat} onChangeText={v => updateRow(row.id, 'flat', v)} placeholder="A1" placeholderTextColor={colors.textMuted} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Tenant</Text>
                          {row.fromSeed ? (
                            <View style={[styles.input, styles.readOnly]}><Text style={styles.readOnlyTxt} numberOfLines={1}>{row.tenantName || 'Vacant'}</Text></View>
                          ) : (
                            <TextInput style={styles.input} value={row.tenantName} onChangeText={v => updateRow(row.id, 'tenantName', v)} placeholder="Tenant name" placeholderTextColor={colors.textMuted} />
                          )}
                        </View>
                      </View>
                      <Text style={styles.label}>Phone / WhatsApp</Text>
                      {row.fromSeed ? (
                        <View style={[styles.input, styles.readOnly]}><Text style={styles.readOnlyTxt}>{row.contact || 'No phone'}</Text></View>
                      ) : (
                        <TextInput style={styles.input} value={row.contact} onChangeText={v => updateRow(row.id, 'contact', v)} placeholder="+254... or email@..." placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
                      )}

                      {isMeterBill && (
                        <View style={styles.row3}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Previous</Text>
                            {row.fromSeed ? (
                              <View style={[styles.input, styles.readOnly]}><Text style={styles.readOnlyTxt}>{row.prev || '0'}</Text></View>
                            ) : (
                              <TextInput style={styles.input} value={row.prev} onChangeText={v => updateRow(row.id, 'prev', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, row.fromSeed && { color: colors.primaryMid }]}>Present</Text>
                            <TextInput style={[styles.input, row.fromSeed && { borderColor: colors.primaryMid, borderWidth: 2 }, isPrevError && { borderColor: colors.dangerMid }]} value={row.pres} onChangeText={v => updateRow(row.id, 'pres', v)} keyboardType="decimal-pad" placeholder="Enter reading" placeholderTextColor={colors.textMuted} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Arrears</Text>
                            {row.fromSeed ? (
                              <View style={[styles.input, styles.readOnly]}><Text style={[styles.readOnlyTxt, parseFloat(row.arrears) > 0 && { color: colors.dangerMid }]}>{row.arrears || '0'}</Text></View>
                            ) : (
                              <TextInput style={styles.input} value={row.arrears} onChangeText={v => updateRow(row.id, 'arrears', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
                            )}
                          </View>
                        </View>
                      )}

                      {!isMeterBill && (
                        <View style={styles.row2}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Amount</Text>
                            <TextInput style={styles.input} value={row.prev} onChangeText={v => updateRow(row.id, 'prev', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Arrears</Text>
                            {row.fromSeed ? (
                              <View style={[styles.input, styles.readOnly]}><Text style={[styles.readOnlyTxt, parseFloat(row.arrears) > 0 && { color: colors.dangerMid }]}>{row.arrears || '0'}</Text></View>
                            ) : (
                              <TextInput style={styles.input} value={row.arrears} onChangeText={v => updateRow(row.id, 'arrears', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
                            )}
                          </View>
                        </View>
                      )}

                      {isMeterBill && (
                        <PhotoPicker
                          label="Meter Photo"
                          value={rowPhotos[row.id] || null}
                          onChange={photo => setRowPhoto(row.id, photo)}
                          propertyName={house || selectedProp?.name}
                          unitLabel={`Flat ${row.flat}`}
                        />
                      )}

                      {cons > 0 && (
                        <View style={styles.calcRow}>
                          <MaterialIcons name="calculate" size={12} color={colors.success} />
                          <Text style={styles.calcText}>{cons} units × {parseFloat(unitCost || 0).toFixed(2)} = </Text>
                          <Text style={styles.calcTotal}>{currency} {total.toFixed(2)}</Text>
                        </View>
                      )}

                      {/* Per-row send actions */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <TouchableOpacity style={[styles.rowSendBtn, { backgroundColor: colors.infoBg, borderColor: colors.primaryLight }]} onPress={() => sendSMS(row)}>
                          <MaterialIcons name="chat-bubble-outline" size={13} color={colors.primaryMid} />
                          <Text style={[styles.rowSendTxt, { color: colors.primaryMid }]}>SMS</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.rowSendBtn, { backgroundColor: '#E7F8F0', borderColor: '#86EFAC' }]} onPress={() => exportSinglePDF(row)}>
                          <MaterialIcons name="picture-as-pdf" size={13} color="#059669" />
                          <Text style={[styles.rowSendTxt, { color: '#059669' }]}>PDF</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.rowSendBtn, { backgroundColor: '#E7F8F0', borderColor: '#86EFAC' }]} onPress={() => shareViaWA(singleBillText(row), row.contact)}>
                          <MaterialIcons name="send" size={13} color="#059669" />
                          <Text style={[styles.rowSendTxt, { color: '#059669' }]}>WhatsApp</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {isCaretaker && (
            <View style={[styles.section, { gap: 10 }]}>
              {submitted && (
                <View style={styles.submittedBox}>
                  <MaterialIcons name="check-circle" size={20} color={colors.successMid} />
                  <Text style={styles.submittedTxt}>{rows.length} readings for {month} {year} submitted to the manager.</Text>
                </View>
              )}
              <TouchableOpacity style={[styles.btnGreen, submitted && { opacity: 0.5 }]} onPress={submitReadings} disabled={submitted} activeOpacity={0.85}>
                <MaterialIcons name="send" size={18} color="#fff" />
                <Text style={styles.btnText}>{submitted ? 'Readings Submitted' : 'Submit Meter Readings'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isCaretaker && activeTab === 'billing' && grandTotal > 0 && (
            <View style={styles.grandCard}>
              <View>
                <Text style={styles.grandLabel}>Grand Total</Text>
                <Text style={styles.grandSub}>{rows.length} flat{rows.length !== 1 ? 's' : ''}</Text>
              </View>
              <Text style={styles.grandValue}>{currency} {grandTotal.toFixed(2)}</Text>
            </View>
          )}

          {!isCaretaker && activeTab === 'billing' && <View style={styles.section}>
            <Text style={styles.sectionLabel}>Payment Note (optional)</Text>
            <View style={styles.card}>
              <TextInput style={[styles.input, styles.textarea]} value={note} onChangeText={setNote} placeholder={'e.g. Pay within 7 days. M-Pesa Paybill 123456.'} placeholderTextColor={colors.textMuted} multiline textAlignVertical="top" />
            </View>
          </View>}

          {/* History & Payments tab */}
          {!isCaretaker && activeTab === 'payments' && (
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.md }}>
              <MaterialIcons name="receipt-long" size={44} color={colors.textMuted} />
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 14 }}>No payment history yet</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>Once tenants pay, their records will appear here. Log payments against individual bills to track collection status.</Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky bottom bar for landlord */}
      {!isCaretaker && activeTab === 'billing' && (
        <View style={styles.stickyBar}>
          <TouchableOpacity style={styles.stickyBtnPDF} onPress={exportPDF} activeOpacity={0.85}>
            <MaterialIcons name="description" size={16} color="#fff" />
            <Text style={styles.stickyBtnText}>Property PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stickyBtnSend} onPress={() => setShowBatchModal(true)} activeOpacity={0.85}>
            <MaterialIcons name="people" size={16} color="#fff" />
            <Text style={styles.stickyBtnText}>Send to Tenants</Text>
          </TouchableOpacity>
        </View>
      )}

      <PickerModal visible={showPropModal} onClose={() => setShowPropModal(false)} options={properties.map(p => p.name)} selected={selectedProp?.name} onSelect={name => { const p = properties.find(x => x.name === name); if (p) { setSelectedPropertyId(p.id); loadPropertyRows(p.id); } }} />

      <Modal visible={showBatchModal} animationType="slide" onRequestClose={() => setShowBatchModal(false)}>
        <SafeAreaView style={styles.batchSafe}>
          <View style={styles.batchHeader}>
            <View>
              <Text style={styles.batchTitle}>Send to All Tenants</Text>
              <Text style={styles.batchSub}>Each gets their own personalised bill</Text>
            </View>
            <TouchableOpacity onPress={() => setShowBatchModal(false)} style={styles.closeBtn}>
              <MaterialIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={rows}
            keyExtractor={r => r.id}
            contentContainerStyle={{ padding: spacing.md, paddingBottom: 32 }}
            renderItem={({ item: row }) => {
              const { total } = calcRow(row, unitCost);
              const name = row.tenantName || `Flat ${row.flat}`;
              const initial = (row.tenantName || row.flat || '?')[0].toUpperCase();
              return (
                <View style={styles.tenantCard}>
                  <TouchableOpacity
                    style={styles.tenantCardLeft}
                    onPress={() => {
                      const unit = (allUnits[selectedPropertyId] || []).find(u => u.unit.toUpperCase() === (row.flat || '').toUpperCase());
                      if (unit && selectedPropertyId) setTenantSheetTarget({ propertyId: selectedPropertyId, unitId: unit.id });
                    }}
                    activeOpacity={0.75}
                    disabled={!row.tenantName}
                  >
                    <View style={styles.tenantAvatar}><Text style={styles.tenantAvatarText}>{initial}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tenantName, row.tenantName && { textDecorationLine: 'underline', color: colors.primaryMid }]}>{name}</Text>
                      <Text style={styles.tenantFlat}>Flat {row.flat}</Text>
                      {row.contact ? <Text style={styles.tenantContact} numberOfLines={1}>{row.contact}</Text> : <Text style={styles.tenantNoContact}>No contact added</Text>}
                    </View>
                  </TouchableOpacity>
                  <View style={styles.tenantRight}>
                    <Text style={styles.tenantTotal}>{currency} {total.toFixed(2)}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity style={[styles.tenantShareBtn, { backgroundColor: colors.info }]} onPress={() => sendSMS(row)}>
                        <MaterialIcons name="chat-bubble" size={11} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.tenantShareBtn, { backgroundColor: colors.info }]} onPress={() => exportSinglePDF(row)}>
                        <MaterialIcons name="picture-as-pdf" size={11} color="#fff" />
                        <Text style={styles.tenantShareText}>PDF</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <PickerModal visible={showTypeModal} onClose={() => setShowTypeModal(false)} options={BILL_TYPES} selected={billType} onSelect={setBillType} />
      <PickerModal visible={showCurrencyModal} onClose={() => setShowCurrencyModal(false)} options={CURRENCIES} selected={currency} onSelect={setCurrency} />
      <PickerModal visible={showMonthModal} onClose={() => setShowMonthModal(false)} options={MONTHS} selected={month} onSelect={setMonth} />

      {/* Preview Bill Slip Modal */}
      <TenantSheet target={tenantSheetTarget} onClose={() => setTenantSheetTarget(null)} navigation={navigation} />
      <MasterMeterSheet propertyId={selectedPropertyId} visible={showMasterMeterSheet} onClose={() => setShowMasterMeterSheet(false)} />

      {slipRow && (() => {
        const { prev, pres, cons, total } = calcRow(slipRow, unitCost);
        const arr = parseFloat(slipRow.arrears) || 0;
        const uc = parseFloat(unitCost) || 0;
        const waterCharge = cons * uc;
        const dueMonth = MONTHS[(MONTHS.indexOf(month) + 1) % 12];
        const ref = `${(house || 'PROP').replace(/\s+/g, '').substring(0, 3).toUpperCase()}-${(slipRow.flat || '').replace(/\s+/g, '')}-${month.substring(0, 3).toUpperCase()}${year.slice(-2)}`;
        return (
          <Modal visible={!!slipRow} transparent animationType="fade" statusBarTranslucent hardwareAccelerated onRequestClose={() => setSlipRow(null)}>
            <View style={styles.slipOverlay}>
              <View style={styles.slipSheet}>
                {/* Header */}
                <View style={styles.slipHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slipCompany}>{company}</Text>
                    <Text style={styles.slipSub}>{billType} · {month.toUpperCase()} {year}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                    <Text style={{ fontSize: 9, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 0.5 }}>TOTAL DUE</Text>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{currency} {total.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSlipRow(null)} style={[styles.slipClose, { marginLeft: 10 }]}>
                    <MaterialIcons name="close" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                {/* Ref strip */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>Ref: <Text style={{ fontWeight: '700', color: colors.text }}>{ref}</Text></Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>Due: <Text style={{ fontWeight: '700', color: colors.text }}>15 {dueMonth} {year}</Text></Text>
                </View>
                {/* Tenant info grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  {[{ label: 'TENANT', value: slipRow.tenantName || '—' }, { label: 'FLAT', value: slipRow.flat || '—' }, { label: 'PROPERTY', value: house || '—' }, { label: 'PERIOD', value: `${month} ${year}` }].map(item => (
                    <View key={item.label} style={{ width: '45%' }}>
                      <Text style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 1 }} numberOfLines={1}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                {/* Readings table header */}
                <View style={{ flexDirection: 'row', backgroundColor: colors.primaryXLight, borderBottomWidth: 1.5, borderBottomColor: colors.primaryLight }}>
                  {['PREV', 'PRESENT', 'USED', 'RATE'].map(h => (
                    <Text key={h} style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4, paddingVertical: 6 }}>{h}</Text>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  {[String(prev), String(pres), `${cons} units`, `${currency} ${uc}/unit`].map((v, i) => (
                    <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: i < 2 ? 13 : 11, fontWeight: i === 2 ? '800' : '600', color: i === 2 ? colors.primaryMid : colors.text, fontVariant: ['tabular-nums'], paddingVertical: 9 }}>{v}</Text>
                  ))}
                </View>
                {/* Charges */}
                <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>Water ({cons} × {currency} {uc})</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{currency} {waterCharge.toFixed(2)}</Text>
                  </View>
                  {arr > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, color: colors.dangerMid }}>Arrears</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.dangerMid, fontVariant: ['tabular-nums'] }}>+ {currency} {arr.toFixed(2)}</Text>
                    </View>
                  )}
                </View>
                {/* Total */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F2D57', paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Due</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{currency} {total.toFixed(2)}</Text>
                </View>
                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#25D366', borderRadius: 8, paddingVertical: 11 }}
                    onPress={() => { const r = slipRow; setSlipRow(null); exportSinglePDF(r); }}
                  >
                    <MaterialIcons name="picture-as-pdf" size={15} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Send PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.info, borderRadius: 8, paddingVertical: 11 }}
                    onPress={() => { setSlipRow(null); exportSinglePDF(slipRow); }}
                  >
                    <MaterialIcons name="picture-as-pdf" size={15} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Export PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  shareAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success, paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.sm },
  shareAllText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  readOnly: { justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
  readOnlyTxt: { fontSize: 14, color: colors.textSecondary },
  scroll: { flex: 1 },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: colors.textMuted, marginBottom: 8 },
  card: { ...card, marginBottom: 0, padding: spacing.md },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radius.sm, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, color: colors.text, backgroundColor: colors.inputBg },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },
  row3: { flexDirection: 'row', gap: 8 },
  picker: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radius.sm, paddingHorizontal: 11, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.inputBg, marginTop: 10 },
  pickerVal: { fontSize: 14, color: colors.text, flex: 1, marginRight: 4 },
  rowCard: { ...card, padding: spacing.md },
  walkTenant: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  lockChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  lockChipTxt: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  lockBox: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  lockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 7 },
  lockLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  lockValue: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'right', fontVariant: ['tabular-nums'] },
  bigLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 6 },
  bigInput: { borderWidth: 2, borderColor: colors.primaryMid, borderRadius: 8, paddingHorizontal: 14, minHeight: 60, fontSize: 24, fontWeight: '800', color: colors.text, backgroundColor: '#FFFFFF', fontVariant: ['tabular-nums'] },
  usedTxt: { fontSize: 13, fontWeight: '700', color: colors.success, marginTop: 8 },
  submittedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.successBg, borderWidth: 1.5, borderColor: colors.successBorder, borderRadius: 8, padding: 12 },
  submittedTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.success },
  rowCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  rowCardTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flatBadge: { backgroundColor: colors.primaryLight, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  flatBadgeText: { color: colors.primaryMid, fontWeight: '800', fontSize: 13 },
  rowTotal: { fontSize: 14, fontWeight: '800', color: colors.success },
  rowActions: { flexDirection: 'row', gap: 5 },
  rowActionBtn: { padding: 6, borderRadius: 6 },
  validationError: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.dangerBg, borderRadius: 4, padding: 7, marginBottom: 6 },
  spikeAlert: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningBg, borderRadius: 4, padding: 7, marginBottom: 6 },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, padding: 8, backgroundColor: colors.successBg, borderRadius: radius.sm },
  calcText: { fontSize: 12, color: colors.textSecondary },
  calcTotal: { fontSize: 13, fontWeight: '800', color: colors.success },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.primaryMid, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  addRowText: { fontSize: 12, fontWeight: '700', color: colors.primaryMid },
  grandCard: { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow.md },
  grandLabel: { fontSize: 13, color: 'rgba(255,255,255,.75)', fontWeight: '600' },
  grandSub: { fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 },
  grandValue: { fontSize: 24, fontWeight: '900', color: '#fff' },
  btnGreen: { backgroundColor: colors.success, borderRadius: radius.md, padding: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPurple: { backgroundColor: colors.purple, borderRadius: radius.md, padding: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  batchSafe: { flex: 1, backgroundColor: colors.background },
  batchHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  batchTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  batchSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 6, marginTop: 2 },
  tenantCard: { ...card, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tenantCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  tenantAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  tenantAvatarText: { fontWeight: '800', color: colors.primaryMid, fontSize: 16 },
  tenantName: { fontSize: 14, fontWeight: '700', color: colors.text },
  tenantFlat: { fontSize: 12, color: colors.textSecondary },
  tenantContact: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  tenantNoContact: { fontSize: 11, color: colors.amber, marginTop: 1 },
  tenantRight: { alignItems: 'flex-end', gap: 6 },
  tenantTotal: { fontSize: 15, fontWeight: '800', color: colors.success },
  tenantShareBtn: { backgroundColor: colors.success, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  tenantShareText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: 30 },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginVertical: 10 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerOptionText: { fontSize: 15, color: colors.text },
  pickerSelected: { color: colors.primaryMid, fontWeight: '700' },
  slipOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  slipSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, width: '100%', maxWidth: 420, overflow: 'hidden' },
  slipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#0F172A', padding: 14 },
  slipCompany: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  slipSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  slipClose: { backgroundColor: '#1E293B', borderRadius: 6, padding: 5 },
  slipTenantRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2 },
  slipTenantLbl: { fontSize: 11, color: colors.textMuted },
  slipTenantVal: { fontWeight: '700', color: colors.text },
  slipTable: { borderTopWidth: 1, borderTopColor: colors.border },
  slipFooter: { fontSize: 9, color: colors.textMuted, textAlign: 'center', padding: 10 },
  slipShareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', margin: 12, marginTop: 0, borderRadius: radius.sm, paddingVertical: 11 },
  headerPdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryMid, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm },
  headerPdfText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.md },
  tab: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 20, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primaryMid },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primaryMid, fontWeight: '800' },
  stickyBar: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  stickyBtnPDF: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.primaryMid, borderRadius: radius.md, paddingVertical: 14 },
  stickyBtnSend: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: 14 },
  stickyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowSendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderRadius: 8, paddingVertical: 8 },
  rowSendTxt: { fontSize: 12, fontWeight: '700' },
});
