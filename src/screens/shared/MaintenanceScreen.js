import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, Alert, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTickets } from '../../context/TicketsContext';
import { PROPERTIES, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, CONTRACTORS, CATEGORY_ICONS, CATEGORY_COLORS } from '../../data/seed';
import ScreenHeader from '../../components/ScreenHeader';
import SegmentedControl from '../../components/SegmentedControl';
import BottomSheet from '../../components/BottomSheet';
import RepairPhoto from '../../components/RepairPhoto';
import { logAudit } from '../../utils/auditLog';
import { fmtDay, completionDelta } from '../../utils/dates';
import { colors, spacing, card, accent } from '../../theme';

const SEGMENTS = [
  { key: 'active', label: 'Active Repairs' },
  { key: 'pending', label: 'Pending Action' },
  { key: 'inactive', label: 'History' },
];

const STATUS_SETS = {
  active: ['approved', 'in_progress', 'pending_signoff'],
  pending: ['reported', 'quotes_uploaded', 'awaiting_approval'],
  inactive: ['resolved', 'rejected'],
};

const QUICK = {
  critical: { label: 'Emergency / Critical', test: t => t.priority === 'Emergency' && !STATUS_SETS.inactive.includes(t.status) },
  repeat: { label: 'Repeat Issues', test: t => (t.occurrenceCount || 1) > 1 },
};

const CATEGORIES = Object.keys(CATEGORY_COLORS).map(key => ({ key, icon: CATEGORY_ICONS[key], color: CATEGORY_COLORS[key] }));

