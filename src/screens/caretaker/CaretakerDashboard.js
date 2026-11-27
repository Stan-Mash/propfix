import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { CONTRACTORS } from '../../data/seed';
import { usePortfolio } from '../../context/PortfolioContext';
import { useTickets } from '../../context/TicketsContext';
import ScreenHeader from '../../components/ScreenHeader';
import BottomSheet from '../../components/BottomSheet';
import PhotoPicker from '../../components/PhotoPicker';
import { logAudit } from '../../utils/auditLog';
import { fmtDay } from '../../utils/dates';
import { colors, spacing, card, accent } from '../../theme';

const ORDINAL = ['1st', '2nd', '3rd'];
const QUOTES_NEEDED = 2;
const shortName = (name = '') => name.replace(/\s+(Kenya|Ltd|Limited)\.?$/i, '');
const ticketPlace = (t) => (t.unit ? `Unit ${t.unit}` : t.areaLabel || 'Common Area');

export default function CaretakerDashboard({ navigation }) {
  const { userProfile, logout } = useAuth();
  const { tickets, addQuotation, updateTicketStatus } = useTickets();
  const { properties, units, getVariance } = usePortfolio();

  const site =
    properties.find(p => (userProfile?.assignedProperties || []).includes(p.id)) ||
    properties.find(p => p.caretakerId === userProfile?.uid) ||
    properties[0];
  const firstName = (userProfile?.name || 'Caretaker').split(' ')[0];
  const unitLabel = (t) => ticketPlace(t);

  // Guard: show empty state when no properties are assigned
  if (!site) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <MaterialIcons name="apartment" size={40} color={colors.textMuted} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 12 }}>No Site Assigned</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
          Your account has not been assigned to a property yet. Contact your landlord or manager.
        </Text>
      </View>
    );
  }

  // Today's queue is derived from live ticket and unit state, so finished tasks drop off
  const siteTickets = tickets.filter(t => t.propertyId === site.id);
  const quoteTasks = siteTickets.filter(t => ['reported', 'quotes_uploaded'].includes(t.status) && (t.quotations?.length || 0) < QUOTES_NEEDED);
  const workTasks = siteTickets.filter(t => ['approved', 'in_progress'].includes(t.status));
  const moveOutTasks = (units[site.id] || []).filter(u => u.status === 'on_notice');
  const leak = getVariance(site.id);
  const taskCount = quoteTasks.length + workTasks.length + moveOutTasks.length;

  const [flash, setFlash] = useState('');

  // Attach-quote sheet
  const [quoteTicket, setQuoteTicket] = useState(null);
  const [qContractor, setQContractor] = useState('');
  const [qPhone, setQPhone] = useState('');
  const [qLabour, setQLabour] = useState('');
  const [qMaterials, setQMaterials] = useState('');
  const [qPhoto, setQPhoto] = useState(null);
  const [qError, setQError] = useState('');

  // Mark-done sheet
  const [doneTicket, setDoneTicket] = useState(null);
  const [afterPhoto, setAfterPhoto] = useState(null);

  const openQuote = (t) => {
    setQContractor(''); setQPhone(''); setQLabour(''); setQMaterials(''); setQPhoto(null); setQError('');
    setQuoteTicket(t);
  };

  const qTotal = (parseFloat(qLabour) || 0) + (parseFloat(qMaterials) || 0);

  const saveQuote = async () => {
    if (!qPhoto) { setQError('Take a photo of the written quote first.'); return; }
    if (!qContractor.trim()) { setQError('Enter the contractor or fundi name.'); return; }
    if (!qPhone.trim()) { setQError('Enter the contractor phone number.'); return; }
    if (qTotal <= 0) { setQError('Enter the labour or materials cost.'); return; }
    const t = quoteTicket;
    addQuotation(t.id, {
      contractor: qContractor.trim(), phone: qPhone.trim(),
      labour: parseFloat(qLabour) || 0, materials: parseFloat(qMaterials) || 0, total: qTotal,
      photoUri: qPhoto.uri, recommended: false,
    });
    setQuoteTicket(null);
    setFlash(`Quote saved for ${unitLabel(t)} · ${t.title || t.category}. Sent to the manager for review.`);
    await logAudit({ userId: userProfile?.uid, role: userProfile?.role, action: 'ADD_QUOTATION', entityId: t.id, data: { total: qTotal } });
  };

  const openDone = (t) => { setAfterPhoto(null); setDoneTicket(t); };

  const markDone = async () => {
    if (!afterPhoto) return;
    const t = doneTicket;
    updateTicketStatus(t.id, 'pending_signoff', { afterPhoto });
    setDoneTicket(null);
    setFlash(`${t.title || t.category} marked done. Waiting for manager sign-off.`);
    await logAudit({ userId: userProfile?.uid, role: userProfile?.role, action: 'REQUEST_SIGNOFF', entityId: t.id });
  };

  return (
    <View style={s.root}>
      <ScreenHeader
        title="My Site"
        subtitle={`${site.name} · ${userProfile?.name || 'Caretaker'}`}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="settings" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={logout} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="logout" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>

        <Text style={s.greetHi}>Hello, {firstName}</Text>
        <Text style={s.greetSub}>{taskCount > 0 ? `${taskCount} task${taskCount !== 1 ? 's' : ''} need you at ${site.name} today.` : `Nothing is waiting on you at ${site.name}.`}</Text>

        {/* Primary action */}
        <TouchableOpacity style={s.reportBtn} onPress={() => navigation.navigate('LogIssue', { propertyId: site.id })} activeOpacity={0.85}>
          <MaterialIcons name="add-a-photo" size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={s.reportTxt}>Report New Damage</Text>
            <Text style={s.reportSub}>Photo / Video · {site.name}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        {flash ? (
          <View style={s.flash}>
            <MaterialIcons name="check-circle" size={20} color={colors.successMid} />
            <Text style={s.flashTxt}>{flash}</Text>
            <TouchableOpacity onPress={() => setFlash('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="close" size={18} color={colors.success} />
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={s.secTitle}>My Site Checklist Today ({site.name})</Text>

        {taskCount === 0 && (
          <View style={[s.task, { alignItems: 'center', paddingVertical: 24 }]}>
            <MaterialIcons name="task-alt" size={36} color={colors.successMid} />
            <Text style={[s.taskTitle, { marginTop: 8 }]}>All site tasks are done</Text>
            <Text style={s.taskLine}>New repairs you report will show up here when they need you.</Text>
          </View>
        )}

        {/* Upload Quote */}
        {quoteTasks.map(t => {
          const have = t.quotations?.length || 0;
          return (
            <View key={t.id} style={s.task}>
              <TaskChip icon="request-quote" label="Upload Quote" color={accent.info} />
              <Text style={s.taskTitle}>{unitLabel(t)} · {t.title || t.category}</Text>
              <View style={s.statusRow}>
                <MaterialIcons name="info" size={16} color={colors.warningMid} />
                <Text style={s.statusTxt}>Needs {ORDINAL[have] || 'another'} Local Quote</Text>
              </View>
              {have > 0 && <Text style={s.taskLine}>On file: {t.quotations.map(q => `${q.contractor} (KES ${q.total.toLocaleString()})`).join(', ')}</Text>}
              <TouchableOpacity style={[s.taskBtn, { backgroundColor: accent.info }]} onPress={() => openQuote(t)} activeOpacity={0.85}>
                <MaterialIcons name="add-a-photo" size={20} color="#fff" />
                <Text style={s.taskBtnTxt}>Attach Quote Photo</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Mark Work Done */}
        {workTasks.map(t => {
          const r = t.assignedRepairer;
          const rid = r?.workerId || r?.id;
          const rname = shortName(CONTRACTORS[rid]?.name || r?.name || 'Repairer');
          return (
            <View key={t.id} style={s.task}>
              <TaskChip icon="handyman" label="Mark Work Done" color={colors.successMid} />
              <Text style={s.taskTitle}>{unitLabel(t)} · {t.title || t.category}</Text>
              <Text style={s.taskLine}>
                Assigned: {rname}{rid ? ` (#${rid})` : ''}{t.expectedCompletion ? ` · Due: ${fmtDay(t.expectedCompletion, false)}` : ''}
              </Text>
              <TouchableOpacity style={[s.taskBtn, { backgroundColor: colors.successMid }]} onPress={() => openDone(t)} activeOpacity={0.85}>
                <MaterialIcons name="photo-camera" size={20} color="#fff" />
                <Text style={s.taskBtnTxt}>Upload 'After' Photo & Mark Done</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Move-Out Inspection */}
        {moveOutTasks.map(u => (
          <View key={u.id} style={s.task}>
            <TaskChip icon="assignment" label="Move-Out Inspection" color={colors.warningMid} />
            <Text style={s.taskTitle}>Unit {u.unit} · {u.tenant || 'Tenant'} (Vacating)</Text>
            <Text style={s.taskLine}>Check the unit and record any damage before the deposit is refunded.</Text>
            <TouchableOpacity style={[s.taskBtn, { backgroundColor: colors.warningMid }]} onPress={() => navigation.navigate('MoveOutInspection', { propertyId: site.id, unitId: u.unit })} activeOpacity={0.85}>
              <MaterialIcons name="assignment" size={20} color="#fff" />
              <Text style={s.taskBtnTxt}>Start Move-Out Inspection</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Site alert */}
        {leak?.hasLeak && (
          <View style={s.task}>
            <TaskChip icon="water-drop" label="Site Alert" color={colors.dangerMid} />
            <Text style={s.taskTitle}>Possible water leak on the main line</Text>
            <Text style={s.taskLine}>{leak.variancePct.toFixed(0)}% of the water through the master meter never reached a flat meter. Walk the compound and check taps, tanks and pipes.</Text>
          </View>
        )}

      </ScrollView>

      {/* Attach Quote sheet */}
      <BottomSheet visible={!!quoteTicket} onClose={() => setQuoteTicket(null)} maxHeight={0.9}>
        {quoteTicket && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Text style={s.sheetTitle}>Attach Quote</Text>
            <Text style={s.sheetSub}>{unitLabel(quoteTicket)} · {quoteTicket.title || quoteTicket.category}</Text>

            <PhotoPicker label="Take Photo of Written Quote" variant="button" value={qPhoto} onChange={(p) => { setQPhoto(p); setQError(''); }} propertyName={site.name} unitLabel={unitLabel(quoteTicket)} />

            <Text style={s.fieldLabel}>Contractor / Fundi Name</Text>
            <TextInput style={s.input} value={qContractor} onChangeText={setQContractor} placeholder="e.g. Nairobi Pipe Works" placeholderTextColor={colors.textMuted} />
            <Text style={s.fieldLabel}>Phone</Text>
            <TextInput style={s.input} value={qPhone} onChangeText={setQPhone} placeholder="+254..." placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Labour (KES)</Text>
                <TextInput style={s.input} value={qLabour} onChangeText={setQLabour} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Materials (KES)</Text>
                <TextInput style={s.input} value={qMaterials} onChangeText={setQMaterials} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
              </View>
            </View>
            {qTotal > 0 && <Text style={s.totalTxt}>Quote total: KES {qTotal.toLocaleString()}</Text>}
            {qError ? <Text style={s.errorTxt}>{qError}</Text> : null}

            <TouchableOpacity style={[s.taskBtn, { backgroundColor: accent.info, marginTop: 16 }]} onPress={saveQuote} activeOpacity={0.85}>
              <MaterialIcons name="check-circle" size={20} color="#fff" />
              <Text style={s.taskBtnTxt}>Save Quote</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>

      {/* After Photo & Mark Done sheet */}
      <BottomSheet visible={!!doneTicket} onClose={() => setDoneTicket(null)} maxHeight={0.9}>
        {doneTicket && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Text style={s.sheetTitle}>Mark Work Done</Text>
            <Text style={s.sheetSub}>{unitLabel(doneTicket)} · {doneTicket.title || doneTicket.category}</Text>

            <PhotoPicker label="Take 'After' Photo" variant="button" value={afterPhoto} onChange={setAfterPhoto} propertyName={site.name} unitLabel={unitLabel(doneTicket)} />
            <Text style={s.taskLine}>The photo goes to the manager, who signs off the repair before the contractor is paid.</Text>

            <TouchableOpacity
              style={[s.taskBtn, { backgroundColor: colors.successMid, marginTop: 16 }, !afterPhoto && { opacity: 0.45 }]}
              onPress={markDone}
              disabled={!afterPhoto}
              activeOpacity={0.85}
            >
              <MaterialIcons name="done-all" size={20} color="#fff" />
              <Text style={s.taskBtnTxt}>{afterPhoto ? 'Mark Work Done' : "Add the 'After' Photo First"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

function TaskChip({ icon, label, color }) {
  return (
    <View style={[s.chip, { backgroundColor: color + '1A' }]}>
      <MaterialIcons name={icon} size={14} color={color} />
      <Text style={[s.chipTxt, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  greetHi: { fontSize: 22, fontWeight: '800', color: colors.text },
  greetSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },

  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#16A34A', borderRadius: 16, paddingHorizontal: 18, minHeight: 72, elevation: 4, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6 },
  reportTxt: { fontSize: 17, fontWeight: '800', color: '#fff' },
  reportSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  flash: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.successBg, borderWidth: 1.5, borderColor: colors.successBorder, borderRadius: 8, padding: 12, marginTop: 14 },
  flashTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.success },

  secTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 20, marginBottom: 12 },

  task: { ...card, padding: 14, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipTxt: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  taskTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  taskLine: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusTxt: { fontSize: 13, fontWeight: '700', color: colors.warning },
  taskBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, minHeight: 52, paddingHorizontal: 12, marginTop: 4 },
  taskBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sheetSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, minHeight: 50, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg },
  totalTxt: { fontSize: 14, fontWeight: '800', color: colors.success, marginTop: 12 },
  errorTxt: { fontSize: 13, fontWeight: '600', color: colors.dangerMid, marginTop: 10 },
});
