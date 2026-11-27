import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, Linking, Image,
  TextInput, StyleSheet, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTickets } from '../../context/TicketsContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { UNITS, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, CONTRACTORS } from '../../data/seed';
import ScreenHeader from '../../components/ScreenHeader';
import PhotoPicker from '../../components/PhotoPicker';
import RepairPhoto from '../../components/RepairPhoto';
import { logAudit } from '../../utils/auditLog';
import { fmtDay, completionDelta } from '../../utils/dates';
import { colors, radius, spacing, card, accent } from '../../theme';

const LIFECYCLE = ['reported', 'quotes_uploaded', 'awaiting_approval', 'approved', 'in_progress', 'pending_signoff', 'resolved'];
const STAGE_LABELS = { reported: 'Reported', quotes_uploaded: 'Quotes', awaiting_approval: 'Pending', approved: 'Approved', in_progress: 'Active', pending_signoff: 'Sign-Off', resolved: 'Done' };
const fmt = (n) => 'KES ' + Number(n).toLocaleString();

export default function TicketDetailScreen({ route, navigation }) {
  const { ticketId } = route.params || {};
  const { userProfile } = useAuth();
  const { tickets, approveTicket, rejectTicket, updateTicketStatus, addQuotation, savePayment } = useTickets();
  const { settings } = useAppSettings();
  const ticket = tickets.find(t => t.id === ticketId);
  const role = userProfile?.role;

  const [gateInPhoto, setGateInPhoto] = useState(null);
  const [afterPhoto, setAfterPhoto] = useState(null);
  const paid = ticket?.payments || {};
  const [mpesaDeposit, setMpesaDeposit] = useState(paid.deposit ? String(paid.deposit.amount) : '');
  const [mpesaFinal, setMpesaFinal] = useState(paid.final ? String(paid.final.amount) : '');
  const [mpesaDepositCode, setMpesaDepositCode] = useState(paid.deposit?.code || '');
  const [mpesaFinalCode, setMpesaFinalCode] = useState(paid.final?.code || '');
  const [showMpesa, setShowMpesa] = useState(false);
  const [mpesaError, setMpesaError] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState([]);

  // Upload Quote modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [qContractor, setQContractor] = useState('');
  const [qPhone, setQPhone] = useState('');
  const [qLabour, setQLabour] = useState('');
  const [qMaterials, setQMaterials] = useState('');
  const [qDoc, setQDoc] = useState(null);
  const [qPhoto, setQPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docModalQuote, setDocModalQuote] = useState(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewIndex, setPhotoViewIndex] = useState(0);

  if (!ticket) {
    return (
      <View style={s.root}>
        <ScreenHeader title="Repair Detail" showBack />
        <View style={s.notFound}><Text style={s.notFoundTxt}>Ticket not found</Text></View>
      </View>
    );
  }

  const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS.reported;
  const pc = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.Routine;
  const stageIdx = LIFECYCLE.indexOf(ticket.status);
  const recommended = ticket.quotations?.find(q => q.recommended) || ticket.quotations?.find(q => q.id === ticket.selectedContractorId);

  const propUnits = UNITS[ticket.propertyId] || [];
  const tenantUnit = propUnits.find(u => u.unit === ticket.unit);
  const tenantPhone = tenantUnit?.phone;
  const tenantName = tenantUnit?.tenant;

  const openWA = (phone, text) => {
    const num = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
    const url = `whatsapp://send?phone=${num}&text=${encodeURIComponent(text)}`;
    Linking.canOpenURL(url).then(ok => ok ? Linking.openURL(url) : Alert.alert('WhatsApp not installed'));
  };

  const callPhone = (phone) => {
    const clean = phone.replace(/[\s\-()]/g, '');
    const url = `tel:${clean.startsWith('+') ? clean : '+' + clean}`;
    Linking.canOpenURL(url).then(ok => ok ? Linking.openURL(url) : Alert.alert('Calls not available'));
  };

  const sendTenantVerification = () => {
    if (!tenantPhone) { Alert.alert('No tenant phone on record'); return; }
    const msg = `Dear ${tenantName || 'Tenant'},\n\nThis is from ${settings.companyName.toUpperCase()}.\n\nOur team has completed the ${ticket.category} repair in your unit (${ticket.unit}) at ${ticket.propertyName}.\n\nPlease reply YES to confirm the work was completed satisfactorily.\n\nThank you.`;
    openWA(tenantPhone, msg);
  };

  const handleApprove = async (quotationId) => {
    await logAudit({ userId: userProfile?.uid, role, action: 'APPROVE', entityId: ticket.id, data: { quotationId } });
    approveTicket(ticket.id, quotationId);
  };

  const handleSavePayment = async () => {
    const dep = parseFloat(mpesaDeposit) || 0;
    const fin = parseFloat(mpesaFinal) || 0;
    const depCode = mpesaDepositCode.trim().toUpperCase();
    const finCode = mpesaFinalCode.trim().toUpperCase();
    if (dep <= 0 && fin <= 0 && !depCode && !finCode) { setMpesaError('Enter a KES amount and its M-Pesa code for the deposit or the final balance.'); return; }
    if ((dep > 0) !== !!depCode) { setMpesaError('The deposit needs both a KES amount and an M-Pesa code.'); return; }
    if ((fin > 0) !== !!finCode) { setMpesaError('The final balance needs both a KES amount and an M-Pesa code.'); return; }
    const payments = {};
    if (dep > 0) payments.deposit = { amount: dep, code: depCode };
    if (fin > 0) payments.final = { amount: fin, code: finCode };
    setMpesaError('');
    setMpesaDepositCode(depCode);
    setMpesaFinalCode(finCode);
    savePayment(ticket.id, payments);
    await logAudit({ userId: userProfile?.uid, role, action: 'SAVE_PAYMENT', entityId: ticket.id, data: payments });
  };

  const handleReject = async () => {
    await logAudit({ userId: userProfile?.uid, role, action: 'REJECT', entityId: ticket.id });
    rejectTicket(ticket.id);
  };

  const handleStatusUpdate = async (action, newStatus, guard) => {
    if (guard && !guard()) return;
    await logAudit({ userId: userProfile?.uid, role, action, entityId: ticket.id, data: { newStatus } });
    updateTicketStatus(ticket.id, newStatus);
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
      if (!res.canceled && res.assets?.[0]) {
        setUploadedDocs(prev => [...prev, { name: res.assets[0].name, uri: res.assets[0].uri, size: res.assets[0].size }]);
      }
    } catch (_) {}
  };

  const pickQuoteDoc = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
      if (!res.canceled && res.assets?.[0]) {
        setQDoc({ name: res.assets[0].name, uri: res.assets[0].uri });
      }
    } catch (_) {}
  };

  const submitQuotation = async () => {
    if (!qContractor.trim()) { Alert.alert('Contractor name is required'); return; }
    if (!qPhone.trim()) { Alert.alert('Contractor phone is required'); return; }
    const labour = parseFloat(qLabour) || 0;
    const materials = parseFloat(qMaterials) || 0;
    if (labour + materials === 0) { Alert.alert('Enter at least one cost (labour or materials)'); return; }
    setSubmitting(true);
    await logAudit({ userId: userProfile?.uid, role, action: 'ADD_QUOTATION', entityId: ticket.id });
    addQuotation(ticket.id, { contractor: qContractor.trim(), phone: qPhone.trim(), labour, materials, total: labour + materials, docUri: qDoc?.uri, photoUri: qPhoto?.uri, recommended: false });
    setQContractor(''); setQPhone(''); setQLabour(''); setQMaterials(''); setQDoc(null); setQPhoto(null);
    setSubmitting(false);
    setShowUploadModal(false);
  };

  const isPetty = recommended && recommended.total <= 2500 && role === 'manager';
  const canApprove = role === 'landlord' || role === 'manager';

  const repairer = ticket.assignedRepairer;
  const repairerId = repairer?.workerId || repairer?.id;
  const repairerInfo = CONTRACTORS[repairerId];
  const repairerName = repairerInfo?.name || repairer?.name;
  const repairerPhone = repairer?.phone || repairerInfo?.phone;
  const isResolved = ticket.status === 'resolved';
  const delta = completionDelta(ticket.expectedCompletion, ticket.actualCompletion);
  const stripe = isResolved ? accent.done : accent[ticket.priority] || accent.Routine;

  return (
    <View style={s.root}>
      <ScreenHeader title="Repair Detail" showBack />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {ticket.repeatAlert && ticket.previousRepair && (
          <View style={s.repeatBanner}>
            <MaterialIcons name="warning" size={16} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={s.repeatTitle}>Repeat Issue · Check Warranty</Text>
              <Text style={s.repeatSub}>Previously repaired {ticket.previousRepair.date} for {fmt(ticket.previousRepair.cost)} by {ticket.previousRepair.contractor}. Contractor may owe warranty rectification.</Text>
            </View>
          </View>
        )}

        {ticket.expenseTag === 'tenant_deposit' && (
          <View style={s.depositBanner}>
            <MaterialIcons name="person" size={14} color={colors.warningMid} />
            <Text style={s.depositTxt}>Cost to be deducted from tenant security deposit</Text>
          </View>
        )}

        {/* Main info card */}
        <View style={s.card}>
          <View style={s.infoRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={s.propName}>{ticket.propertyName}</Text>
              <Text style={s.locTxt}>{ticket.unit ? `Unit ${ticket.unit}` : ticket.areaLabel || 'Common Area'}</Text>
            </View>
            <View style={{ gap: 4, alignItems: 'flex-end' }}>
              <View style={{ backgroundColor: sc.bg, borderWidth: 1, borderColor: sc.border, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: sc.text }}>{STATUS_LABELS[ticket.status] || ticket.status}</Text>
              </View>
              <View style={{ backgroundColor: pc.bg, borderWidth: 1, borderColor: pc.border, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: pc.text }}>{ticket.priority}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={s.catBadge}><Text style={s.catTxt}>{ticket.category}</Text></View>
            {ticket.benchmarkCost > 0 && <Text style={{ fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>Benchmark: {fmt(ticket.benchmarkCost)}</Text>}
          </View>
          <Text style={s.descTxt}>{ticket.description}</Text>
          <Text style={s.dateTxt}>Logged: {new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>

        {/* Assigned repairer and dates */}
        {repairer && (
          <View style={[s.card, { marginTop: 0, gap: 10 }]}>
            <Text style={s.cardHeading}>{isResolved ? 'Fixed By' : 'Assigned Repairer'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.repAvatar}><MaterialIcons name="engineering" size={22} color={colors.primaryMid} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.repName}>{repairerName}</Text>
                <Text style={s.repMeta}>{repairerId ? `ID: ${repairerId}` : 'No worker ID'}{repairerInfo?.trade ? ` · ${repairerInfo.trade}` : ''}</Text>
              </View>
              {repairerPhone ? (
                <TouchableOpacity style={s.repCall} onPress={() => callPhone(repairerPhone)} activeOpacity={0.8}>
                  <MaterialIcons name="call" size={20} color={colors.primaryMid} />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={s.dateRow}>
              {ticket.expectedCompletion ? (
                <View style={s.dateBox}>
                  <Text style={s.dateLbl}>{isResolved ? 'Expected' : 'Due'}</Text>
                  <Text style={s.dateVal}>{fmtDay(ticket.expectedCompletion)}</Text>
                </View>
              ) : null}
              {ticket.actualCompletion ? (
                <View style={[s.dateBox, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}>
                  <Text style={[s.dateLbl, { color: colors.success }]}>Completed</Text>
                  <Text style={[s.dateVal, { color: colors.success }]}>{fmtDay(ticket.actualCompletion)}{delta ? ` (${delta})` : ''}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Lifecycle bar */}
        <View style={s.lifecycle}>
          {LIFECYCLE.map((stage, idx) => {
            const done = idx <= stageIdx; const active = idx === stageIdx;
            return (
              <React.Fragment key={stage}>
                {idx > 0 && <View style={[s.connector, done && { backgroundColor: colors.successMid }]} />}
                <View style={s.stageCol}>
                  <View style={[s.dot, done ? s.dotDone : s.dotPending, active && s.dotActive]}>
                    {done && !active && <MaterialIcons name="check" size={9} color="#fff" />}
                    {active && <View style={s.dotInner} />}
                  </View>
                  <Text style={[s.stageLbl, active && { color: colors.primaryMid }]}>{STAGE_LABELS[stage]}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Damage Photos & Videos */}
        {ticket.photos?.length > 0 && (
          <>
            <SectionHead title={`Photos & Videos of Damage (${ticket.photos.length})`} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 10, paddingBottom: 8 }}>
              {ticket.photos.map((p, i) => (
                <TouchableOpacity key={i} onPress={() => { setPhotoViewIndex(i); setShowPhotoViewer(true); }} activeOpacity={0.85}>
                  <RepairPhoto photo={p} category={ticket.category} style={{ width: 130, height: 96, borderRadius: 8, overflow: 'hidden' }} iconSize={36} showLabel />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Quotations */}
        {ticket.quotations?.length > 0 && (
          <>
            <SectionHead title="Quotations Received" />
            {ticket.quotations.map(q => {
              const isSelected = ticket.selectedContractorId === q.id;
              const isRec = q.recommended && !ticket.selectedContractorId;
              const hasImg = q.photoUri || (q.docUri && !q.docUri.toLowerCase().endsWith('.pdf'));
              const hasPdf = q.docUri && q.docUri.toLowerCase().endsWith('.pdf');
              const notSelected = !!ticket.selectedContractorId && !isSelected;
              return (
                <TouchableOpacity
                  key={q.id}
                  style={[s.bigQuoteCard, notSelected && { opacity: 0.6 }]}
                  onPress={() => { setDocModalQuote(q); setShowDocModal(true); }}
                  activeOpacity={0.88}
                >
                  {/* Contractor name + badge */}
                  <View style={s.bqTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.bqContractor}>{q.contractor}</Text>
                      <Text style={s.bqPhone}>{q.phone}</Text>
                    </View>
                    {isSelected && (
                      <View style={[s.bqSelBadge, { backgroundColor: '#16A34A' }]}>
                        <Text style={s.bqSelTxt}>Approved</Text>
                      </View>
                    )}
                    {isRec && !isSelected && (
                      <View style={[s.bqSelBadge, { backgroundColor: '#2563EB' }]}>
                        <Text style={s.bqSelTxt}>Best Price</Text>
                      </View>
                    )}
                    {notSelected && (
                      <View style={[s.bqSelBadge, { backgroundColor: '#64748B' }]}>
                        <Text style={s.bqSelTxt}>Not Selected</Text>
                      </View>
                    )}
                  </View>

                  {/* Total cost / big numbers */}
                  <View style={s.bqCostRow}>
                    <Text style={s.bqTotal}>{fmt(q.total)}</Text>
                    <Text style={s.bqBreak}>Labour: {fmt(q.labour)} · Materials: {fmt(q.materials)}</Text>
                  </View>

                  {/* Document thumbnail */}
                  {hasImg ? (
                    <View style={s.bqThumbWrap}>
                      <Image source={{ uri: q.photoUri || q.docUri }} style={s.bqThumb} />
                      <View style={s.bqThumbOverlay}>
                        <MaterialIcons name="open-in-full" size={18} color="#fff" />
                        <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700', marginTop: 3 }}>Tap to view full document</Text>
                      </View>
                    </View>
                  ) : hasPdf ? (
                    <View style={[s.bqThumbWrap, { backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }]}>
                      <MaterialIcons name="description" size={44} color={colors.primaryMid} />
                      <Text style={{ fontSize: 14, color: colors.primaryMid, fontWeight: '700', marginTop: 8 }}>PDF Quote Document</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Tap to view</Text>
                    </View>
                  ) : q.document ? (
                    <View style={[s.bqThumbWrap, { backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#93C5FD', justifyContent: 'center', alignItems: 'center', borderRadius: 10 }]}>
                      <MaterialIcons name="description" size={44} color="#2563EB" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#1D4ED8', marginTop: 8, textAlign: 'center', paddingHorizontal: 10 }} numberOfLines={2}>{q.document.fileName}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB', marginTop: 6 }}>Tap to View Full Document</Text>
                    </View>
                  ) : (
                    <View style={[s.bqThumbWrap, { backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' }]}>
                      <MaterialIcons name="insert-drive-file" size={36} color={colors.border} />
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>No document attached</Text>
                    </View>
                  )}

                  {/* Warnings */}
                  {ticket.benchmarkCost > 0 && q.total > ticket.benchmarkCost * 1.2 && (
                    <View style={[s.overBudget, { marginHorizontal: 14, marginBottom: 10 }]}>
                      <MaterialIcons name="error" size={14} color={colors.warningMid} />
                      <Text style={{ fontSize: 13, color: colors.warningMid, flex: 1 }}>20%+ above benchmark ({fmt(ticket.benchmarkCost)})</Text>
                    </View>
                  )}
                  {isPetty && ticket.status === 'awaiting_approval' && isRec && (
                    <View style={[s.pettyNote, { marginHorizontal: 14, marginBottom: 10 }]}>
                      <MaterialIcons name="flash-on" size={14} color={colors.primaryMid} />
                      <Text style={{ fontSize: 13, color: colors.primaryMid, flex: 1 }}>Within KES 2,500 petty cash limit · you can approve directly</Text>
                    </View>
                  )}

                  {/* Footer: call / WA / approve */}
                  <View style={s.bqFoot}>
                    <TouchableOpacity style={s.callBtn} onPress={() => callPhone(q.phone)}>
                      <MaterialIcons name="call" size={16} color={colors.primaryMid} />
                      <Text style={s.callTxt}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.waBtn} onPress={() => openWA(q.phone, `Dear ${q.contractor}, re: ${ticket.category} repair at ${ticket.propertyName}. Please confirm your quote of ${fmt(q.total)} and availability.`)}>
                      <MaterialIcons name="chat" size={16} color="#25D366" />
                      <Text style={s.waTxt}>WhatsApp</Text>
                    </TouchableOpacity>
                    {canApprove && ticket.status === 'awaiting_approval' && !ticket.selectedContractorId && (
                      <TouchableOpacity style={[s.approveQuoteBtn, { flex: 1, paddingVertical: 10 }]} onPress={() => handleApprove(q.id)} activeOpacity={0.85}>
                        <MaterialIcons name="check-circle" size={16} color="#fff" />
                        <Text style={s.approveQuoteTxt}>Approve</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Upload Quote button */}
        {(role === 'caretaker' || role === 'manager') && !['resolved', 'rejected', 'approved', 'in_progress', 'pending_signoff'].includes(ticket.status) && (
          <>
            <SectionHead title="Quote Documents" />
            <View style={{ paddingHorizontal: spacing.md, marginBottom: 8 }}>
              {uploadedDocs.map((d, i) => (
                <View key={i} style={s.docRow}>
                  <MaterialIcons name="attach-file" size={16} color={colors.primaryMid} />
                  <Text style={{ flex: 1, fontSize: 12, color: colors.text }} numberOfLines={1}>{d.name}</Text>
                  <TouchableOpacity onPress={() => setUploadedDocs(p => p.filter((_, j) => j !== i))}>
                    <MaterialIcons name="cancel" size={16} color={colors.dangerMid} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.uploadBtn} onPress={() => setShowUploadModal(true)}>
                <MaterialIcons name="cloud-upload" size={16} color={colors.primaryMid} />
                <Text style={{ fontSize: 13, color: colors.primaryMid, fontWeight: '600' }}>+ Upload Quote</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Gate-in photo */}
        {role === 'caretaker' && ticket.status === 'approved' && (
          <>
            <SectionHead title="Materials Gate-In Evidence" />
            <View style={{ paddingHorizontal: spacing.md }}>
              <PhotoPicker label="Materials Delivered Photo (Required to start work)" value={gateInPhoto} onChange={setGateInPhoto} propertyName={ticket.propertyName} unitLabel={ticket.unit ? `Unit ${ticket.unit}` : ticket.areaLabel} />
            </View>
          </>
        )}

        {/* After photo */}
        {role === 'caretaker' && ticket.status === 'in_progress' && (
          <>
            <SectionHead title="Completion Evidence" />
            <View style={{ paddingHorizontal: spacing.md }}>
              <PhotoPicker label="After Photo (Required to request sign-off)" value={afterPhoto} onChange={setAfterPhoto} propertyName={ticket.propertyName} unitLabel={ticket.unit ? `Unit ${ticket.unit}` : ticket.areaLabel} />
            </View>
          </>
        )}

        {/* M-Pesa tracking */}
        {canApprove && ['approved', 'in_progress', 'pending_signoff'].includes(ticket.status) && (
          <>
            <TouchableOpacity style={s.mpesaToggle} onPress={() => setShowMpesa(!showMpesa)}>
              <MaterialIcons name="smartphone" size={14} color={colors.successMid} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.successMid, flex: 1 }}>M-Pesa Payment Tracking</Text>
              <MaterialIcons name={showMpesa ? 'expand-less' : 'expand-more'} size={14} color={colors.successMid} />
            </TouchableOpacity>
            {(ticket.payments?.deposit || ticket.payments?.final) && (
              <View style={{ paddingHorizontal: spacing.md, paddingTop: 8, gap: 6 }}>
                {['deposit', 'final'].filter(k => ticket.payments[k]).map(k => (
                  <View key={k} style={s.verifiedBadge}>
                    <MaterialIcons name="verified" size={18} color={colors.successMid} />
                    <Text style={s.verifiedTxt}>Verified: M-Pesa Ref {ticket.payments[k].code}</Text>
                    <Text style={s.verifiedAmt}>{k === 'deposit' ? 'Deposit' : 'Final'} {fmt(ticket.payments[k].amount)}</Text>
                  </View>
                ))}
              </View>
            )}
            {showMpesa && (
              <View style={{ paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 12 }}>
                <Text style={s.mpesaLabel}>Deposit Payment</Text>
                <View style={s.mpesaRow}>
                  <TextInput style={[s.mpesaInput, { flex: 1 }]} value={mpesaDeposit} onChangeText={setMpesaDeposit} placeholder="KES amount" keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[s.mpesaInput, { flex: 1 }]} value={mpesaDepositCode} onChangeText={setMpesaDepositCode} placeholder="M-Pesa code" autoCapitalize="characters" placeholderTextColor={colors.textMuted} />
                </View>
                <Text style={[s.mpesaLabel, { marginTop: 8 }]}>Final Balance Payment</Text>
                <View style={s.mpesaRow}>
                  <TextInput style={[s.mpesaInput, { flex: 1 }]} value={mpesaFinal} onChangeText={setMpesaFinal} placeholder="KES amount" keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[s.mpesaInput, { flex: 1 }]} value={mpesaFinalCode} onChangeText={setMpesaFinalCode} placeholder="M-Pesa code" autoCapitalize="characters" placeholderTextColor={colors.textMuted} />
                </View>
                {mpesaError ? <Text style={{ fontSize: 13, fontWeight: '600', color: colors.dangerMid, marginTop: 10 }}>{mpesaError}</Text> : null}
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.successMid, marginTop: 12 }]} onPress={handleSavePayment} activeOpacity={0.85}>
                  <MaterialIcons name="save" size={18} color="#fff" />
                  <Text style={s.actionTxt}>Save Payment Record</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* After photo sent in by the caretaker */}
        {ticket.afterPhoto?.uri && (
          <>
            <SectionHead title="Completion Evidence ('After' Photo)" />
            <View style={{ paddingHorizontal: spacing.md }}>
              <Image source={{ uri: ticket.afterPhoto.uri }} style={{ width: '100%', height: 200, borderRadius: 8 }} resizeMode="cover" />
              {ticket.afterPhoto.timestamp ? <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>Taken {ticket.afterPhoto.timestamp}</Text> : null}
            </View>
          </>
        )}

        {/* Tenant WA verification */}
        {ticket.unit && tenantPhone && ticket.status === 'pending_signoff' && (
          <>
            <SectionHead title="Tenant Verification" />
            <View style={{ paddingHorizontal: spacing.md, marginBottom: 8 }}>
              <View style={s.verifyCard}>
                <MaterialIcons name="account-circle" size={22} color={colors.primaryMid} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{tenantName || 'Tenant'} - Unit {ticket.unit}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>{tenantPhone}</Text>
                </View>
                <TouchableOpacity style={s.verifyBtn} onPress={sendTenantVerification}>
                  <MaterialIcons name="chat" size={14} color="#25D366" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#128C7E' }}>Send Verify</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Role action buttons */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: 14, gap: 8 }}>
          {canApprove && ticket.status === 'awaiting_approval' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.dangerMid }]} onPress={handleReject} activeOpacity={0.85}>
              <MaterialIcons name="close" size={16} color="#fff" />
              <Text style={s.actionTxt}>Reject All Quotes</Text>
            </TouchableOpacity>
          )}
          {canApprove && ticket.status === 'awaiting_approval' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#92400E' }]} onPress={() => {
              Alert.alert(
                'Send Back for New Quotes?',
                'This will reset the ticket status to Reported so the caretaker can get cheaper quotes. The existing quotes will remain visible.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Send Back', style: 'destructive', onPress: async () => {
                    await logAudit({ userId: userProfile?.uid, role, action: 'REQUEST_CHEAPER_QUOTE', entityId: ticket.id });
                    updateTicketStatus(ticket.id, 'reported');
                  }},
                ]
              );
            }} activeOpacity={0.85}>
              <MaterialIcons name="local-offer" size={16} color="#fff" />
              <Text style={s.actionTxt}>Send Back for Cheaper Quotes</Text>
            </TouchableOpacity>
          )}
          {role === 'manager' && ticket.status === 'quotes_uploaded' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.purpleMid }]} onPress={async () => {
              await logAudit({ userId: userProfile?.uid, role, action: 'FORWARD_TO_LANDLORD', entityId: ticket.id });
              updateTicketStatus(ticket.id, 'awaiting_approval');
            }} activeOpacity={0.85}>
              <MaterialIcons name="arrow-upward" size={16} color="#fff" />
              <Text style={s.actionTxt}>Forward to Landlord for Approval</Text>
            </TouchableOpacity>
          )}
          {role === 'caretaker' && ticket.status === 'reported' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primaryMid }]} onPress={async () => {
              await logAudit({ userId: userProfile?.uid, role, action: 'UPLOAD_QUOTES', entityId: ticket.id });
              updateTicketStatus(ticket.id, 'quotes_uploaded');
            }} activeOpacity={0.85}>
              <MaterialIcons name="attach-file" size={16} color="#fff" />
              <Text style={s.actionTxt}>Submit Quotes for Approval</Text>
            </TouchableOpacity>
          )}
          {role === 'caretaker' && ticket.status === 'approved' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.info }]}
              onPress={() => handleStatusUpdate('START_WORK', 'in_progress', () => {
                if (!gateInPhoto) { Alert.alert('Required', 'Upload the Materials Gate-In photo first'); return false; }
                return true;
              })} activeOpacity={0.85}>
              <MaterialIcons name="handyman" size={16} color="#fff" />
              <Text style={s.actionTxt}>Mark In Progress</Text>
            </TouchableOpacity>
          )}
          {role === 'caretaker' && ticket.status === 'in_progress' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.purpleMid }]}
              onPress={() => handleStatusUpdate('REQUEST_SIGNOFF', 'pending_signoff', () => {
                if (!afterPhoto) { Alert.alert('Required', 'Upload the After photo first'); return false; }
                return true;
              })} activeOpacity={0.85}>
              <MaterialIcons name="assignment" size={16} color="#fff" />
              <Text style={s.actionTxt}>Request Sign-Off</Text>
            </TouchableOpacity>
          )}
          {canApprove && ticket.status === 'pending_signoff' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.successMid }]}
              onPress={() => handleStatusUpdate('MARK_RESOLVED', 'resolved')} activeOpacity={0.85}>
              <MaterialIcons name="done-all" size={16} color="#fff" />
              <Text style={s.actionTxt}>Mark Resolved</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* Upload Quote Modal */}
      <Modal visible={showUploadModal} transparent animationType="slide" statusBarTranslucent hardwareAccelerated onRequestClose={() => setShowUploadModal(false)}>
        <Pressable style={s.overlay} onPress={() => setShowUploadModal(false)}>
          <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Upload Quote</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 32 }}>
              <ModalField label="Contractor Name *" value={qContractor} onChangeText={setQContractor} placeholder="e.g. John Plumbers" />
              <ModalField label="Phone *" value={qPhone} onChangeText={setQPhone} placeholder="+254..." keyboardType="phone-pad" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <ModalField label="Labour (KES)" value={qLabour} onChangeText={setQLabour} placeholder="0" keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <ModalField label="Materials (KES)" value={qMaterials} onChangeText={setQMaterials} placeholder="0" keyboardType="decimal-pad" />
                </View>
              </View>
              {(parseFloat(qLabour) || 0) + (parseFloat(qMaterials) || 0) > 0 && (
                <View style={s.calcSummary}>
                  <Text style={s.calcSummaryTxt}>Total: {fmt((parseFloat(qLabour) || 0) + (parseFloat(qMaterials) || 0))}</Text>
                </View>
              )}
              <Text style={s.fieldLabel}>Attach Quote (PDF or Photo)</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity style={[s.attachBtn, qDoc && { borderColor: colors.successBorder }]} onPress={pickQuoteDoc}>
                  <MaterialIcons name="attach-file" size={16} color={qDoc ? colors.successMid : colors.primaryMid} />
                  <Text style={{ fontSize: 12, color: qDoc ? colors.successMid : colors.primaryMid, fontWeight: '600' }}>{qDoc ? qDoc.name.slice(0, 20) + '...' : 'PDF / Image'}</Text>
                </TouchableOpacity>
              </View>
              <PhotoPicker label="Site Photo" value={qPhoto} onChange={setQPhoto} propertyName={ticket.propertyName} unitLabel={ticket.unit ? `Unit ${ticket.unit}` : ''} />
              <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={submitQuotation} disabled={submitting} activeOpacity={0.85}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <MaterialIcons name="check-circle" size={16} color="#fff" />
                    <Text style={s.actionTxt}>Save Quotation</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full-Screen Damage Photo Viewer Modal */}
      <Modal visible={showPhotoViewer} transparent={false} animationType="fade" statusBarTranslucent hardwareAccelerated onRequestClose={() => setShowPhotoViewer(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#000' }}>
            <TouchableOpacity onPress={() => setShowPhotoViewer(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center' }}>
              Damage Evidence ({photoViewIndex + 1}/{ticket.photos?.length || 0})
            </Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setPhotoViewIndex(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width))}
            contentOffset={{ x: photoViewIndex * 375, y: 0 }}
          >
            {(ticket.photos || []).map((p, i) => (
              <View key={i} style={{ width: 375, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                {p.type === 'video' ? (
                  <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
                    <MaterialIcons name="play-circle-filled" size={80} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 16, marginTop: 12, fontWeight: '700' }}>Video · {p.duration || '0:15'}</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>Video playback not available in preview</Text>
                  </View>
                ) : p.uri ? (
                  <Image source={{ uri: p.uri }} style={{ width: 375, height: 400 }} resizeMode="contain" />
                ) : (
                  <RepairPhoto photo={p} category={ticket.category} style={{ width: 300, height: 300, borderRadius: 16, backgroundColor: '#F1F5F9' }} iconSize={96} showLabel />
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Full-Screen Quote Document Modal */}
      <Modal visible={showDocModal} transparent={false} animationType="slide" statusBarTranslucent hardwareAccelerated onRequestClose={() => setShowDocModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Header */}
          <View style={{ paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#0F172A', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setShowDocModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>{docModalQuote?.contractor}</Text>
              <Text style={{ fontSize: 15, color: '#94A3B8', marginTop: 2 }}>{docModalQuote?.phone}</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#22C55E' }}>{fmt(docModalQuote?.total || 0)}</Text>
          </View>

          {/* Document area */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            {(docModalQuote?.photoUri || (docModalQuote?.docUri && !docModalQuote?.docUri?.toLowerCase().endsWith('.pdf'))) ? (
              <Image
                source={{ uri: docModalQuote.photoUri || docModalQuote.docUri }}
                style={{ width: '100%', height: 420 }}
                resizeMode="contain"
              />
            ) : docModalQuote?.docUri ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                <MaterialIcons name="description" size={80} color="#475569" />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#94A3B8', marginTop: 16, textAlign: 'center' }}>PDF Document</Text>
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center' }}>{docModalQuote.docUri.split('/').pop()}</Text>
              </View>
            ) : docModalQuote?.document ? (
              <View style={{ backgroundColor: '#fff', margin: 12, borderRadius: 12, overflow: 'hidden' }}>
                {/* Invoice header */}
                <View style={{ backgroundColor: '#1E3A5F', padding: 18, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#93C5FD', letterSpacing: 1, textTransform: 'uppercase' }}>PROFORMA INVOICE / QUOTATION</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', marginTop: 4 }}>{docModalQuote.contractor}</Text>
                  <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{docModalQuote.phone}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>KRA PIN: {docModalQuote.document.kraPin}</Text>
                </View>
                {/* Meta row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                  <View>
                    <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Reference</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A', marginTop: 2 }}>{docModalQuote.document.fileName.replace('.pdf', '')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Date</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A', marginTop: 2 }}>{docModalQuote.document.date}</Text>
                  </View>
                </View>
                {/* Bill to */}
                <View style={{ backgroundColor: '#F8FAFC', marginHorizontal: 14, marginTop: 12, borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 }}>BILL TO</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{settings.companyName.toUpperCase()}</Text>
                  <Text style={{ fontSize: 12, color: '#475569', marginTop: 1 }}>Re: {ticket.category} Repair · {ticket.propertyName}</Text>
                </View>
                {/* Items table */}
                <View style={{ margin: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                  <View style={{ backgroundColor: '#1E3A5F', flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#93C5FD' }}>ITEM / DESCRIPTION</Text>
                    <Text style={{ width: 36, fontSize: 10, fontWeight: '700', color: '#93C5FD', textAlign: 'center' }}>QTY</Text>
                    <Text style={{ width: 90, fontSize: 10, fontWeight: '700', color: '#93C5FD', textAlign: 'right' }}>AMOUNT (KES)</Text>
                  </View>
                  {(docModalQuote.document.items || []).map((item, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: idx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                      <Text style={{ flex: 1, fontSize: 12, color: '#0F172A' }}>{item.desc}</Text>
                      <Text style={{ width: 36, fontSize: 12, color: '#475569', textAlign: 'center' }}>{item.qty}</Text>
                      <Text style={{ width: 90, fontSize: 12, fontWeight: '600', color: '#0F172A', textAlign: 'right', fontVariant: ['tabular-nums'] }}>{Number(item.cost).toLocaleString()}</Text>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#1E3A5F' }}>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: '#fff' }}>GRAND TOTAL</Text>
                    <Text style={{ width: 90, fontSize: 17, fontWeight: '900', color: '#22C55E', textAlign: 'right', fontVariant: ['tabular-nums'] }}>{Number(docModalQuote.total).toLocaleString()}</Text>
                  </View>
                </View>
                {/* Digital stamp */}
                <View style={{ alignItems: 'center', paddingBottom: 20 }}>
                  <View style={{ borderWidth: 2, borderColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 0.5 }}>DIGITALLY ISSUED BY</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A', marginTop: 2 }}>{docModalQuote.contractor}</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{docModalQuote.document.date}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                <MaterialIcons name="insert-drive-file" size={60} color="#334155" />
                <Text style={{ fontSize: 15, color: '#64748B', marginTop: 12 }}>No document was attached to this quote</Text>
              </View>
            )}

            {/* Cost breakdown */}
            <View style={{ backgroundColor: '#1E293B', margin: 16, borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Quote Breakdown</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 15, color: '#CBD5E1' }}>Labour</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{fmt(docModalQuote?.labour || 0)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 15, color: '#CBD5E1' }}>Materials</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{fmt(docModalQuote?.materials || 0)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>TOTAL</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#22C55E' }}>{fmt(docModalQuote?.total || 0)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Sticky action buttons */}
          {canApprove && ticket.status === 'awaiting_approval' && !ticket.selectedContractorId && docModalQuote && (
            <View style={{ flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#0F172A', paddingBottom: 32 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                onPress={() => { handleReject(); setShowDocModal(false); }}
                activeOpacity={0.85}
              >
                <MaterialIcons name="cancel" size={22} color="#fff" />
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>REJECT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                onPress={() => { handleApprove(docModalQuote.id); setShowDocModal(false); }}
                activeOpacity={0.85}
              >
                <MaterialIcons name="check-circle" size={22} color="#fff" />
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>APPROVE QUOTE</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function SectionHead({ title }) {
  return <View style={{ paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 8 }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{title}</Text></View>;
}

function QuoteCol({ label, value, bold }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? '800' : '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function ModalField({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.fieldInput} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted} keyboardType={keyboardType || 'default'} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundTxt: { fontSize: 14, color: colors.textMuted },
  repeatBanner: { flexDirection: 'row', gap: 10, margin: spacing.md, marginBottom: 0, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radius.sm, padding: 12 },
  repeatTitle: { fontSize: 12, fontWeight: '700', color: colors.danger },
  repeatSub: { fontSize: 11, color: colors.danger, opacity: 0.85, marginTop: 2 },
  depositBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginTop: 8, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 6 },
  depositTxt: { fontSize: 11, fontWeight: '600', color: colors.warningMid },
  card: { ...card, margin: spacing.md, marginTop: 14, marginBottom: 14, padding: 14 },
  cardHeading: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  repAvatar: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primaryXLight, justifyContent: 'center', alignItems: 'center' },
  repName: { fontSize: 16, fontWeight: '800', color: colors.text },
  repMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  repCall: { width: 48, height: 48, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primaryLight, backgroundColor: colors.primaryXLight, justifyContent: 'center', alignItems: 'center' },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateBox: { flex: 1, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  dateLbl: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  dateVal: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 2 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.successBg, borderWidth: 1.5, borderColor: colors.successBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  verifiedTxt: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.success },
  verifiedAmt: { fontSize: 12, fontWeight: '700', color: colors.success, fontVariant: ['tabular-nums'] },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  propName: { fontSize: 15, fontWeight: '700', color: colors.text },
  locTxt: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  catBadge: { backgroundColor: colors.primaryLight, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  catTxt: { fontSize: 11, fontWeight: '700', color: colors.primaryMid },
  descTxt: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 8 },
  dateTxt: { fontSize: 11, color: colors.textMuted },
  lifecycle: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 14, backgroundColor: colors.surface, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.borderStrong },
  stageCol: { alignItems: 'center', gap: 4 },
  dot: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  dotDone: { backgroundColor: colors.successMid },
  dotPending: { backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primaryMid },
  dotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  connector: { flex: 1, height: 2, backgroundColor: colors.border, marginTop: 8 },
  stageLbl: { fontSize: 7, color: colors.textMuted, textAlign: 'center', fontWeight: '600' },
  quoteCard: { marginHorizontal: spacing.md, marginBottom: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
  recBadge: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBorder, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  overBudget: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningBg, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  pettyNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryXLight, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  contactRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'center', backgroundColor: colors.primaryXLight, borderWidth: 1, borderColor: colors.primaryLight, borderRadius: 8, minHeight: 44 },
  callTxt: { fontSize: 12, color: colors.primaryMid, fontWeight: '600' },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'center', backgroundColor: '#E7F8F0', borderWidth: 1, borderColor: '#25D36640', borderRadius: 8, minHeight: 44 },
  waTxt: { fontSize: 12, color: '#128C7E', fontWeight: '600' },
  quoteActions: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  approveQuoteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.successMid, borderRadius: 8, minHeight: 44 },
  approveQuoteTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.primaryMid, borderStyle: 'dashed', borderRadius: 8, minHeight: 50, backgroundColor: colors.surface },
  mpesaToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginTop: 14, backgroundColor: colors.successBg, borderWidth: 1.5, borderColor: colors.successBorder, borderRadius: 8, paddingHorizontal: 12, minHeight: 50 },
  mpesaLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
  mpesaRow: { flexDirection: 'row', gap: 8 },
  mpesaInput: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, minHeight: 50, fontSize: 14, color: colors.text },
  verifyCard: { ...card, marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E7F8F0', borderWidth: 1, borderColor: '#25D36640', borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 7 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, paddingVertical: 15, minHeight: 52 },
  actionTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '90%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginVertical: 10 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.text, paddingHorizontal: spacing.md, paddingBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 },
  fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.text, backgroundColor: colors.inputBg },
  calcSummary: { backgroundColor: colors.successBg, borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 10 },
  calcSummaryTxt: { fontSize: 13, fontWeight: '700', color: colors.successMid },
  attachBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, borderWidth: 1.5, borderColor: colors.primaryMid, borderStyle: 'dashed', borderRadius: radius.xs, paddingHorizontal: 10, paddingVertical: 10 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.successMid, borderRadius: radius.sm, paddingVertical: 14, marginTop: 8 },
  bigQuoteCard: { ...card, marginHorizontal: spacing.md, overflow: 'hidden' },
  bqTop: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, paddingBottom: 10 },
  bqContractor: { fontSize: 18, fontWeight: '800', color: colors.text },
  bqPhone: { fontSize: 15, color: colors.textSecondary, marginTop: 3 },
  bqSelBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  bqSelTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  bqCostRow: { paddingHorizontal: 16, paddingBottom: 12 },
  bqTotal: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  bqBreak: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  bqThumbWrap: { marginHorizontal: 14, marginBottom: 12, height: 160, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  bqThumb: { width: '100%', height: '100%', resizeMode: 'cover' },
  bqThumbOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, alignItems: 'center' },
  bqFoot: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, gap: 8 },
});
