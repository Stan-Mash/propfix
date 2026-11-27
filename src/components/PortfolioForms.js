import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import BottomSheet from './BottomSheet';
import { Field, Btn, ChoiceRow, SheetHeader, SectionLabel } from './ui';
import { usePortfolio } from '../context/PortfolioContext';
import { STAFF } from '../data/seed';
import { todayISO, fmtDay } from '../utils/dates';
import { colors } from '../theme';

const digits = (v) => v.replace(/[^0-9]/g, '');
const decimal = (v) => v.replace(/[^0-9.]/g, '');

// ---------- Add / edit property ----------
export function PropertyFormSheet({ visible, onClose, property, onSaved }) {
  const { addProperty, updateProperty } = usePortfolio();
  const editing = !!property;
  const [f, setF] = useState({});
  const [bulk, setBulk] = useState({ enabled: true, prefix: 'A', count: '6', rent: '25000' });
  const [error, setError] = useState('');
  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!visible) return;
    setError('');
    setF(editing
      ? { name: property.name, location: property.location || '', waterRate: String(property.waterRate || 65), masterMeterReading: String(property.masterMeterReading || 0), managerId: property.managerId, caretakerId: property.caretakerId }
      : { name: '', location: '', waterRate: '65', masterMeterReading: '', managerId: STAFF.managers[0]?.id ?? null, caretakerId: STAFF.caretakers[0]?.id ?? null });
    setBulk({ enabled: true, prefix: 'A', count: '6', rent: '25000' });
  }, [visible, property?.id]);

  const save = () => {
    if (!f.name?.trim()) { setError('Enter the property name.'); return; }
    if (!f.location?.trim()) { setError('Enter the location.'); return; }
    if (!(parseFloat(f.waterRate) > 0)) { setError('Enter the water rate per unit.'); return; }
    if (editing) {
      updateProperty(property.id, { name: f.name.trim(), location: f.location.trim(), waterRate: parseFloat(f.waterRate), managerId: f.managerId, caretakerId: f.caretakerId });
      onSaved?.(property.id);
    } else {
      if (bulk.enabled && !(parseInt(bulk.count, 10) > 0)) { setError('Enter how many units to generate, or switch the generator off.'); return; }
      onSaved?.(addProperty(f, bulk));
    }
    onClose();
  };

  const count = parseInt(bulk.count, 10) || 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.92}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <SheetHeader title={editing ? 'Edit Property' : 'Add New Property'} sub={editing ? property.name : 'Three short steps'} />

        <SectionLabel>1 · Property</SectionLabel>
        <Field label="Property name" value={f.name} onChangeText={set('name')} placeholder="e.g. Kilimani Crest" />
        <Field label="Location" value={f.location} onChangeText={set('location')} placeholder="e.g. Kilimani" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label="Water rate per unit (KES)" value={f.waterRate} onChangeText={v => set('waterRate')(decimal(v))} keyboardType="decimal-pad" />
          {!editing && <Field style={{ flex: 1 }} label="Initial master meter" value={f.masterMeterReading} onChangeText={v => set('masterMeterReading')(decimal(v))} keyboardType="decimal-pad" placeholder="0" />}
        </View>

        {(STAFF.managers.length > 0 || STAFF.caretakers.length > 0) && (
          <>
            <SectionLabel>2 · Team</SectionLabel>
            {STAFF.managers.length > 0 && <ChoiceRow label="Assigned manager" value={f.managerId} onChange={set('managerId')} options={STAFF.managers.map(m => ({ value: m.id, label: m.name }))} />}
            {STAFF.caretakers.length > 0 && <ChoiceRow label="Assigned caretaker" value={f.caretakerId} onChange={set('caretakerId')} options={STAFF.caretakers.map(m => ({ value: m.id, label: m.name }))} />}
          </>
        )}

        {!editing && (
          <>
            <SectionLabel>{STAFF.managers.length > 0 || STAFF.caretakers.length > 0 ? '3' : '2'} · Units</SectionLabel>
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTxt}>Auto-generate units now</Text>
                <Text style={s.toggleSub}>Creates numbered vacant units in one go</Text>
              </View>
              <Switch value={bulk.enabled} onValueChange={v => setBulk(b => ({ ...b, enabled: v }))} trackColor={{ true: colors.primaryMid, false: colors.borderStrong }} thumbColor="#fff" />
            </View>
            {bulk.enabled && (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Field style={{ flex: 1 }} label="Unit prefix" value={bulk.prefix} onChangeText={v => setBulk(b => ({ ...b, prefix: v.toUpperCase().slice(0, 3) }))} autoCapitalize="characters" placeholder="A" />
                  <Field style={{ flex: 1 }} label="Number of units" value={bulk.count} onChangeText={v => setBulk(b => ({ ...b, count: digits(v).slice(0, 3) }))} keyboardType="number-pad" />
                </View>
                <Field label="Default monthly rent (KES)" value={bulk.rent} onChangeText={v => setBulk(b => ({ ...b, rent: digits(v) }))} keyboardType="number-pad" />
                {count > 0 && <Text style={s.preview}>Will create {count} unit{count !== 1 ? 's' : ''}: {bulk.prefix}1{count > 1 ? ` to ${bulk.prefix}${count}` : ''}</Text>}
              </>
            )}
          </>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}
        <Btn label={editing ? 'Save Property' : 'Create Property'} icon="check" onPress={save} />
      </View>
    </BottomSheet>
  );
}

