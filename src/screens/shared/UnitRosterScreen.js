import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { UNIT_STATUS } from '../../data/seed';
import { usePortfolio } from '../../context/PortfolioContext';
import { useTickets } from '../../context/TicketsContext';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import TenantSheet from '../../components/TenantSheet';
import MasterMeterSheet from '../../components/MasterMeterSheet';
import ConfirmModal from '../../components/ConfirmModal';
import { PropertyFormSheet, UnitFormSheet, TenantFormSheet } from '../../components/PortfolioForms';
import { StatusDot, Badge, Btn } from '../../components/ui';
import { colors, spacing, card, accent } from '../../theme';

const fmt = (n) => 'KES ' + Number(n || 0).toLocaleString();
const n1 = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
const UNIT_DOT = { occupied: accent.done, on_notice: accent.Urgent, vacant: accent.neutral, under_repair: accent.info };

export default function UnitRosterScreen({ route, navigation }) {
  const { propertyId } = route.params || {};
  const { properties, units: allUnits, getVariance, deleteProperty, deleteUnit } = usePortfolio();
  const { tickets } = useTickets();
  const { userProfile } = useAuth();
  const canManage = userProfile?.role === 'landlord' || userProfile?.role === 'manager';

  const property = properties.find(p => p.id === propertyId);
  const units = allUnits[propertyId] || [];

  const [tenantTarget, setTenantTarget] = useState(null);
  const [showMaster, setShowMaster] = useState(false);
  const [showEditProp, setShowEditProp] = useState(false);
  const [unitForm, setUnitForm] = useState(null);
  const [tenantFormUnit, setTenantFormUnit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  if (!property) {
    return (
      <View style={s.root}>
        <ScreenHeader title="Property" showBack />
        <View style={s.notFound}>
          <MaterialIcons name="domain-disabled" size={36} color={colors.textMuted} />
          <Text style={s.notFoundTxt}>This property is no longer in the portfolio.</Text>
        </View>
      </View>
    );
  }

  const leak = getVariance(propertyId);
  const rate = property.waterRate || 65;
  const occupied = units.filter(u => u.status === 'occupied').length;
  const vacant = units.filter(u => u.status === 'vacant').length;
  const onNotice = units.filter(u => u.status === 'on_notice').length;
  const openRepairsCount = tickets.filter(t => t.propertyId === propertyId && !['resolved', 'rejected'].includes(t.status)).length;
  const tenantCount = units.filter(u => u.tenant).length;

  return (
    <View style={s.root}>
      <ScreenHeader title={property.name} subtitle={`${property.location} · ${units.length} unit${units.length !== 1 ? 's' : ''}`} showBack />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>

        {canManage && (
          <View style={s.propActions}>
            <Btn label="Edit Property" icon="edit" outline onPress={() => setShowEditProp(true)} style={{ flex: 1 }} />
            <Btn label="Delete Property" icon="delete" outline color={colors.dangerMid} onPress={() => setConfirm({ type: 'property' })} style={{ flex: 1 }} />
          </View>
        )}

        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Master Meter</Text>
            {leak?.hasLeak
              ? <Badge label={`Leak Alert · ${leak.variancePct.toFixed(1)}%`} icon="water-drop" text={colors.danger} bg={colors.dangerBg} border={colors.dangerBorder} />
              : <Badge label="Normal" icon="check-circle" text={colors.success} bg={colors.successBg} border={colors.successBorder} />}
          </View>
          <View style={s.meterRow}>
            <MeterStat label="Previous" value={n1(property.lastMasterMeter)} />
            <View style={s.divider} />
            <MeterStat label="Current" value={n1(property.masterMeterReading)} />
            <View style={s.divider} />
            <MeterStat label="Used" value={n1(leak?.masterConsumption)} highlight />
          </View>
          {leak ? (
            <Text style={s.meterNote}>
              Flats metered {n1(leak.subMeterTotal)} units{leak.bowser ? ` · tanker added ${n1(leak.bowser)}` : ''} · unaccounted {n1(leak.variance)} units
            </Text>
          ) : null}
          <TouchableOpacity style={s.linkBtn} onPress={() => setShowMaster(true)} activeOpacity={0.8}>
            <Text style={s.linkBtnTxt}>View Master Meter History</Text>
            <MaterialIcons name="arrow-forward" size={18} color={colors.primaryMid} />
          </TouchableOpacity>
        </View>

        <View style={[s.card, { flexDirection: 'row', paddingVertical: 6 }]}>
          <OccBox value={occupied} label="Occupied" color={accent.done} />
          <OccBox value={onNotice} label="On Notice" color={accent.Urgent} />
          <OccBox value={vacant} label="Vacant" color={colors.textSecondary} />
          <OccBox value={openRepairsCount} label="Open Repairs" color={accent.info} />
        </View>

        <View style={s.secRow}>
          <View>
            <Text style={s.secTitle}>Units ({units.length})</Text>
            <Text style={s.secSub}>Water at {fmt(rate)} per unit</Text>
          </View>
          {canManage && (
            <TouchableOpacity style={s.addBtn} onPress={() => setUnitForm({})} activeOpacity={0.85}>
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={s.addBtnTxt}>Add Unit</Text>
            </TouchableOpacity>
          )}
        </View>

        {units.length === 0 && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 28 }]}>
            <MaterialIcons name="meeting-room" size={36} color={colors.textMuted} />
            <Text style={[s.notFoundTxt, { marginTop: 8 }]}>No units yet. Add the first one to start assigning tenants.</Text>
          </View>
        )}

        {units.map(u => {
          const st = UNIT_STATUS[u.status] || UNIT_STATUS.vacant;
          const used = Math.max(0, (u.presentReading || 0) - (u.prevReading || 0));
          const past = u.pastTenants?.length || 0;
          return (
            <View key={u.id} style={s.card}>
              <View style={s.unitTop}>
                <View style={s.unitLabel}><Text style={s.unitNum}>{u.unit}</Text></View>
                {u.tenant ? (
                  <TouchableOpacity style={s.tenantLink} onPress={() => setTenantTarget({ propertyId, unitId: u.id })} activeOpacity={0.7}>
                    <Text style={s.tenantName} numberOfLines={1}>{u.tenant}</Text>
                    <Text style={s.tenantPhone} numberOfLines={1}>{u.phone || 'No phone saved'} · {fmt(u.rent)}/mo</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.tenantLink}>
                    <Text style={s.tenantEmpty}>No tenant</Text>
                    <Text style={s.tenantPhone}>{fmt(u.rent)}/mo{past ? ` · ${past} past tenant${past !== 1 ? 's' : ''}` : ''}</Text>
                  </View>
                )}
                <View style={s.statusWrap}>
                  <StatusDot color={UNIT_DOT[u.status] || accent.neutral} />
                  <Text style={[s.statusTxt, { color: st.text }]}>{st.label}</Text>
                </View>
              </View>

              <View style={s.readingRow}>
                <Text style={s.readingTxt}>Meter {n1(u.prevReading)} → {n1(u.presentReading)}</Text>
                <Text style={s.readingUse}>{n1(used)} units · {fmt(used * rate)}</Text>
              </View>

              {(u.arrears || 0) > 0 && (
                <Badge label={`Arrears ${fmt(u.arrears)}`} icon="error" text={colors.danger} bg={colors.dangerBg} border={colors.dangerBorder} />
              )}

              <View style={s.unitBtns}>
                {u.tenant ? (
                  <Btn label="Tenant Profile" icon="person" onPress={() => setTenantTarget({ propertyId, unitId: u.id })} style={{ flex: 1.4 }} />
                ) : canManage ? (
                  <Btn label="Add Tenant" icon="person-add" color={colors.successMid} onPress={() => setTenantFormUnit(u)} style={{ flex: 1.4 }} />
                ) : null}
                {u.status === 'on_notice' && (
                  <Btn label="Move-Out" icon="assignment" color={colors.warningMid} onPress={() => navigation.navigate('MoveOutInspection', { propertyId, unitId: u.unit })} style={{ flex: 1 }} />
                )}
                {canManage && <Btn label="Edit Unit" icon="edit" outline onPress={() => setUnitForm({ unit: u })} style={{ flex: 1 }} />}
              </View>
            </View>
          );
        })}

      </ScrollView>

      <TenantSheet target={tenantTarget} onClose={() => setTenantTarget(null)} navigation={navigation} />
      <MasterMeterSheet propertyId={propertyId} visible={showMaster} onClose={() => setShowMaster(false)} />
      <PropertyFormSheet visible={showEditProp} onClose={() => setShowEditProp(false)} property={property} />
      <UnitFormSheet
        visible={!!unitForm}
        onClose={() => setUnitForm(null)}
        propertyId={propertyId}
        unit={unitForm?.unit}
        onDelete={(unit) => setConfirm({ type: 'unit', unit })}
        onSaved={(unitId, wantsTenant) => { if (wantsTenant) setTenantFormUnit({ id: unitId }); }}
      />
      <TenantFormSheet
        visible={!!tenantFormUnit}
        onClose={() => setTenantFormUnit(null)}
        propertyId={propertyId}
        unit={tenantFormUnit ? units.find(x => x.id === tenantFormUnit.id) : null}
      />

      <ConfirmModal
        visible={confirm?.type === 'property'}
        title={`Delete ${property.name}?`}
        message={`This removes the property, its ${units.length} unit${units.length !== 1 ? 's' : ''}${tenantCount ? `, ${tenantCount} tenant record${tenantCount !== 1 ? 's' : ''}` : ''} and all meter history. It cannot be undone. Repairs already logged stay in Repairs history.`}
        confirmLabel="Delete Property"
        icon="delete-forever"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); deleteProperty(propertyId); navigation.goBack(); }}
      />
      <ConfirmModal
        visible={confirm?.type === 'unit'}
        title={`Delete Unit ${confirm?.unit?.unit || ''}?`}
        message="The unit and its meter readings are removed from this property. It cannot be undone."
        confirmLabel="Delete Unit"
        icon="delete-forever"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { deleteUnit(propertyId, confirm.unit.id); setConfirm(null); }}
      />
    </View>
  );
}

