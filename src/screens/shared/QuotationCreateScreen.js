import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal, FlatList,
} from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, card } from '../../theme';

// ─── Item catalogue ───────────────────────────────────────────────────────────
// { label, unit } — unit auto-sets when item is selected
const CATALOGUE = [
  {
    category: 'Plumbing',
    items: [
      { label: 'Replace tap washer', unit: 'pcs' },
      { label: 'Replace kitchen tap', unit: 'pcs' },
      { label: 'Replace bathroom tap', unit: 'pcs' },
      { label: 'Replace ball valve / ballcock', unit: 'pcs' },
      { label: 'Replace gate valve', unit: 'pcs' },
      { label: 'Replace stop cock', unit: 'pcs' },
      { label: 'Replace flexible hose', unit: 'pcs' },
      { label: 'Repair burst pipe', unit: 'hrs' },
      { label: 'Replace pipe section', unit: 'metres' },
      { label: 'Fix leaking pipe joint', unit: 'hrs' },
      { label: 'Seal pipe penetration', unit: 'hrs' },
      { label: 'Unblock drain', unit: 'hrs' },
      { label: 'Replace toilet cistern', unit: 'pcs' },
      { label: 'Replace WC flush valve', unit: 'pcs' },
      { label: 'Replace toilet seat', unit: 'pcs' },
      { label: 'Replace toilet bowl', unit: 'pcs' },
      { label: 'Replace sink', unit: 'pcs' },
      { label: 'Replace shower head', unit: 'pcs' },
      { label: 'Replace shower mixer', unit: 'pcs' },
      { label: 'Replace water pump', unit: 'pcs' },
      { label: 'Service / descale water pump', unit: 'hrs' },
      { label: 'Replace pump pressure tank', unit: 'pcs' },
      { label: 'Replace float switch', unit: 'pcs' },
      { label: 'Install booster pump', unit: 'pcs' },
      { label: 'Replace pipe lagging / insulation', unit: 'metres' },
      { label: 'Replace water meter', unit: 'pcs' },
      { label: 'Install sub-meter', unit: 'pcs' },
      { label: 'Repair meter leak', unit: 'hrs' },
      { label: 'Clean / flush water tank', unit: 'trips' },
      { label: 'Repair water tank crack', unit: 'hrs' },
      { label: 'Replace water tank', unit: 'pcs' },
    ],
  },
  {
    category: 'Electrical',
    items: [
      { label: 'Replace LED bulb', unit: 'pcs' },
      { label: 'Replace fluorescent tube', unit: 'pcs' },
      { label: 'Replace light fitting / batten', unit: 'pcs' },
      { label: 'Replace single switch', unit: 'pcs' },
      { label: 'Replace double switch', unit: 'pcs' },
      { label: 'Replace socket outlet', unit: 'pcs' },
      { label: 'Install new socket outlet', unit: 'pcs' },
      { label: 'Replace circuit breaker', unit: 'pcs' },
      { label: 'Replace consumer unit / DB board', unit: 'pcs' },
      { label: 'Replace distribution board fuse', unit: 'pcs' },
      { label: 'Trace and repair wiring fault', unit: 'hrs' },
      { label: 'Repair earthing / bonding', unit: 'hrs' },
      { label: 'Replace meter tails', unit: 'hrs' },
      { label: 'Replace LED strip light', unit: 'metres' },
      { label: 'Replace security / flood light', unit: 'pcs' },
      { label: 'Replace ceiling fan', unit: 'pcs' },
      { label: 'Replace doorbell', unit: 'pcs' },
      { label: 'Install surge protector', unit: 'pcs' },
    ],
  },
  {
    category: 'Painting & Plastering',
    items: [
      { label: 'Interior wall painting (emulsion)', unit: 'litres' },
      { label: 'Exterior wall painting', unit: 'litres' },
      { label: 'Ceiling painting', unit: 'litres' },
      { label: 'Undercoat / primer', unit: 'litres' },
      { label: 'Anti-fungal / mould treatment', unit: 'litres' },
      { label: 'Waterproof / damp-proof coating', unit: 'litres' },
      { label: 'Apply texture coat', unit: 'litres' },
      { label: 'Patch plaster crack (small)', unit: 'hrs' },
      { label: 'Patch plaster crack (large)', unit: 'hrs' },
      { label: 'Full wall plastering', unit: 'hrs' },
      { label: 'Paint door (both sides)', unit: 'pcs' },
      { label: 'Paint window frame', unit: 'pcs' },
      { label: 'Sandpaper and prep work', unit: 'hrs' },
    ],
  },
  {
    category: 'Carpentry & Doors',
    items: [
      { label: 'Replace door lock (mortice)', unit: 'pcs' },
      { label: 'Replace door lock (rim / night latch)', unit: 'pcs' },
      { label: 'Replace padlock', unit: 'pcs' },
      { label: 'Replace door handle', unit: 'pcs' },
      { label: 'Replace door hinge', unit: 'pcs' },
      { label: 'Replace door closer', unit: 'pcs' },
      { label: 'Repair / rehang door', unit: 'hrs' },
      { label: 'Replace door (solid timber)', unit: 'pcs' },
      { label: 'Replace door (hollow core)', unit: 'pcs' },
      { label: 'Replace window pane (glass)', unit: 'pcs' },
      { label: 'Replace window lock / latch', unit: 'pcs' },
      { label: 'Repair window frame', unit: 'hrs' },
      { label: 'Fix wardrobe / cabinet door', unit: 'hrs' },
      { label: 'Replace kitchen cabinet', unit: 'pcs' },
      { label: 'Repair wooden floor', unit: 'hrs' },
      { label: 'Replace skirting board', unit: 'metres' },
      { label: 'Replace door architrave', unit: 'metres' },
    ],
  },
  {
    category: 'Roofing',
    items: [
      { label: 'Replace iron sheet (box profile)', unit: 'sheets' },
      { label: 'Replace roof tile', unit: 'pcs' },
      { label: 'Replace ridge cap', unit: 'pcs' },
      { label: 'Seal roof leak (flashing / sealant)', unit: 'hrs' },
      { label: 'Apply roof bitumen / sealant', unit: 'litres' },
      { label: 'Replace gutter section', unit: 'metres' },
      { label: 'Replace gutter bracket', unit: 'pcs' },
      { label: 'Replace downpipe', unit: 'metres' },
      { label: 'Replace fascia board', unit: 'metres' },
      { label: 'Replace barge board', unit: 'metres' },
      { label: 'Roof inspection and report', unit: 'trips' },
    ],
  },
  {
    category: 'Flooring & Tiling',
    items: [
      { label: 'Replace floor tile (ceramic)', unit: 'pcs' },
      { label: 'Replace wall tile (ceramic)', unit: 'pcs' },
      { label: 'Re-grout floor tiles', unit: 'hrs' },
      { label: 'Re-grout wall tiles', unit: 'hrs' },
      { label: 'Screed and level floor', unit: 'hrs' },
      { label: 'Lay new floor tiles', unit: 'hrs' },
      { label: 'Polish concrete floor', unit: 'hrs' },
      { label: 'Repair cracked screed', unit: 'hrs' },
      { label: 'Replace vinyl / lino floor', unit: 'rolls' },
    ],
  },
  {
    category: 'General & Grounds',
    items: [
      { label: 'Pest control / fumigation', unit: 'trips' },
      { label: 'Rubbish and debris removal', unit: 'trips' },
      { label: 'Grass cutting', unit: 'trips' },
      { label: 'Hedge trimming', unit: 'trips' },
      { label: 'General deep cleaning', unit: 'hrs' },
      { label: 'Drain jetting (high pressure)', unit: 'trips' },
      { label: 'Water tank cleaning and chlorination', unit: 'trips' },
      { label: 'Septic tank emptying', unit: 'trips' },
      { label: 'Repair perimeter fence', unit: 'hrs' },
      { label: 'Replace boundary fence post', unit: 'pcs' },
      { label: 'Replace window burglar bars', unit: 'pcs' },
      { label: 'Replace gate lock', unit: 'pcs' },
      { label: 'Replace padlock and chain', unit: 'sets' },
      { label: 'Security grille repair', unit: 'hrs' },
      { label: 'Car park re-marking', unit: 'hrs' },
      { label: 'Driveway / pothole repair', unit: 'hrs' },
    ],
  },
];