// ---------- Add / edit unit ----------
export function UnitFormSheet({ visible, onClose, propertyId, unit, onSaved, onDelete }) {
  const { units, addUnit, updateUnit } = usePortfolio();
  const editing = !!unit;
  const [f, setF] = useState({});
  const [error, setError] = useState('');
  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!visible) return;
    setError('');
    setF(editing ? { unit: unit.unit, rent: String(unit.rent || ''), status: unit.status } : { unit: '', rent: '', reading: '', status: 'vacant' });
  }, [visible, unit?.id]);

  const save = () => {
    const label = (f.unit || '').trim().toUpperCase();
    if (!label) { setError('Enter the unit number, for example A7 or B1.'); return; }
    if ((units[propertyId] || []).some(u => u.unit.toUpperCase() === label && u.id !== unit?.id)) { setError(`Unit ${label} already exists in this property.`); return; }
    if (editing) {
      updateUnit(propertyId, unit.id, { unit: label, rent: parseFloat(f.rent) || 0 });
      onSaved?.(unit.id, false);
    } else {
      const id = addUnit(propertyId, { unit: label, rent: f.rent, reading: f.reading });
      onSaved?.(id, f.status === 'occupied');
    }
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.9}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <SheetHeader title={editing ? `Edit Unit ${unit.unit}` : 'Add Unit'} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label="Unit number" value={f.unit} onChangeText={set('unit')} autoCapitalize="characters" placeholder="A7" />
          <Field style={{ flex: 1.3 }} label="Monthly rent (KES)" value={f.rent} onChangeText={v => set('rent')(digits(v))} keyboardType="number-pad" placeholder="25000" />
        </View>
        {!editing && (
          <>
            <Field label="Initial water meter reading (units)" value={f.reading} onChangeText={v => set('reading')(decimal(v))} keyboardType="decimal-pad" placeholder="0" />
            <ChoiceRow label="Starting status" value={f.status} onChange={set('status')} options={[{ value: 'vacant', label: 'Vacant' }, { value: 'occupied', label: 'Occupied' }]} />
          </>
        )}
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Btn label={editing ? 'Save Unit' : f.status === 'occupied' ? 'Save & Add Tenant' : 'Add Unit'} icon="check" onPress={save} />
        {editing && (
          <>
            <Btn label="Delete Unit" icon="delete" outline color={colors.dangerMid} disabled={!!unit.tenant} onPress={() => { onClose(); onDelete?.(unit); }} style={{ marginTop: 10 }} />
            {unit.tenant ? <Text style={s.hint}>Vacate {unit.tenant} before deleting this unit.</Text> : null}
          </>
        )}
      </View>
    </BottomSheet>
  );
}

// ---------- Onboard tenant into a vacant unit ----------
export function TenantFormSheet({ visible, onClose, propertyId, unit }) {
  const { addTenant } = usePortfolio();
  const [f, setF] = useState({});
  const [error, setError] = useState('');
  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!visible || !unit) return;
    setError('');
    setF({ tenant: '', phone: '+254', email: '', moveInDate: todayISO(), moveInMeterReading: String(unit.presentReading ?? 0), rent: String(unit.rent || ''), depositPaid: String(unit.rent || '') });
  }, [visible, unit?.id]);

  if (!unit) return null;

  const save = () => {
    if (!f.tenant?.trim()) { setError('Enter the tenant full name.'); return; }
    if ((f.phone || '').replace(/\D/g, '').length < 9) { setError('Enter a full phone number, starting +254.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.moveInDate || '')) { setError('Enter the move-in date as YYYY-MM-DD.'); return; }
    if (f.moveInMeterReading === '') { setError('Enter the meter reading on move-in day.'); return; }
    addTenant(propertyId, unit.id, f);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.92}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <SheetHeader title="Add Tenant" sub={`Unit ${unit.unit}`} />
        <SectionLabel>Tenant</SectionLabel>
        <Field label="Tenant full name" value={f.tenant} onChangeText={set('tenant')} placeholder="e.g. Mary Wanjiku" />
        <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="+254..." />
        <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder="Optional" />
        <SectionLabel>Move-in</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label="Move-in date" value={f.moveInDate} onChangeText={set('moveInDate')} placeholder="YYYY-MM-DD" hint={fmtDay(f.moveInDate) || 'Year-month-day'} />
          <Field style={{ flex: 1 }} label="Move-in meter reading" value={f.moveInMeterReading} onChangeText={v => set('moveInMeterReading')(decimal(v))} keyboardType="decimal-pad" hint="Unit's last closing reading" />
        </View>
        <SectionLabel>Money</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label="Monthly rent (KES)" value={f.rent} onChangeText={v => set('rent')(digits(v))} keyboardType="number-pad" />
          <Field style={{ flex: 1 }} label="Deposit paid (KES)" value={f.depositPaid} onChangeText={v => set('depositPaid')(digits(v))} keyboardType="number-pad" />
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Btn label="Save Tenant" icon="person-add" onPress={save} />
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, marginBottom: 12 },
  toggleTxt: { fontSize: 15, fontWeight: '600', color: colors.text },
  toggleSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  preview: { fontSize: 13, fontWeight: '600', color: colors.success, marginBottom: 14 },
  error: { fontSize: 13, fontWeight: '500', color: colors.dangerMid, marginBottom: 12 },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
});