function MeterStat({ label, value, highlight }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color: highlight ? colors.primaryMid : colors.text, fontVariant: ['tabular-nums'], marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textMuted }}>units</Text>
    </View>
  );
}

function OccBox({ value, label, color }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 24 },
  notFoundTxt: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  propActions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  card: { ...card, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  meterRow: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1, height: 40, backgroundColor: colors.border },
  meterNote: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', fontVariant: ['tabular-nums'] },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: 8, backgroundColor: colors.primaryXLight, borderWidth: 1, borderColor: colors.primaryLight },
  linkBtnTxt: { fontSize: 14, fontWeight: '700', color: colors.primaryMid },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 12 },
  secTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  secSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryMid, borderRadius: 8, paddingHorizontal: 14, minHeight: 48 },
  addBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  unitTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unitLabel: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  unitNum: { fontSize: 14, fontWeight: '700', color: colors.primaryMid },
  tenantLink: { flex: 1, minHeight: 48, justifyContent: 'center' },
  tenantName: { fontSize: 15, fontWeight: '700', color: colors.primaryMid, textDecorationLine: 'underline' },
  tenantEmpty: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  tenantPhone: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusTxt: { fontSize: 12, fontWeight: '700' },
  readingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  readingTxt: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  readingUse: { fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  unitBtns: { flexDirection: 'row', gap: 8 },
});
