import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { usePortfolio } from '../../context/PortfolioContext';
import ScreenHeader from '../../components/ScreenHeader';
import { useTickets } from '../../context/TicketsContext';
import { PropertyFormSheet } from '../../components/PortfolioForms';
import { colors, spacing, card } from '../../theme';

const fmt = (n) => 'KES ' + Number(n || 0).toLocaleString();

export default function PortfolioScreen({ navigation }) {
  const { userProfile } = useAuth();
  const { properties, units: allUnits, getVariance } = usePortfolio();
  const { tickets } = useTickets();
  const [search, setSearch] = useState('');
  const [showAddProp, setShowAddProp] = useState(false);

  const isCaretaker = userProfile?.role === 'caretaker';
  const isManager = userProfile?.role === 'manager';
  const isLandlord = userProfile?.role === 'landlord';
  const canAdd = isLandlord || isManager;

  let visibleProps = properties;
  if (isCaretaker && userProfile?.assignedProperties?.length) {
    visibleProps = visibleProps.filter(p => userProfile.assignedProperties.includes(p.id));
  } else if (isManager) {
    const managed = visibleProps.filter(p => p.managerId === userProfile?.uid);
    if (managed.length > 0) visibleProps = managed;
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    visibleProps = visibleProps.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q)
    );
  }

  return (
    <View style={s.root}>
      <ScreenHeader
        title={isCaretaker ? 'My Property' : 'Portfolio'}
        subtitle={`${visibleProps.length} propert${visibleProps.length !== 1 ? 'ies' : 'y'}`}
      />

      <View style={s.topRow}>
        <View style={s.searchWrap}>
          <MaterialIcons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search properties..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="cancel" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {canAdd && (
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddProp(true)} activeOpacity={0.85}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={s.addBtnTxt}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={visibleProps}
        keyExtractor={p => p.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialIcons name="business" size={36} color={colors.border} />
            <Text style={s.emptyTxt}>{search ? 'No properties match your search.' : 'No properties yet. Tap Add to create one.'}</Text>
          </View>
        }
        renderItem={({ item: p }) => {
          const units = allUnits[p.id] || [];
          const occupied = units.filter(u => u.status === 'occupied').length;
          const onNotice = units.filter(u => u.status === 'on_notice').length;
          const vacant = units.filter(u => u.status === 'vacant').length;
          const openList = tickets.filter(t => t.propertyId === p.id && !['resolved', 'rejected'].includes(t.status));
          const openTickets = openList.length;
          const leak = getVariance(p.id);
          const hasLeak = leak?.hasLeak;

          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('UnitRoster', { propertyId: p.id })}
              activeOpacity={0.8}
            >
              <View style={s.cardBody}>
                <View style={{ flex: 1 }}>
                  <Text style={s.propName}>{p.name}</Text>
                  <Text style={s.propAddr} numberOfLines={1}>{p.location || p.address}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
              </View>

              {hasLeak && (
                <View style={s.leakBadge}>
                  <MaterialIcons name="water-drop" size={14} color={colors.info} />
                  <Text style={s.leakTxt}>Water Leak Alert · {leak.variancePct.toFixed(1)}% non-revenue variance</Text>
                </View>
              )}

              <View style={s.pillRow}>
                <OccPill value={occupied} label="Occupied" color={colors.successMid} bg={colors.successBg} border={colors.successBorder} />
                {onNotice > 0 && <OccPill value={onNotice} label="On Notice" color={colors.warningMid} bg={colors.warningBg} border={colors.warningBorder} />}
                {vacant > 0 && <OccPill value={vacant} label="Vacant" color={colors.dangerMid} bg={colors.dangerBg} border={colors.dangerBorder} />}
              </View>

              <View style={s.cardFoot}>
                {openTickets > 0 ? (
                  <View style={s.ticketBadge}>
                    <MaterialIcons name="build" size={13} color={colors.warning} />
                    <Text style={s.ticketTxt}>{openTickets} open repair{openTickets !== 1 ? 's' : ''}</Text>
                  </View>
                ) : (
                  <View style={[s.ticketBadge, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}>
                    <MaterialIcons name="check-circle-outline" size={13} color={colors.successMid} />
                    <Text style={[s.ticketTxt, { color: colors.successMid }]}>No open repairs</Text>
                  </View>
                )}
                {!isCaretaker && <Text style={s.spendTxt}>{units.length} unit{units.length !== 1 ? 's' : ''}</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <PropertyFormSheet
        visible={showAddProp}
        onClose={() => setShowAddProp(false)}
        onSaved={(propId) => { setShowAddProp(false); if (propId) navigation.navigate('UnitRoster', { propertyId: propId }); }}
      />
    </View>
  );
}

function OccPill({ value, label, color, bg, border }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontSize: 10, color, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginTop: 12, marginBottom: 4, gap: 10 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 10, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryMid, borderRadius: 8, paddingHorizontal: 14, minHeight: 46 },
  addBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  card: { ...card, overflow: 'hidden' },
  leakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.infoBg, borderWidth: 1, borderColor: colors.infoBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginHorizontal: 14, marginBottom: 10 },
  leakTxt: { fontSize: 12, fontWeight: '700', color: colors.info, flexShrink: 1 },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, paddingBottom: 10 },
  propName: { fontSize: 15, fontWeight: '700', color: colors.text },
  propAddr: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 12, flexWrap: 'wrap' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#F8FAFC' },
  ticketBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  ticketTxt: { fontSize: 11, fontWeight: '700', color: colors.warning },
  spendTxt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTxt: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
