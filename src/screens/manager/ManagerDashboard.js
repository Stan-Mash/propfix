import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { PROPERTIES, UNITS, STATUS_COLORS, PRIORITY_COLORS } from '../../data/seed';
import { useTickets } from '../../context/TicketsContext';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, radius, spacing, card, accent } from '../../theme';

const fmt = (n) => 'KES ' + n.toLocaleString();

export default function ManagerDashboard({ navigation }) {
  const { userProfile } = useAuth();
  const { tickets: allTickets } = useTickets();

  // Manager sees properties assigned to them
  const myProperties = PROPERTIES.filter(p => p.managerId === userProfile?.uid);
  const allProps = myProperties.length > 0 ? myProperties : PROPERTIES;

  const myPropIds = new Set(allProps.map(p => p.id));
  const myTickets = allTickets.filter(t => myPropIds.has(t.propertyId));

  const escalated = myTickets.filter(t => ['Emergency', 'Urgent'].includes(t.priority) && !['resolved', 'rejected'].includes(t.status));
  const needsAction = myTickets.filter(t => ['reported', 'quotes_uploaded', 'awaiting_approval'].includes(t.status));
  const openCount = myTickets.filter(t => !['resolved', 'rejected'].includes(t.status)).length;
  const totalSpend = allProps.reduce((s, p) => s + p.monthlySpend, 0);

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Dashboard"
        subtitle={userProfile?.name || 'Property Manager'}
        rightAction={
          <TouchableOpacity style={s.hdrBtn} onPress={() => navigation.navigate('Settings')}>
            <MaterialIcons name="settings" size={18} color="#94A3B8" />
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Metrics row */}
        <View style={s.metricsRow}>
          <MetricCard label="My Properties" value={String(allProps.length)} icon="business" color={colors.purpleMid} />
          <MetricCard label="Open Repairs" value={String(openCount)} icon="build" color={colors.warningMid} />
          <MetricCard label="Monthly Spend" value={fmt(totalSpend)} icon="credit-card" color={colors.primaryMid} wide />
        </View>

        {/* Escalation banner */}
        {escalated.length > 0 && (
          <TouchableOpacity style={s.escalBanner} onPress={() => navigation.navigate('Maintenance')} activeOpacity={0.8}>
            <MaterialIcons name="error" size={18} color={colors.danger} />
            <Text style={s.escalTxt}>{escalated.length} urgent/emergency repair{escalated.length !== 1 ? 's' : ''} need attention</Text>
            <MaterialIcons name="chevron-right" size={14} color={colors.danger} />
          </TouchableOpacity>
        )}

        {/* Needs action */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>{needsAction.length > 0 ? `${needsAction.length} repair${needsAction.length !== 1 ? 's' : ''} need your attention` : 'Needs Action'}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Maintenance')}><Text style={s.seeAll}>View all</Text></TouchableOpacity>
        </View>
        {needsAction.length === 0 ? (
          <View style={s.empty}>
            <MaterialIcons name="check-circle-outline" size={32} color={colors.successBorder} />
            <Text style={s.emptyTxt}>All caught up</Text>
          </View>
        ) : needsAction.map(t => (
          <TicketRow key={t.id} ticket={t} onPress={() => navigation.navigate('TicketDetail', { ticketId: t.id })} />
        ))}

        {/* My properties */}
        <View style={[s.secRow, { marginTop: 8 }]}>
          <Text style={s.secTitle}>My Properties</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Portfolio')}><Text style={s.seeAll}>View all</Text></TouchableOpacity>
        </View>
        {allProps.map(p => {
          const units = UNITS[p.id] || [];
          const occupied = units.filter(u => u.status === 'occupied').length;
          const openHere = myTickets.filter(t => t.propertyId === p.id && !['resolved', 'rejected'].includes(t.status)).length;
          return (
            <TouchableOpacity key={p.id} style={s.pCard} onPress={() => navigation.navigate('UnitRoster', { propertyId: p.id })} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={s.pName}>{p.name}</Text>
                <Text style={s.pSub}>{p.location} · {occupied}/{units.length} occupied</Text>
              </View>
              {openHere > 0 && (
                <View style={s.openBadge}><Text style={s.openTxt}>{openHere} open</Text></View>
              )}
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          );
        })}

      </ScrollView>
    </View>
  );
}