const CATEGORY_ICONS = {
  'Plumbing': 'plumbing',
  'Electrical': 'electrical-services',
  'Painting & Plastering': 'format-paint',
  'Carpentry & Doors': 'handyman',
  'Roofing': 'roofing',
  'Flooring & Tiling': 'grid-on',
  'General & Grounds': 'cleaning-services',
};

const ALL_UNITS = ['pcs', 'bags', 'metres', 'litres', 'rolls', 'sheets', 'hrs', 'trips', 'sets', 'kg'];

const uid = () => Math.random().toString(36).slice(2, 9);
const blankItem = () => ({ id: uid(), description: '', qty: '', unit: 'pcs', supplier: '', unitPrice: '', total: 0 });
const calcItem = (item) => (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);

// ─── Item picker modal ────────────────────────────────────────────────────────
function ItemPickerModal({ visible, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [expandedCat, setExpandedCat] = useState(null);

  const q = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!q) return CATALOGUE;
    return CATALOGUE.map(c => ({
      ...c,
      items: c.items.filter(it => it.label.toLowerCase().includes(q)),
    })).filter(c => c.items.length > 0);
  }, [q]);

  const pick = (item) => { onSelect(item); setSearch(''); setExpandedCat(null); };
  const pickCustom = () => { onSelect({ label: '', unit: 'pcs', custom: true }); setSearch(''); setExpandedCat(null); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={ms.root}>
        {/* Header */}
        <View style={ms.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={ms.headerTitle}>Select Item</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Search */}
        <View style={ms.searchWrap}>
          <MaterialIcons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={ms.searchInput}
            placeholder="Search items..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="cancel" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={c => c.category}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <TouchableOpacity style={ms.customRow} onPress={pickCustom}>
              <View style={[ms.catIcon, { backgroundColor: '#F1F5F9' }]}>
                <MaterialIcons name="edit" size={16} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ms.customLabel}>Custom / Other</Text>
                <Text style={ms.customSub}>Type a description not in the list</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          }
          renderItem={({ item: cat }) => {
            const isOpen = expandedCat === cat.category || !!q;
            const icon = CATEGORY_ICONS[cat.category] || 'build';
            return (
              <View>
                <TouchableOpacity
                  style={ms.catRow}
                  onPress={() => setExpandedCat(isOpen && !q ? null : cat.category)}
                  activeOpacity={0.7}
                >
                  <View style={ms.catIcon}>
                    <MaterialIcons name={icon} size={16} color={colors.primaryMid} />
                  </View>
                  <Text style={ms.catLabel}>{cat.category}</Text>
                  <Text style={ms.catCount}>{cat.items.length}</Text>
                  {!q && <MaterialIcons name={isOpen ? 'expand-less' : 'expand-more'} size={18} color={colors.textMuted} />}
                </TouchableOpacity>
                {isOpen && cat.items.map(it => (
                  <TouchableOpacity key={it.label} style={ms.itemRow} onPress={() => pick(it)} activeOpacity={0.7}>
                    <Text style={ms.itemLabel}>{it.label}</Text>
                    <View style={ms.unitPill}>
                      <Text style={ms.unitPillTxt}>{it.unit}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          }}
        />
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function QuotationCreateScreen({ navigation }) {
  const { userProfile } = useAuth();
  const { properties } = usePortfolio();

  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [showPropPicker, setShowPropPicker] = useState(false);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState([blankItem()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickerFor, setPickerFor] = useState(null); // item id being picked

  const selectedProp = properties.find(p => p.id === propertyId) || properties[0];

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      updated.total = calcItem(updated);
      return updated;
    }));
  };

  const handlePickerSelect = ({ label, unit, custom }) => {
    if (custom) {
      updateItem(pickerFor, 'description', '');
      updateItem(pickerFor, 'isCustom', true);
    } else {
      setItems(prev => prev.map(it => {
        if (it.id !== pickerFor) return it;
        const updated = { ...it, description: label, unit, isCustom: false };
        updated.total = calcItem(updated);
        return updated;
      }));
    }
    setPickerFor(null);
  };

  const addRow = () => setItems(prev => [...prev, blankItem()]);
  const removeRow = (id) => setItems(prev => prev.length > 1 ? prev.filter(it => it.id !== id) : prev);

  const grandTotal = items.reduce((s, it) => s + calcItem(it), 0);

  const makeRef = () => {
    const prop = (selectedProp?.name || 'PRO').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    const now = new Date();
    return `QT-${prop}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const submit = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a quotation title.');
    if (items.some(it => !it.description.trim())) return Alert.alert('Required', 'Fill in all item descriptions.');
    if (grandTotal <= 0) return Alert.alert('Required', 'Add at least one item with a price.');
    setSaving(true);
    try {
      await addDoc(collection(db, 'quotations'), {
        propertyId: selectedProp?.id || '',
        propertyName: selectedProp?.name || '',
        refNumber: makeRef(),
        title: title.trim(),
        status: 'pending',
        createdByUid: userProfile.uid,
        createdByName: userProfile.name || userProfile.email,
        createdAt: serverTimestamp(),
        items: items.map(({ id, isCustom, ...rest }) => ({ ...rest, total: calcItem(rest) })),
        grandTotal,
        notes: notes.trim(),
      });
      Alert.alert('Submitted', 'Quotation sent for approval.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.safe}>
      <ScreenHeader title="New Quotation" subtitle="Bill of Quantities" showBack onBack={() => navigation.goBack()} />

      <ItemPickerModal
        visible={pickerFor !== null}
        onSelect={handlePickerSelect}
        onClose={() => setPickerFor(null)}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Property */}
          <Text style={styles.label}>PROPERTY</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowPropPicker(v => !v)}>
            <Text style={styles.pickerVal}>{selectedProp?.name || 'Select property'}</Text>
            <MaterialIcons name={showPropPicker ? 'expand-less' : 'expand-more'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
          {showPropPicker && (
            <View style={styles.dropDown}>
              {properties.map(p => (
                <TouchableOpacity key={p.id} style={styles.dropItem} onPress={() => { setPropertyId(p.id); setShowPropPicker(false); }}>
                  <Text style={[styles.dropItemTxt, p.id === propertyId && { color: colors.primaryMid, fontWeight: '700' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Title */}
          <Text style={styles.label}>QUOTATION TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Roof Repair, Block A"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          {/* BoQ rows */}
          <Text style={[styles.label, { marginTop: 18 }]}>BILL OF QUANTITIES</Text>
          <View style={styles.tableCard}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 3 }]}>ITEM</Text>
              <Text style={[styles.th, { flex: 1 }]}>QTY</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>UNIT</Text>
              <Text style={[styles.th, { flex: 2 }]}>SUPPLIER</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>PRICE</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>TOTAL</Text>
              <View style={{ width: 24 }} />
            </View>

            {items.map((item, idx) => (
              <View key={item.id} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: colors.surfaceAlt }]}>

                {/* Description — tap to pick or type if custom */}
                {item.isCustom ? (
                  <TextInput
                    style={[styles.cell, { flex: 3 }]}
                    placeholder="Describe item..."
                    placeholderTextColor={colors.textMuted}
                    value={item.description}
                    onChangeText={v => updateItem(item.id, 'description', v)}
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity
                    style={[styles.cell, { flex: 3, justifyContent: 'center' }]}
                    onPress={() => setPickerFor(item.id)}
                  >
                    {item.description ? (
                      <Text style={{ fontSize: 11, color: colors.text }} numberOfLines={2}>{item.description}</Text>
                    ) : (
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>Tap to select item</Text>
                    )}
                  </TouchableOpacity>
                )}

                <TextInput
                  style={[styles.cell, { flex: 1 }]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={item.qty}
                  onChangeText={v => updateItem(item.id, 'qty', v)}
                />

                {/* Unit tap-to-cycle */}
                <TouchableOpacity
                  style={[styles.cell, { flex: 1.2, justifyContent: 'center' }]}
                  onPress={() => {
                    const i = ALL_UNITS.indexOf(item.unit);
                    updateItem(item.id, 'unit', ALL_UNITS[(i + 1) % ALL_UNITS.length]);
                  }}
                >
                  <Text style={{ fontSize: 10, color: colors.primaryMid, fontWeight: '700' }}>{item.unit}</Text>
                </TouchableOpacity>

                <TextInput
                  style={[styles.cell, { flex: 2 }]}
                  placeholder="Supplier"
                  placeholderTextColor={colors.textMuted}
                  value={item.supplier}
                  onChangeText={v => updateItem(item.id, 'supplier', v)}
                />
                <TextInput
                  style={[styles.cell, { flex: 1.5 }]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={item.unitPrice}
                  onChangeText={v => updateItem(item.id, 'unitPrice', v)}
                />
                <Text style={[styles.cell, { flex: 1.5, fontWeight: '700', color: colors.text }]}>
                  {calcItem(item).toLocaleString()}
                </Text>
                <TouchableOpacity onPress={() => removeRow(item.id)} style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="close" size={16} color={colors.dangerMid} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addRow} onPress={addRow}>
              <MaterialIcons name="add" size={16} color={colors.primaryMid} />
              <Text style={{ fontSize: 12, color: colors.primaryMid, fontWeight: '700' }}>Add Item</Text>
            </TouchableOpacity>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GRAND TOTAL</Text>
              <Text style={styles.totalAmt}>KES {grandTotal.toLocaleString()}</Text>
            </View>
          </View>

          {/* Notes */}
          <Text style={styles.label}>NOTES (optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            placeholder="Additional instructions or context..."
            placeholderTextColor={colors.textMuted}
            multiline
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <><MaterialIcons name="send" size={16} color="#fff" /><Text style={styles.submitTxt}>Submit for Approval</Text></>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
  picker: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerVal: { fontSize: 14, color: colors.text, flex: 1 },
  dropDown: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropItemTxt: { fontSize: 14, color: colors.text },
  tableCard: { ...card, padding: 0, overflow: 'hidden' },
  tableHead: { flexDirection: 'row', backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 8 },
  th: { fontSize: 9, fontWeight: '700', color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  cell: { fontSize: 12, color: colors.text, paddingVertical: 6, paddingHorizontal: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, justifyContent: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F2D57', paddingHorizontal: 14, paddingVertical: 12 },
  totalLabel: { fontSize: 11, fontWeight: '700', color: '#93C5FD', letterSpacing: 0.5 },
  totalAmt: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryMid, borderRadius: 12, paddingVertical: 15, marginTop: 24 },
  submitTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  customLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  customSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.border },
  catIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  catLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  catCount: { fontSize: 11, color: colors.textMuted, marginRight: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 56, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemLabel: { flex: 1, fontSize: 13, color: colors.text },
  unitPill: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  unitPillTxt: { fontSize: 10, fontWeight: '700', color: colors.primaryMid, textTransform: 'uppercase' },
});
