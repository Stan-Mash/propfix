import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTickets } from '../../context/TicketsContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { CONTRACTORS, PRIORITY_COLORS } from '../../data/seed';
import ScreenHeader from '../../components/ScreenHeader';
import BottomSheet from '../../components/BottomSheet';
import { logAudit } from '../../utils/auditLog';
import { fmtDay } from '../../utils/dates';
import { colors, spacing, card } from '../../theme';

const fmtKES = (n) => 'KES ' + Number(n || 0).toLocaleString();
const shortName = (name = '') => name.replace(/\s+(Ltd|Limited)\.?$/i, '');
const isOpen = (t) => !['resolved', 'rejected'].includes(t.status);
const onTimePct = (c) => c.completed > 0 ? Math.round((c.onTime / c.completed) * 100) : 0;
const repeatPct = (c) => c.completed > 0 ? Math.round((c.repeatFaults / c.completed) * 100) : 0;

export default function LandlordDashboard({ navigation }) {
  const { userProfile } = useAuth();
  const { tickets, bonuses, awardBonus } = useTickets();
  const { properties, getRent } = usePortfolio();
  const { settings } = useAppSettings();

  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [confirmBonusId, setConfirmBonusId] = useState(null);
  const [dossierContractor, setDossierContractor] = useState(null);

  const approvedTickets = tickets.filter(t => ['approved', 'in_progress', 'pending_signoff'].includes(t.status));
  const pendingTickets = tickets.filter(t => ['reported', 'quotes_uploaded', 'awaiting_approval'].includes(t.status));
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  const approvedSpend = [...approvedTickets, ...resolvedTickets].reduce((sum, t) => {
    const q = t.quotations?.find(q => t.selectedContractorId ? q.id === t.selectedContractorId : q.recommended) || t.quotations?.[0];
    return sum + (q?.total || 0);
  }, 0);
  const pendingEstimate = pendingTickets.reduce((sum, t) => {
    const q = t.quotations?.find(q => q.recommended) || t.quotations?.[0];
    return sum + (q?.total || 0);
  }, 0);

  // Aggregate rent from portfolio context (live)
  const totalRent = properties.reduce((s, p) => s + (getRent(p.id)?.monthlyRent || 0), 0);
  const collectedRent = properties.reduce((s, p) => s + (getRent(p.id)?.collected || 0), 0);
  const collectPct = totalRent > 0 ? Math.round((collectedRent / totalRent) * 100) : 0;

  // Budget bar
  const budget = settings.monthlyBudget || 0;
  const budgetPct = budget > 0 ? Math.min(100, Math.round((approvedSpend / budget) * 100)) : 0;

  const criticalCount = tickets.filter(t => t.priority === 'Emergency' && isOpen(t)).length;
  const repeatTickets = tickets.filter(t => (t.occurrenceCount || 1) > 1);
  const repeatOccurrences = repeatTickets.reduce((s, t) => s + t.occurrenceCount, 0);
  const pendingAssignment = pendingTickets.filter(t => !t.assignedRepairer).length;

  const leaderboard = Object.values(CONTRACTORS)
    .filter(c => c.completed > 0 && c.trade !== 'Caretaker')
    .sort((a, b) => (b.onTime / b.completed) - (a.onTime / a.completed) || b.completed - a.completed || a.repeatFaults - b.repeatFaults);
  const top = leaderboard[0];

  const isDefaultCompany = !settings.companyName || settings.companyName === 'Your Company Name';

  const openRepairs = (params) => { setShowBreakdown(false); navigation.navigate('Maintenance', { ...params, ts: Date.now() }); };
  const openProperty = (propertyId) => { setShowBreakdown(false); navigation.navigate('UnitRoster', { propertyId }); };

  const confirmBonus = async (c) => {
    awardBonus(c.id);
    setConfirmBonusId(null);
    await logAudit({ userId: userProfile?.uid, role: userProfile?.role, action: 'AWARD_BONUS', entityId: c.id, data: { name: c.name } });
  };

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Overview"
        subtitle={isDefaultCompany ? '' : settings.companyName}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.hdrBtn} onPress={() => navigation.navigate('StaffManagement')}>
              <MaterialIcons name="group" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity style={s.hdrBtn} onPress={() => navigation.navigate('Settings')}>
              <MaterialIcons name="settings" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Company setup prompt */}
        {isDefaultCompany && (
          <TouchableOpacity style={s.setupBanner} onPress={() => navigation.navigate('Settings')} activeOpacity={0.85}>
            <MaterialIcons name="business" size={18} color={colors.primaryMid} />
            <Text style={s.setupTxt}>Set up your company profile</Text>
            <MaterialIcons name="chevron-right" size={18} color={colors.primaryMid} />
          </TouchableOpacity>
        )}

        {/* Hero Card — dark ink obsidian */}
        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroLabel}>MONTHLY RENT ROLL</Text>
              <Text style={s.heroBig}>{fmtKES(totalRent)}</Text>
              <Text style={s.heroSub}>{collectPct}% collected this month</Text>
            </View>
            <View style={s.collectBadge}>
              <Text style={s.collectPct}>{collectPct}%</Text>
            </View>
          </View>

          {/* Collection progress bar */}
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${collectPct}%`, backgroundColor: collectPct >= 80 ? '#10B981' : collectPct >= 50 ? '#F59E0B' : '#EF4444' }]} />
          </View>

          {/* Three stat cells */}
          <View style={s.heroStats}>
            <View style={s.heroStatCell}>
              <Text style={s.heroStatLbl}>PENDING EST.</Text>
              <Text style={[s.heroStatVal, { color: '#FBBF24' }]}>{fmtKES(pendingEstimate)}</Text>
            </View>
            <View style={s.heroStatCell}>
              <Text style={s.heroStatLbl}>ACTIVE SPEND</Text>
              <Text style={[s.heroStatVal, { color: '#93C5FD' }]}>{fmtKES(approvedSpend)}</Text>
            </View>
            <View style={[s.heroStatCell, { alignItems: 'flex-end' }]}>
              <Text style={s.heroStatLbl}>PROPERTIES</Text>
              <Text style={[s.heroStatVal, { color: '#fff' }]}>{properties.length}</Text>
            </View>
          </View>

          {/* Budget bar */}
          {budget > 0 && (
            <View style={s.budgetRow}>
              <Text style={s.budgetLbl}>Repair Budget Used: {budgetPct}% of {fmtKES(budget)}</Text>
              <View style={s.budgetTrack}>
                <View style={[s.budgetFill, { width: `${budgetPct}%`, backgroundColor: budgetPct > 90 ? '#EF4444' : budgetPct > 70 ? '#F59E0B' : '#10B981' }]} />
              </View>
            </View>
          )}

          <TouchableOpacity style={s.heroBtn} onPress={() => setShowBreakdown(true)} activeOpacity={0.8}>
            <Text style={s.heroBtnTxt}>View Property Breakdown</Text>
            <MaterialIcons name="chevron-right" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* 2x2 KPI Bento Grid */}
        <View style={s.bentoGrid}>
          {/* Uniform structure: Icon + Chevron, Large number, Title, 1-line hint */}
          <TouchableOpacity style={s.bentoCard} onPress={() => openRepairs({ quick: 'critical' })} activeOpacity={0.8}>
            <View style={s.bentoTop}>
              <MaterialIcons name="error" size={22} color={colors.dangerMid} />
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </View>
            <Text style={[s.bentoCount, { color: colors.dangerMid }]}>{criticalCount}</Text>
            <Text style={s.bentoLabel}>Critical Issues</Text>
            <Text style={s.bentoHint}>Open emergencies</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.bentoCard} onPress={() => openRepairs({ quick: 'repeat' })} activeOpacity={0.8}>
            <View style={s.bentoTop}>
              <MaterialIcons name="replay" size={22} color={colors.warningMid} />
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </View>
            <Text style={[s.bentoCount, { color: colors.warningMid }]}>{repeatTickets.length}</Text>
            <Text style={s.bentoLabel}>Repeat Issues</Text>
            <Text style={s.bentoHint}>{repeatOccurrences} occurrence{repeatOccurrences !== 1 ? 's' : ''} total</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.bentoCard} onPress={() => openRepairs({ segment: 'pending' })} activeOpacity={0.8}>
            <View style={s.bentoTop}>
              <MaterialIcons name="person-add-alt-1" size={22} color={colors.primaryMid} />
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </View>
            <Text style={[s.bentoCount, { color: colors.primaryMid }]}>{pendingAssignment}</Text>
            <Text style={s.bentoLabel}>Pending Assignment</Text>
            <Text style={s.bentoHint}>No contractor assigned</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.bentoCard} onPress={() => setShowLeaderboard(true)} activeOpacity={0.8}>
            <View style={s.bentoTop}>
              <MaterialIcons name="military-tech" size={22} color={colors.successMid} />
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </View>
            {top ? (
              <>
                <Text style={[s.bentoCount, { color: colors.successMid, fontSize: 20 }]}>{onTimePct(top)}%</Text>
                <Text style={s.bentoLabel}>Top Contractor</Text>
                <Text style={s.bentoHint} numberOfLines={1}>{shortName(top.name)}</Text>
              </>
            ) : (
              <>
                <Text style={[s.bentoCount, { color: colors.textMuted }]}>--</Text>
                <Text style={s.bentoLabel}>Top Contractor</Text>
                <Text style={s.bentoHint}>No completed jobs yet</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Pending Approvals */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>Pending Approvals ({pendingTickets.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Quotations', { tab: 'pending' })} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.seeAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {pendingTickets.length === 0 ? (
          <View style={s.empty}>
            <MaterialIcons name="check-circle-outline" size={32} color={colors.successMid} />
            <Text style={s.emptyTxt}>No pending approvals</Text>
          </View>
        ) : pendingTickets.slice(0, 3).map(t => (
          <TicketRow key={t.id} ticket={t} onPress={() => navigation.navigate('TicketDetail', { ticketId: t.id })} />
        ))}

        {/* Properties */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>My Properties ({properties.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Portfolio')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.seeAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {properties.length === 0 ? (
          <TouchableOpacity style={s.emptyCard} onPress={() => navigation.navigate('Portfolio')} activeOpacity={0.85}>
            <MaterialIcons name="add-business" size={28} color={colors.textMuted} />
            <Text style={s.emptyCardTxt}>Add your first property</Text>
            <Text style={s.emptyCardHint}>Tap to open Portfolio and add a property.</Text>
          </TouchableOpacity>
        ) : properties.map(p => (
          <PropRow
            key={p.id}
            prop={p}
            openCount={tickets.filter(t => t.propertyId === p.id && isOpen(t)).length}
            onPress={() => navigation.navigate('UnitRoster', { propertyId: p.id })}
          />
        ))}

      </ScrollView>

      {/* Property Breakdown Bottom Sheet */}
      <BottomSheet visible={showBreakdown} onClose={() => setShowBreakdown(false)} minHeight={320}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <View style={s.sheetHeaderRow}>
            <Text style={s.sheetTitle}>Property Breakdown</Text>
            <TouchableOpacity onPress={() => setShowBreakdown(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={s.sheetHint}>Tap a property to open it. Tap a number to filter repairs.</Text>
          {properties.length === 0 ? (
            <View style={s.sheetEmpty}>
              <Text style={s.sheetEmptyTxt}>No properties yet.</Text>
              <TouchableOpacity style={s.sheetEmptyBtn} onPress={() => { setShowBreakdown(false); navigation.navigate('Portfolio'); }}>
                <Text style={s.sheetEmptyBtnTxt}>Add Property</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={s.sheetColRow}>
                <Text style={[s.sheetCol, { flex: 2.2, textAlign: 'left' }]}>Property</Text>
                <Text style={s.sheetCol}>Rent</Text>
                <Text style={s.sheetCol}>Repairs</Text>
                <Text style={s.sheetCol}>Issues</Text>
              </View>
              {properties.map(p => {
                const rent = getRent(p.id);
                const propTickets = tickets.filter(t => t.propertyId === p.id);
                const propSpend = propTickets.reduce((sum, t) => {
                  if (!['approved', 'in_progress', 'pending_signoff', 'resolved'].includes(t.status)) return sum;
                  const q = t.quotations?.find(q => t.selectedContractorId ? q.id === t.selectedContractorId : q.recommended) || t.quotations?.[0];
                  return sum + (q?.total || 0);
                }, 0);
                return (
                  <View key={p.id} style={s.sheetRow}>
                    <TouchableOpacity style={s.propLink} onPress={() => openProperty(p.id)} activeOpacity={0.7}>
                      <Text style={s.propLinkTxt} numberOfLines={2}>{p.name}</Text>
                      <MaterialIcons name="chevron-right" size={16} color={colors.primaryMid} />
                    </TouchableOpacity>
                    <Text style={s.sheetCell}>{((rent?.collected || 0) / 1000).toFixed(0)}k</Text>
                    <View style={s.pillCell}>
                      <TouchableOpacity style={s.pill} onPress={() => openRepairs({ propertyId: p.id })} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                        <Text style={s.pillTxt}>{(propSpend / 1000).toFixed(0)}k</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={s.pillCell}>
                      <TouchableOpacity style={s.pill} onPress={() => openRepairs({ propertyId: p.id })} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                        <Text style={s.pillTxt}>{propTickets.length}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </BottomSheet>

      {/* Leaderboard Sheet */}
      <BottomSheet visible={showLeaderboard} onClose={() => { setShowLeaderboard(false); setConfirmBonusId(null); }} maxHeight={0.85} minHeight={320}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <View style={s.sheetHeaderRow}>
            <Text style={s.sheetTitle}>Contractor Leaderboard</Text>
            <TouchableOpacity onPress={() => setShowLeaderboard(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={s.sheetHint}>Ranked by on-time rate, jobs completed, then repeat fault rate.</Text>
          {leaderboard.length === 0 ? (
            <View style={s.sheetEmpty}>
              <Text style={s.sheetEmptyTxt}>No completed contractor jobs yet.</Text>
            </View>
          ) : leaderboard.map((c, i) => {
            const awarded = bonuses[c.id];
            const confirming = confirmBonusId === c.id;
            const rr = repeatPct(c);
            return (
              <View key={c.id} style={[s.lbCard, i === 0 && s.lbCardTop]}>
                <View style={s.lbHead}>
                  <View style={[s.rank, i === 0 && { backgroundColor: colors.warningMid }]}>
                    <Text style={[s.rankTxt, i === 0 && { color: '#fff' }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.lbName}>{c.name}</Text>
                    <Text style={s.lbId}>{c.trade} · ID: {c.id}</Text>
                  </View>
                  {i === 0 && <MaterialIcons name="military-tech" size={22} color={colors.warningMid} />}
                </View>
                <View style={s.lbStats}>
                  <StatCell label="On-Time" value={`${onTimePct(c)}%`} color={onTimePct(c) >= 90 ? colors.successMid : colors.warningMid} />
                  <StatCell label="Jobs Done" value={String(c.completed)} color={colors.text} />
                  <StatCell label="Repeat Issues" value={`${rr}%`} color={rr > 0 ? colors.dangerMid : colors.successMid} />
                </View>
                {awarded ? (
                  <View style={s.awardedRow}>
                    <MaterialIcons name="check-circle" size={18} color={colors.successMid} />
                    <Text style={s.awardedTxt}>Bonus Awarded: {fmtDay(awarded)}</Text>
                  </View>
                ) : confirming ? (
                  <View>
                    <Text style={s.confirmTxt}>Award a performance bonus to {shortName(c.name)}?</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={s.cancelBtn} onPress={() => setConfirmBonusId(null)}>
                        <Text style={s.cancelTxt}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.bonusBtn, { flex: 2, backgroundColor: colors.successMid }]} onPress={() => confirmBonus(c)}>
                        <MaterialIcons name="check" size={18} color="#fff" />
                        <Text style={s.bonusBtnTxt}>Confirm Bonus</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={s.bonusBtn} onPress={() => setConfirmBonusId(c.id)}>
                    <MaterialIcons name="card-giftcard" size={18} color="#fff" />
                    <Text style={s.bonusBtnTxt}>Award Bonus</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.profileLink} onPress={() => setDossierContractor(c)} activeOpacity={0.7}>
                  <Text style={s.profileLinkTxt}>View Profile and Repair History</Text>
                  <MaterialIcons name="arrow-forward" size={16} color={colors.primaryMid} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </BottomSheet>

      <ContractorDossierSheet
        contractor={dossierContractor}
        tickets={tickets}
        visible={!!dossierContractor}
        onClose={() => setDossierContractor(null)}
        navigation={navigation}
      />
    </View>
  );
}

function StatCell({ label, value, color }) {
  return (
    <View style={s.statBox}>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

function TicketRow({ ticket, onPress }) {
  const pc = PRIORITY_COLORS?.[ticket.priority] || { text: colors.warningMid, bg: colors.warningBg, border: colors.warningBorder };
  const recommended = ticket.quotations?.find(q => q.recommended) || ticket.quotations?.[0];
  const quoteCount = ticket.quotations?.length || 0;
  return (
    <TouchableOpacity style={s.tCard} onPress={onPress} activeOpacity={0.8}>
      <View style={s.tBody}>
        <View style={s.tZ1}>
          <View style={{ flex: 1 }}>
            <Text style={s.tCat}>{ticket.category} · {ticket.propertyName}</Text>
            <Text style={s.tSub}>{ticket.unit ? `Unit ${ticket.unit}` : ticket.areaLabel || 'Common Area'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {(ticket.occurrenceCount || 0) > 1 && (
              <View style={s.occBadge}>
                <MaterialIcons name="replay" size={11} color={colors.dangerMid} />
                <Text style={s.occTxt}>{ticket.occurrenceCount}x</Text>
              </View>
            )}
            <View style={{ backgroundColor: pc.bg, borderWidth: 1, borderColor: pc.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: pc.text }}>{ticket.priority}</Text>
            </View>
          </View>
        </View>
        <Text style={s.tDesc} numberOfLines={2}>{ticket.description}</Text>
      </View>
      <View style={s.tZ3}>
        <View style={{ flex: 1 }}>
          <Text style={s.quoteAmt}>{recommended ? `KES ${(recommended.total || 0).toLocaleString()}` : 'Awaiting quotes'}</Text>
          {quoteCount > 0 && <Text style={s.quoteSub}>{quoteCount} quote{quoteCount !== 1 ? 's' : ''} received</Text>}
        </View>
        <TouchableOpacity style={s.approveBtn} onPress={onPress}>
          <Text style={s.approveTxt}>{quoteCount > 0 ? 'Review Quotes' : 'View Repair'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function PropRow({ prop, openCount, onPress }) {
  return (
    <TouchableOpacity style={s.pCard} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={s.pName}>{prop.name}</Text>
        <Text style={s.pAddr}>{prop.location}</Text>
      </View>
      {openCount > 0 ? (
        <View style={s.openBadge}><Text style={s.openTxt}>{openCount} open</Text></View>
      ) : (
        <View style={[s.openBadge, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}>
          <Text style={[s.openTxt, { color: colors.success }]}>All clear</Text>
        </View>
      )}
      <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hdrBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },

  setupBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, marginBottom: 4, backgroundColor: colors.primaryXLight, borderWidth: 1, borderColor: colors.primaryLight, borderRadius: 10, padding: 12 },
  setupTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.primaryMid },

  // Hero
  hero: { margin: spacing.md, marginBottom: 14, backgroundColor: '#0B1424', borderRadius: 18, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 10 },
  heroLabel: { fontSize: 10, fontWeight: '700', color: '#475569', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  heroBig: { fontSize: 24, fontWeight: '900', color: '#fff', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  heroSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  collectBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  collectPct: { fontSize: 13, fontWeight: '800', color: '#34D399' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 16, borderRadius: 2, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', borderRadius: 2 },
  heroStats: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  heroStatCell: { flex: 1 },
  heroStatLbl: { fontSize: 9, fontWeight: '700', color: '#475569', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  heroStatVal: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },

  budgetRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  budgetLbl: { fontSize: 10, fontWeight: '600', color: '#64748B', marginBottom: 5 },
  budgetTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  budgetFill: { height: '100%', borderRadius: 2 },

  heroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 48 },
  heroBtnTxt: { fontSize: 13, fontWeight: '700', color: '#CBD5E1' },

  // Bento Grid
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: spacing.md, marginBottom: 6 },
  bentoCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, flexBasis: '45%', flexGrow: 1, padding: 14 },
  bentoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bentoCount: { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  bentoLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 2 },
  bentoHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Sections
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 18, paddingBottom: 10 },
  secTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  seeAll: { fontSize: 13, color: colors.primaryMid, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 24, gap: 6 },
  emptyTxt: { fontSize: 13, color: colors.textSecondary },
  emptyCard: { alignItems: 'center', paddingVertical: 28, backgroundColor: colors.surface, marginHorizontal: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 6, marginBottom: 12 },
  emptyCardTxt: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptyCardHint: { fontSize: 12, color: colors.textMuted },

  // Ticket Cards
  tCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginHorizontal: spacing.md, marginBottom: 10, overflow: 'hidden' },
  tBody: { padding: 14, gap: 8 },
  tZ1: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  tCat: { fontSize: 14, fontWeight: '700', color: colors.text },
  tSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  tZ3: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  quoteAmt: { fontSize: 14, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  quoteSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  approveBtn: { backgroundColor: colors.successMid, borderRadius: 8, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  approveTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  occBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  occTxt: { fontSize: 11, fontWeight: '700', color: colors.dangerMid },

  // Property Cards
  pCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginHorizontal: spacing.md, marginBottom: 10, padding: 14, flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  pName: { fontSize: 14, fontWeight: '700', color: colors.text },
  pAddr: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  openBadge: { backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  openTxt: { fontSize: 11, fontWeight: '700', color: colors.warningMid },

  // Bottom Sheets
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sheetHint: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 14 },
  sheetColRow: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  sheetCol: { flex: 1, fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', textAlign: 'center' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetCell: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  propLink: { flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 50, paddingRight: 4 },
  propLinkTxt: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: colors.primaryMid, textDecorationLine: 'underline' },
  pillCell: { flex: 1, alignItems: 'center' },
  pill: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, minWidth: 44, alignItems: 'center' },
  pillTxt: { fontSize: 13, color: '#1D4ED8', fontWeight: '700', fontVariant: ['tabular-nums'] },
  sheetEmpty: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  sheetEmptyTxt: { fontSize: 14, color: colors.textMuted },
  sheetEmptyBtn: { backgroundColor: colors.primaryMid, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  sheetEmptyBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Leaderboard
  lbCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 14, gap: 12 },
  lbCardTop: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  lbHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  rankTxt: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  lbName: { fontSize: 15, fontWeight: '800', color: colors.text },
  lbId: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  lbStats: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLbl: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  bonusBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryMid, borderRadius: 8, minHeight: 48 },
  bonusBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  confirmTxt: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  awardedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBorder, borderRadius: 8, minHeight: 48 },
  awardedTxt: { fontSize: 14, fontWeight: '700', color: colors.success },
  profileLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
  profileLinkTxt: { fontSize: 13, fontWeight: '700', color: colors.primaryMid },
});

// --- Contractor Dossier Sheet ---
const DS = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLbl: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  secLbl: { fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  repairRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 10, gap: 6 },
  repairTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  repairCat: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  repairSub: { fontSize: 12, color: colors.textMuted },
  repairDate: { fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  viewLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4 },
  viewLinkTxt: { fontSize: 13, fontWeight: '700', color: colors.primaryMid, textDecorationLine: 'underline' },
  callBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  emptyTxt: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  headerCloseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
});

const STATUS_PILL = {
  reported: { bg: colors.warningBg, border: colors.warningBorder, text: colors.warningMid, label: 'Reported' },
  quotes_uploaded: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', label: 'Quotes Uploaded' },
  awaiting_approval: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', label: 'Awaiting Approval' },
  approved: { bg: '#F0FDF4', border: '#BBF7D0', text: '#059669', label: 'Approved' },
  in_progress: { bg: '#F0FDF4', border: '#BBF7D0', text: '#059669', label: 'In Progress' },
  pending_signoff: { bg: '#FFF7ED', border: '#FED7AA', text: '#D97706', label: 'Pending Signoff' },
  resolved: { bg: '#F0FDF4', border: '#BBF7D0', text: '#059669', label: 'Resolved' },
  rejected: { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.dangerMid, label: 'Rejected' },
};

function ContractorDossierSheet({ contractor: c, tickets, visible, onClose, navigation }) {
  if (!c) return null;
  const history = tickets.filter(t => {
    const r = t.assignedRepairer;
    return r && (r.workerId === c.id || r.id === c.id);
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const pct = onTimePct(c);
  const rr = repeatPct(c);

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.92} minHeight={320}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <View style={DS.headerCloseRow}>
          <Text style={DS.name}>{c.name}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={DS.headerRow}>
          <View style={DS.avatar}>
            <MaterialIcons name="engineering" size={26} color={colors.primaryMid} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={DS.meta}>{c.trade} · ID: {c.id}</Text>
          </View>
          {c.phone && (
            <TouchableOpacity style={DS.callBtn} onPress={() => Linking.openURL(`tel:${c.phone}`)} activeOpacity={0.8}>
              <MaterialIcons name="call" size={18} color={colors.primaryMid} />
            </TouchableOpacity>
          )}
        </View>
        <View style={DS.statsRow}>
          <View style={DS.statBox}>
            <Text style={[DS.statVal, { color: pct >= 90 ? colors.successMid : colors.warningMid }]}>{pct}%</Text>
            <Text style={DS.statLbl}>On-Time</Text>
          </View>
          <View style={DS.statBox}>
            <Text style={[DS.statVal, { color: colors.text }]}>{c.completed}</Text>
            <Text style={DS.statLbl}>Jobs Done</Text>
          </View>
          <View style={DS.statBox}>
            <Text style={[DS.statVal, { color: rr > 0 ? colors.dangerMid : colors.successMid }]}>{rr}%</Text>
            <Text style={DS.statLbl}>Repeat Issues</Text>
          </View>
        </View>
        <Text style={DS.secLbl}>Repair History ({history.length})</Text>
        {history.length === 0 ? (
          <Text style={DS.emptyTxt}>No repair history yet.</Text>
        ) : history.map(t => {
          const sp = STATUS_PILL[t.status] || STATUS_PILL.reported;
          return (
            <View key={t.id} style={DS.repairRow}>
              <View style={DS.repairTop}>
                <View style={{ flex: 1 }}>
                  <Text style={DS.repairCat}>{t.category}</Text>
                  <Text style={DS.repairSub}>{t.propertyName} · {t.unit ? `Unit ${t.unit}` : t.areaLabel || 'Common Area'}</Text>
                </View>
                <View style={{ backgroundColor: sp.bg, borderWidth: 1, borderColor: sp.border, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: sp.text }}>{sp.label}</Text>
                </View>
              </View>
              <Text style={DS.repairDate}>{new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              <TouchableOpacity style={DS.viewLink} onPress={() => { onClose(); navigation.navigate('TicketDetail', { ticketId: t.id }); }} activeOpacity={0.7}>
                <Text style={DS.viewLinkTxt}>View Repair Details</Text>
                <MaterialIcons name="arrow-forward" size={16} color={colors.primaryMid} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}