function MetricCard({ label, value, icon, color, wide }) {
  return (
    <View style={[s.metric, wide && { flex: 2 }]}>
      <View style={s.metricRow}>
        <MaterialIcons name={icon} size={16} color={color} />
        <Text style={[s.metricVal, { color, fontVariant: ['tabular-nums'] }]}>{value}</Text>
      </View>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function TicketRow({ ticket, onPress }) {
  const pc = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.Routine;
  const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS.reported;
  const lowestQuote = ticket.quotations?.length > 0
    ? Math.min(...ticket.quotations.map(q => q.total || (q.labour || 0) + (q.materials || 0)))
    : null;
  const actionLabel =
    ticket.status === 'awaiting_approval' ? 'Review Quotes' :
    ticket.status === 'quotes_uploaded' ? 'Review Quotes' :
    ticket.status === 'reported' ? 'Review Quotes' : 'View';
  const actionColor =
    ticket.status === 'awaiting_approval' ? colors.successMid :
    ticket.status === 'quotes_uploaded' ? colors.primaryMid :
    colors.purpleMid;

  return (
    <TouchableOpacity style={s.tCard} onPress={onPress} activeOpacity={0.8}>
      {/* Zone 1: property/unit + priority */}
      <View style={s.tZ1}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <Text style={s.tProp}>{ticket.propertyName}</Text>
          <Text style={s.tUnit}>{ticket.unit ? `Unit ${ticket.unit}` : ticket.areaLabel || 'Common Area'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {ticket.repeatAlert && <Text style={s.repeatBadge}>Repeat</Text>}
          <View style={{ backgroundColor: pc.bg, borderWidth: 1, borderColor: pc.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: pc.text }}>{ticket.priority}</Text>
          </View>
        </View>
      </View>
      {/* Zone 2: category + description */}
      <View style={s.tZ2}>
        <Text style={s.tCat}>{ticket.category}</Text>
        <Text style={s.tDesc} numberOfLines={2}>{ticket.description}</Text>
      </View>
      {/* Zone 3: quote/status + action button */}
      <View style={s.tZ3}>
        <View style={{ flex: 1 }}>
          {lowestQuote != null
            ? <Text style={s.quoteAmt}>KES {lowestQuote.toLocaleString()} <Text style={s.quoteLow}>lowest quote</Text></Text>
            : <View style={{ backgroundColor: sc.bg, borderWidth: 1, borderColor: sc.border, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: sc.text, textTransform: 'capitalize' }}>{ticket.status.replace(/_/g, ' ')}</Text>
              </View>
          }
        </View>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: actionColor }]} onPress={onPress}>
          <Text style={s.actionTxt}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  metricsRow: { flexDirection: 'row', padding: spacing.md, paddingBottom: 14, gap: 10 },
  metric: { ...card, marginBottom: 0, flex: 1, padding: 12 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  metricVal: { fontSize: 18, fontWeight: '800' },
  metricLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  escalBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginBottom: 4, backgroundColor: colors.dangerBg, borderWidth: 1.5, borderColor: colors.dangerBorder, borderRadius: 8, paddingHorizontal: 12, minHeight: 50 },
  escalTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.danger },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 18, paddingBottom: 10 },
  secTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  seeAll: { fontSize: 13, color: colors.purpleMid, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 24, gap: 6 },
  emptyTxt: { fontSize: 13, color: colors.textMuted },
  tCard: { ...card, marginHorizontal: spacing.md, overflow: 'hidden' },
  tZ1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  tZ2: { paddingHorizontal: 12, paddingBottom: 10, gap: 3 },
  tZ3: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tProp: { fontSize: 13, fontWeight: '700', color: colors.text },
  tUnit: { fontSize: 11, color: colors.textSecondary, backgroundColor: '#F1F5F9', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  tCat: { fontSize: 13, fontWeight: '700', color: colors.text },
  tDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  quoteAmt: { fontSize: 12, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  quoteLow: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  actionBtn: { borderRadius: 8, paddingHorizontal: 16, minHeight: 50, justifyContent: 'center' },
  actionTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  repeatBadge: { fontSize: 9, fontWeight: '700', color: colors.danger, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  pCard: { ...card, marginHorizontal: spacing.md, padding: 14, flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  pName: { fontSize: 14, fontWeight: '700', color: colors.text },
  pSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  openBadge: { backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  openTxt: { fontSize: 10, fontWeight: '700', color: colors.warning },
  hdrBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
});
