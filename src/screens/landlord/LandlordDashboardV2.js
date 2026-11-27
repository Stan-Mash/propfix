import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { useTickets } from '../../context/TicketsContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import V2SideDrawer from '../../components/V2SideDrawer';

const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString();
const now = new Date();
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH = MONTH_NAMES[now.getMonth()];
const MONTH_SHORT = MONTH.slice(0, 3);
const YEAR = now.getFullYear();
const MONTH_KEY = `${MONTH}-${YEAR}`;

export default function LandlordDashboardV2({ navigation }) {
  const { userProfile, logout } = useAuth();
  const { properties, units, paidTotal, computeUnitTotal } = usePortfolio();
  const { tickets } = useTickets();
  const { settings } = useAppSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const companyName = settings.companyName || 'PropFix';
  const userName = userProfile?.name || 'Landlord';
  const budget = settings.monthlyBudget || 120000;

  // Metrics
  const allUnits = Object.values(units).flat();
  const occupied = allUnits.filter(u => u.status === 'occupied').length;
  const totalUnits = allUnits.length;

  const openTickets = tickets.filter(t => !['resolved', 'rejected'].includes(t.status));
  const emergencies = openTickets.filter(t => ['Emergency', 'Urgent'].includes(t.priority));
  const repairSpend = openTickets.reduce((s, t) => {
    const q = t.quotations?.find(x => x.recommended) || t.quotations?.[0];
    return s + (q ? (q.total || (q.labour || 0) + (q.materials || 0)) : 0);
  }, 0);
  const budgetPct = budget > 0 ? Math.min(100, Math.round((repairSpend / budget) * 100)) : 0;

  // Revenue metrics — actual logged payments vs expected rent this month
  const { totalBilled, totalCollected, collectionPct } = useMemo(() => {
    let billed = 0, collected = 0;
    properties.forEach(p => {
      const propUnits = units[p.id] || [];
      propUnits.forEach(u => {
        if (!u.tenant) return;
        const due = computeUnitTotal(u) + (u.arrears || 0);
        billed += due;
        collected += paidTotal(p.id, u.id, MONTH_KEY);
      });
    });
    return { totalBilled: billed, totalCollected: collected, collectionPct: billed > 0 ? Math.round((collected / billed) * 100) : 0 };
  }, [properties, units, paidTotal, computeUnitTotal]);

  // Attention items
  const attention = [];
  if (emergencies.length > 0) {
    attention.push({ id: 'em', tag: 'Emergency', tone: 'danger', title: `${emergencies.length} urgent repair${emergencies.length !== 1 ? 's' : ''} need attention`, sub: 'Review contractor quote and assign repair', action: 'Review', onPress: () => navigation.navigate('Maintenance') });
  }
  if (openTickets.length > 0 && emergencies.length === 0) {
    attention.push({ id: 'rep', tag: 'Repairs', tone: 'warning', title: `${openTickets.length} open repair${openTickets.length !== 1 ? 's' : ''}`, sub: 'Review progress and approve quotes', action: 'View', onPress: () => navigation.navigate('Maintenance') });
  }
  if (totalBilled > 0 && collectionPct < 70) {
    attention.push({ id: 'col', tag: 'Collection', tone: 'danger', title: `Only ${collectionPct}% rent collected for ${MONTH_SHORT} ${YEAR}`, sub: `${fmtKES(totalBilled - totalCollected)} still outstanding`, action: 'Chase', onPress: () => navigation.navigate('Bills') });
  }

  const handleSignOut = () =>
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);

  return (
    <View style={s.root}>
      {/* Top Bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
          <MaterialIcons name="menu" size={22} color="#F1F5F9" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.company} numberOfLines={1}>{companyName}</Text>
          <Text style={s.roleLabel}>{userName} · Landlord</Text>
        </View>
        <TouchableOpacity style={s.avatarBtn} activeOpacity={0.8}>
          <Text style={s.avatarTxt}>{(userName)[0].toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Glass Cashflow Card */}
        <View style={s.glassCard}>
          <View style={s.glassTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.glassLabel}>{MONTH_SHORT.toUpperCase()} {YEAR} · RENT COLLECTED</Text>
              <Text style={s.glassBig}>{fmtKES(totalCollected)}</Text>
              <Text style={s.glassSub}>of {fmtKES(totalBilled)} billed this month</Text>
            </View>
            <View style={[s.pctBadge, collectionPct >= 80 ? {} : { borderColor: '#FCA5A5' }]}>
              <Text style={[s.pctTxt, collectionPct < 80 && { color: '#FCA5A5' }]}>{collectionPct}%</Text>
            </View>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${collectionPct}%`, backgroundColor: collectionPct >= 80 ? '#10B981' : '#F87171' }]} />
          </View>
          <View style={s.glassStats}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>OCCUPIED</Text>
              <Text style={[s.statVal, { color: '#fff' }]}>{occupied}/{totalUnits}</Text>
            </View>
            <View style={s.statCell}>
              <Text style={s.statLabel}>OPEN REPAIRS</Text>
              <Text style={[s.statVal, { color: '#FBBF24' }]}>{openTickets.length}</Text>
            </View>
            <View style={[s.statCell, { alignItems: 'flex-end' }]}>
              <Text style={s.statLabel}>REPAIR SPEND</Text>
              <Text style={[s.statVal, { color: '#93C5FD', fontSize: 11 }]}>{fmtKES(repairSpend)}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={s.actionsRow}>
          {[
            { icon: 'apartment',       label: 'Add Prop',    onPress: () => navigation.navigate('Portfolio') },
            { icon: 'receipt-long',    label: 'Statements',  onPress: () => navigation.navigate('Bills') },
            { icon: 'build',           label: 'Log Repair',  onPress: () => navigation.navigate('LogIssue') },
            { icon: 'report-problem',  label: 'Complaints',  onPress: () => navigation.navigate('LandlordAllComplaints') },
          ].map(a => (
            <TouchableOpacity key={a.label} style={s.actionBtn} onPress={a.onPress} activeOpacity={0.8}>
              <View style={s.actionIcon}>
                <MaterialIcons name={a.icon} size={18} color="#0B1424" />
              </View>
              <Text style={s.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Needs Attention */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>NEEDS ATTENTION ({attention.length})</Text>
        </View>
        {attention.length === 0 ? (
          <View style={s.allGood}>
            <MaterialIcons name="check-circle-outline" size={28} color="#16A34A" />
            <Text style={s.allGoodTxt}>All caught up</Text>
            <Text style={s.allGoodSub}>No urgent items requiring your attention.</Text>
          </View>
        ) : attention.map(item => (
          <TouchableOpacity key={item.id} style={s.attCard} onPress={item.onPress} activeOpacity={0.85}>
            <View style={{ flex: 1 }}>
              <View style={[s.attTag, item.tone === 'danger' ? s.tagDanger : s.tagWarning]}>
                <View style={[s.tagDot, { backgroundColor: item.tone === 'danger' ? '#DC2626' : '#D97706' }]} />
                <Text style={[s.tagTxt, { color: item.tone === 'danger' ? '#DC2626' : '#92400E' }]}>{item.tag}</Text>
              </View>
              <Text style={s.attTitle}>{item.title}</Text>
              <Text style={s.attSub} numberOfLines={1}>{item.sub}</Text>
            </View>
            <View style={[s.attAction, item.tone === 'danger' ? s.actionDanger : s.actionWarning]}>
              <Text style={s.attActionTxt}>{item.action}</Text>
              <MaterialIcons name="arrow-outward" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}

        {/* Properties */}
        <View style={[s.secRow, { marginTop: 8 }]}>
          <Text style={s.secTitle}>PROPERTIES ({properties.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Portfolio')}>
            <Text style={s.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {properties.length === 0 ? (
          <TouchableOpacity style={s.emptyProp} onPress={() => navigation.navigate('Portfolio')} activeOpacity={0.85}>
            <MaterialIcons name="apartment" size={28} color="#475569" />
            <Text style={s.emptyPropTxt}>No properties yet</Text>
            <Text style={s.emptyPropSub}>Tap to add your first property</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}>
            {properties.map(p => {
              const pUnits = units[p.id] || [];
              const occ = pUnits.filter(u => u.status === 'occupied').length;
              const openHere = tickets.filter(t => t.propertyId === p.id && !['resolved', 'rejected'].includes(t.status)).length;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={s.propCard}
                  onPress={() => navigation.navigate('UnitRoster', { propertyId: p.id })}
                  activeOpacity={0.85}
                >
                  <View style={s.propCardImg}>
                    <MaterialIcons name="apartment" size={32} color="#334155" />
                  </View>
                  <View style={s.propCardBody}>
                    <Text style={s.propName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.propLoc} numberOfLines={1}>{p.location || p.address}</Text>
                    <View style={s.propFooter}>
                      <Text style={s.propOcc}>{occ}/{pUnits.length} occupied</Text>
                      {openHere > 0 && (
                        <View style={s.propBadge}>
                          <Text style={s.propBadgeTxt}>{openHere} repair{openHere !== 1 ? 's' : ''}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

      </ScrollView>

      {/* Side Drawer */}
      <V2SideDrawer
        open={drawerOpen}
        navigation={navigation}
        onClose={() => setDrawerOpen(false)}
        companyName={companyName}
        userName={userName}
        roleLabel="Landlord"
        onSignOut={handleSignOut}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, backgroundColor: '#0B1424' },
  menuBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  company: { fontSize: 15, fontWeight: '800', color: '#F1F5F9' },
  roleLabel: { fontSize: 11, color: '#64748B', marginTop: 1 },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E3A5F', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#2563EB' },
  avatarTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
  scroll: { paddingBottom: 48 },

  // Glass card
  glassCard: { margin: 16, marginBottom: 12, backgroundColor: '#0B1424', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#1E293B' },
  glassTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  glassLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.8, marginBottom: 4 },
  glassBig: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  glassSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  pctBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pctTxt: { fontSize: 13, fontWeight: '800', color: '#34D399' },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  glassStats: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  statCell: { flex: 1 },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#475569', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  statVal: { fontSize: 14, fontWeight: '800' },

  // Quick actions
  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  actionBtn: { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2F7', justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 10, fontWeight: '700', color: '#0B1424' },

  // Sections
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  secTitle: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.6, textTransform: 'uppercase' },
  seeAll: { fontSize: 12, fontWeight: '700', color: '#2563EB' },

  // Attention cards
  attCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  attTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 5 },
  tagDanger: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
  tagWarning: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  tagDot: { width: 5, height: 5, borderRadius: 2.5 },
  tagTxt: { fontSize: 10, fontWeight: '700' },
  attTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', lineHeight: 18 },
  attSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  attAction: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, justifyContent: 'center' },
  actionDanger: { backgroundColor: '#DC2626' },
  actionWarning: { backgroundColor: '#D97706' },
  attActionTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // All good
  allGood: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 6, marginBottom: 10 },
  allGoodTxt: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  allGoodSub: { fontSize: 12, color: '#64748B' },

  // Property cards
  propCard: { width: 200, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  propCardImg: { height: 90, backgroundColor: '#0B1424', justifyContent: 'center', alignItems: 'center' },
  propCardBody: { padding: 12 },
  propName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  propLoc: { fontSize: 11, color: '#64748B', marginTop: 2 },
  propFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  propOcc: { fontSize: 11, fontWeight: '600', color: '#475569' },
  propBadge: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  propBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#92400E' },

  // Empty
  emptyProp: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', gap: 6, marginBottom: 10 },
  emptyPropTxt: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  emptyPropSub: { fontSize: 12, color: '#64748B' },
});
