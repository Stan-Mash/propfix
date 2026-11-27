import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet from './BottomSheet';
import { Field, Btn, Badge, SheetHeader, SectionLabel } from './ui';
import { usePortfolio } from '../context/PortfolioContext';
import { colors } from '../theme';

const n0 = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

function Cell({ label, value, tone }) {
  return (
    <View style={s.cell}>
      <Text style={s.cellLbl}>{label}</Text>
      <Text style={[s.cellVal, tone && { color: tone }]}>{value}</Text>
    </View>
  );
}

// Monthly master meter ledger for one building, with a form to log this month's gate reading
export default function MasterMeterSheet({ propertyId, visible, onClose }) {
  const { properties, getMasterLedger, logMasterReading } = usePortfolio();
  const property = properties.find(p => p.id === propertyId);
  const [reading, setReading] = useState('');
  const [bowser, setBowser] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (visible && property) { setReading(''); setBowser(String(Math.round((property.bowserLitres || 0) / 1000) || '')); setError(''); setSaved(false); }
  }, [visible, propertyId]);

  if (!property) return null;
  const ledger = getMasterLedger(propertyId).slice().reverse();
  const current = ledger[0];

  const save = () => {
    const val = parseFloat(reading);
    if (isNaN(val)) { setError('Enter the reading shown on the gate master meter.'); return; }
    if (current && val < current.prev) { setError(`The reading cannot be lower than the opening reading of ${n0(current.prev)}.`); return; }
    logMasterReading(propertyId, val, parseFloat(bowser) || 0);
    setError(''); setSaved(true); setReading('');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.92}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <SheetHeader title="Master Meter History" sub={property.name} />

        <View style={s.form}>
          <SectionLabel>Log Master Meter Reading</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field style={{ flex: 1.3 }} label="Gate meter reading (units)" value={reading} onChangeText={(v) => { setReading(v.replace(/[^0-9.]/g, '')); setSaved(false); }} keyboardType="decimal-pad" placeholder={current ? String(current.pres) : '0'} />
            <Field style={{ flex: 1 }} label="Tanker added (units)" value={bowser} onChangeText={(v) => setBowser(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" />
          </View>
          {error ? <Text style={s.error}>{error}</Text> : null}
          {saved ? <Text style={s.saved}>Reading saved to {current?.month}.</Text> : null}
          <Btn label="Save Reading" icon="save" onPress={save} />
        </View>

        <SectionLabel>Monthly Ledger</SectionLabel>
        {ledger.map(r => (
          <View key={r.id} style={s.row}>
            <View style={s.rowHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.month}>{r.month}{r.isCurrent ? ' · Current' : ''}</Text>
                <Text style={s.readings}>Master meter: {n0(r.prev)} → {n0(r.pres)}</Text>
              </View>
              {r.hasLeak
                ? <Badge label="Leak Alert" icon="water-drop" text={colors.danger} bg={colors.dangerBg} border={colors.dangerBorder} />
                : <Badge label="Normal" icon="check-circle" text={colors.success} bg={colors.successBg} border={colors.successBorder} />}
            </View>
            <View style={s.grid}>
              <Cell label="Master used" value={`${n0(r.used)} units`} />
              <Cell label="Tenant sub-meters" value={`${n0(r.sub)} units`} />
              <Cell label="Tanker added" value={`${n0(r.bowser)} units`} />
              <Cell label="Leak variance" value={`${n0(r.variance)} units · ${r.variancePct.toFixed(1)}%`} tone={r.hasLeak ? colors.dangerMid : colors.text} />
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  form: { backgroundColor: colors.surfaceAlt, borderRadius: 16, padding: 14, marginBottom: 16 },
  error: { fontSize: 12, fontWeight: '500', color: colors.dangerMid, marginBottom: 10 },
  saved: { fontSize: 12, fontWeight: '600', color: colors.success, marginBottom: 10 },
  row: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  month: { fontSize: 15, fontWeight: '700', color: colors.text },
  readings: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  cellLbl: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  cellVal: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2, fontVariant: ['tabular-nums'] },
});