export default function MaintenanceScreen({ navigation, route }) {
  const { userProfile } = useAuth();
  const { tickets: allTickets } = useTickets();
  const [segment, setSegment] = useState('active');
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [quick, setQuick] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showPropSheet, setShowPropSheet] = useState(false);

  const isCaretaker = userProfile?.role === 'caretaker';
  const isManager = userProfile?.role === 'manager';

  // Drill-down links from Overview land here with a filter already applied
  const drill = route?.params;
  useEffect(() => {
    if (!drill?.ts) return;
    setPropertyFilter(drill.propertyId || '');
    setQuick(drill.quick || '');
    setCategoryFilter('');
    setSearch('');
    setSegment(drill.segment || (drill.propertyId || drill.quick ? 'all' : 'active'));
  }, [drill?.ts]);

  const hasFilter = !!propertyFilter || !!quick;
  // 'all' only exists while a drill-down filter is showing every matching repair
  const seg = segment === 'all' && !hasFilter ? 'active' : segment;

  const baseTickets = useMemo(() => {
    let t = allTickets;
    if (isCaretaker && userProfile?.assignedProperties?.length) {
      t = t.filter(tk => userProfile.assignedProperties.includes(tk.propertyId));
    }
    return t;
  }, [allTickets, isCaretaker, userProfile]);

  const selectableProps = isCaretaker && userProfile?.assignedProperties?.length
    ? PROPERTIES.filter(p => userProfile.assignedProperties.includes(p.id))
    : PROPERTIES;

  const scoped = useMemo(() => {
    let t = baseTickets;
    if (propertyFilter) t = t.filter(tk => tk.propertyId === propertyFilter);
    if (quick && QUICK[quick]) t = t.filter(QUICK[quick].test);
    return t;
  }, [baseTickets, propertyFilter, quick]);

  const segmentsWithCounts = SEGMENTS.map(sg => ({ ...sg, count: scoped.filter(t => STATUS_SETS[sg.key].includes(t.status)).length }));

  const inView = useMemo(
    () => (seg === 'all' ? scoped : scoped.filter(tk => STATUS_SETS[seg].includes(tk.status))),
    [scoped, seg],
  );

  const filteredTickets = useMemo(() => {
    let t = inView;
    if (categoryFilter) t = t.filter(tk => tk.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      t = t.filter(tk =>
        (tk.propertyName || '').toLowerCase().includes(q) ||
        (tk.category || '').toLowerCase().includes(q) ||
        (tk.unit || '').toLowerCase().includes(q) ||
        (tk.title || '').toLowerCase().includes(q) ||
        (tk.description || '').toLowerCase().includes(q)
      );
    }
    return t;
  }, [inView, categoryFilter, search]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    inView.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, [inView]);

  const filterLabel = [PROPERTIES.find(p => p.id === propertyFilter)?.name, QUICK[quick]?.label].filter(Boolean).join(' · ');

  const clearFilter = () => {
    setPropertyFilter('');
    setQuick('');
    if (segment === 'all') setSegment('active');
  };

  const handlePettyApprove = async (ticket) => {
    const recommended = ticket.quotations?.find(q => q.recommended);
    if (!recommended) return;
    Alert.alert(
      'Petty Cash Approve',
      `Approve KES ${recommended.total.toLocaleString()} for ${ticket.category} at ${ticket.propertyName}?\n\nThis is within the KES 2,500 petty cash limit.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            await logAudit({ userId: userProfile?.uid, role: userProfile?.role, action: 'PETTY_CASH_APPROVE', entityId: ticket.id, data: { amount: recommended.total } });
            Alert.alert('Approved', `${ticket.category} repair approved for KES ${recommended.total.toLocaleString()}.`);
          },
        },
      ]
    );
  };

  return (
    <View style={s.root}>
      <ScreenHeader title="Repairs" subtitle={`${filteredTickets.length} repair${filteredTickets.length !== 1 ? 's' : ''}`} />

      {/* Active filter bar */}
      {hasFilter && (
        <View style={s.filterBar}>
          <MaterialIcons name="filter-alt" size={18} color="#1D4ED8" />
          <Text style={s.filterBarTxt} numberOfLines={2}>Showing: {filterLabel} ({inView.length})</Text>
          <TouchableOpacity style={s.clearBtn} onPress={clearFilter} activeOpacity={0.8}>
            <MaterialIcons name="close" size={16} color="#fff" />
            <Text style={s.clearTxt}>Clear Filter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Segmented Control */}
      <View style={{ paddingTop: 4 }}>
        <SegmentedControl segments={segmentsWithCounts} activeKey={seg} onChange={setSegment} />
      </View>

      {/* Search + Property filter row */}
      <View style={s.filterRow}>
        <View style={s.searchWrap}>
          <MaterialIcons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search repairs..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="cancel" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {selectableProps.length > 1 && (
          <TouchableOpacity
            style={[s.propBtn, propertyFilter && s.propBtnOn]}
            onPress={() => setShowPropSheet(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="apartment" size={20} color={propertyFilter ? '#fff' : colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Category Cards */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {CATEGORIES.map(cat => {
            const count = categoryCounts[cat.key] || 0;
            const active = categoryFilter === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[s.catCard, active && { borderColor: cat.color, backgroundColor: cat.color }]}
                onPress={() => setCategoryFilter(active ? '' : cat.key)}
                activeOpacity={0.8}
              >
                <View style={[s.catIconWrap, { backgroundColor: active ? 'rgba(255,255,255,0.22)' : cat.color + '18' }]}>
                  <MaterialIcons name={cat.icon} size={20} color={active ? '#fff' : cat.color} />
                </View>
                <Text style={[s.catLabel, active && { color: '#fff', fontWeight: '700' }]}>{cat.key}</Text>
                <Text style={[s.catCount, { color: active ? '#fff' : cat.color }]}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Caretaker FAB */}
      {isCaretaker && (
        <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('LogIssue', { propertyId: userProfile?.assignedProperties?.[0] })} activeOpacity={0.85}>
          <MaterialIcons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Ticket List */}
      <FlatList
        style={{ flex: 1 }}
        data={filteredTickets}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialIcons name="handyman" size={36} color={colors.textMuted} />
            <Text style={s.emptyTxt}>No repairs found</Text>
            {hasFilter && (
              <TouchableOpacity style={[s.clearBtn, { marginTop: 6 }]} onPress={clearFilter} activeOpacity={0.8}>
                <MaterialIcons name="close" size={16} color="#fff" />
                <Text style={s.clearTxt}>Clear Filter</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item: t }) => (
          <RepairCard
            ticket={t}
            isManager={isManager}
            onPress={() => navigation.navigate('TicketDetail', { ticketId: t.id })}
            onPettyApprove={() => handlePettyApprove(t)}
          />
        )}
      />

      {/* Property Filter Bottom Sheet */}
      <BottomSheet visible={showPropSheet} onClose={() => setShowPropSheet(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text style={s.sheetTitle}>Filter by Property</Text>
          <TouchableOpacity style={s.sheetOpt} onPress={() => { setPropertyFilter(''); setShowPropSheet(false); }}>
            <Text style={[s.sheetOptTxt, !propertyFilter && { color: colors.primaryMid, fontWeight: '700' }]}>All Properties</Text>
            {!propertyFilter && <MaterialIcons name="check" size={20} color={colors.primaryMid} />}
          </TouchableOpacity>
          {selectableProps.map(p => {
            const open = baseTickets.filter(t => t.propertyId === p.id && !STATUS_SETS.inactive.includes(t.status)).length;
            return (
              <TouchableOpacity key={p.id} style={s.sheetOpt} onPress={() => { setPropertyFilter(p.id); setShowPropSheet(false); }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.sheetOptTxt, propertyFilter === p.id && { color: colors.primaryMid, fontWeight: '700' }]}>{p.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{p.location} · {open} open</Text>
                </View>
                {propertyFilter === p.id && <MaterialIcons name="check" size={20} color={colors.primaryMid} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

function RepairCard({ ticket: t, isManager, onPress, onPettyApprove }) {
  const sc = STATUS_COLORS[t.status] || STATUS_COLORS.reported;
  const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.Routine;
  const selected = t.quotations?.find(q => q.id === t.selectedContractorId);
  const recommended = selected || t.quotations?.find(q => q.recommended) || t.quotations?.[0];
  const isPetty = isManager && t.status === 'awaiting_approval' && recommended && recommended.total <= 2500;
  const repairer = t.assignedRepairer;
  const repairerId = repairer?.workerId || repairer?.id;
  const repairerName = CONTRACTORS[repairerId]?.name || repairer?.name;
  const isDone = t.status === 'resolved';
  const stripe = isDone ? accent.done : t.status === 'rejected' ? accent.neutral : accent[t.priority] || accent.Routine;
  const delta = completionDelta(t.expectedCompletion, t.actualCompletion);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.cardRow1}>
        <View style={s.thumbWrap}>
          <RepairPhoto photo={t.photos?.[0]} category={t.category} style={s.thumb} />
          {t.priority === 'Emergency' && !isDone && (
            <View style={s.critBadge}>
              <MaterialIcons name="error" size={12} color="#fff" />
            </View>
          )}
        </View>

        <View style={s.cardInfo}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle} numberOfLines={1}>{t.category}</Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(t.occurrenceCount || 0) > 1 && (
                <View style={s.occBadge}>
                  <MaterialIcons name="replay" size={11} color={colors.danger} />
                  <Text style={s.occTxt}>{t.occurrenceCount}x</Text>
                </View>
              )}
              <View style={{ backgroundColor: pc.bg, borderWidth: 1, borderColor: pc.border, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: pc.text }}>{t.priority}</Text>
              </View>
            </View>
          </View>
          <Text style={s.cardSub}>{t.propertyName} · {t.unit ? `Unit ${t.unit}` : t.areaLabel || 'Common Area'}</Text>
          <Text style={s.cardDesc} numberOfLines={2}>{t.description}</Text>
        </View>
      </View>

      {/* Who is doing the work and when it is due */}
      {repairer && (
        <View style={s.repairerBox}>
          <View style={s.repairerLine}>
            <MaterialIcons name="engineering" size={16} color={colors.textSecondary} />
            <Text style={s.repairerTxt} numberOfLines={1}>
              <Text style={s.repairerKey}>{isDone ? 'Fixed by: ' : 'Assigned: '}</Text>
              {repairerName}{repairerId ? ` (#${repairerId})` : ''}
            </Text>
          </View>
          {t.expectedCompletion && (
            <View style={s.repairerLine}>
              <MaterialIcons name="event" size={16} color={colors.textSecondary} />
              <Text style={s.repairerTxt}>
                <Text style={s.repairerKey}>{isDone ? 'Expected: ' : 'Due: '}</Text>
                {fmtDay(t.expectedCompletion)}
              </Text>
            </View>
          )}
          {t.actualCompletion && (
            <View style={s.repairerLine}>
              <MaterialIcons name="check-circle" size={16} color={colors.successMid} />
              <Text style={[s.repairerTxt, { color: colors.success }]}>
                <Text style={{ fontWeight: '700' }}>Completed: </Text>
                {fmtDay(t.actualCompletion)}{delta ? ` (${delta})` : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={s.cardFoot}>
        <View style={{ backgroundColor: sc.bg, borderWidth: 1, borderColor: sc.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: sc.text }}>{STATUS_LABELS[t.status] || t.status}</Text>
        </View>
        {recommended && (
          <Text style={s.quoteAmt}>KES {recommended.total.toLocaleString()}</Text>
        )}
        {isPetty && (
          <TouchableOpacity style={s.pettyBtn} onPress={onPettyApprove}>
            <MaterialIcons name="check-circle" size={16} color="#fff" />
            <Text style={s.pettyBtnTxt}>Quick Approve</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Active filter bar
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DBEAFE', borderBottomWidth: 1.5, borderBottomColor: '#93C5FD', paddingHorizontal: spacing.md, paddingVertical: 8 },
  filterBarTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1E40AF' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1D4ED8', borderRadius: 8, paddingHorizontal: 12, minHeight: 44 },
  clearTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Filter row
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingBottom: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 10, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  propBtn: { width: 46, height: 46, borderRadius: 8, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  propBtnOn: { borderColor: colors.primaryMid, backgroundColor: colors.primaryMid },

  // Category cards
  catRow: { paddingHorizontal: spacing.md, gap: 8, paddingBottom: 10, paddingTop: 2 },
  catCard: { width: 82, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  catIconWrap: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  catLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  catCount: { fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },

  // Repair cards
  card: { ...card, overflow: 'hidden' },
  cardRow1: { flexDirection: 'row', padding: 12, gap: 12 },
  thumbWrap: { width: 68, height: 68, borderRadius: 8, overflow: 'hidden' },
  thumb: { width: 68, height: 68, borderRadius: 8 },
  critBadge: { position: 'absolute', top: 4, left: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  cardSub: { fontSize: 12, color: colors.textMuted },
  cardDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2 },
  occBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  occTxt: { fontSize: 11, fontWeight: '700', color: colors.danger },

  // Repairer block
  repairerBox: { marginHorizontal: 12, marginBottom: 12, backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  repairerLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repairerTxt: { flex: 1, fontSize: 12, color: colors.text },
  repairerKey: { fontWeight: '700', color: colors.textSecondary },

  // Card footer
  cardFoot: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#F8FAFC' },
  quoteAmt: { marginLeft: 'auto', fontSize: 13, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  pettyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryMid, borderRadius: 8, paddingHorizontal: 12, minHeight: 44 },
  pettyBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Empty + FAB
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTxt: { fontSize: 14, color: colors.textSecondary },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.successMid, justifyContent: 'center', alignItems: 'center', zIndex: 10, elevation: 6 },

  // Bottom sheet
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 14 },
  sheetOpt: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  sheetOptTxt: { fontSize: 15, color: colors.text, flex: 1 },
});
