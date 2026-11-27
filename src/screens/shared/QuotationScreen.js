import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, card } from '../../theme';

const STATUS_COLOR = {
  pending:  { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  approved: { bg: '#D1FAE5', text: '#065F46', dot: '#16A34A' },
  rejected: { bg: '#FEE2E2', text: '#991B1B', dot: '#DC2626' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.pending;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.dot }} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.text, textTransform: 'capitalize' }}>{status}</Text>
    </View>
  );
}

function QuotCard({ item, onPress }) {
  const date = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt || Date.now());
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <Text style={styles.ref}>{item.refNumber}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.property} numberOfLines={1}>{item.propertyName}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <Text style={styles.date}>{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
        <Text style={styles.total}>KES {(item.grandTotal || 0).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function QuotationScreen({ navigation }) {
  const { userProfile } = useAuth();
  const { properties } = usePortfolio();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');

  const role = userProfile?.role || 'landlord';
  const isCaretaker = role === 'caretaker';
  const canCreate = role === 'caretaker' || role === 'manager';

  useEffect(() => {
    let q;
    if (isCaretaker) {
      q = query(collection(db, 'quotations'), where('createdByUid', '==', userProfile.uid), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));
    }
    const unsub = onSnapshot(q, snap => {
      setQuotations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [userProfile?.uid]);

  const filtered = quotations.filter(q => {
    if (!isCaretaker && q.status !== tab) return false;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      return (q.title || '').toLowerCase().includes(s) ||
             (q.refNumber || '').toLowerCase().includes(s) ||
             (q.propertyName || '').toLowerCase().includes(s);
    }
    return true;
  });

  const counts = {
    pending:  quotations.filter(q => q.status === 'pending').length,
    approved: quotations.filter(q => q.status === 'approved').length,
    rejected: quotations.filter(q => q.status === 'rejected').length,
  };

  return (
    <View style={styles.safe}>
      <ScreenHeader
        title="Quotations"
        subtitle={isCaretaker ? 'Your submitted quotes' : 'Approval queue'}
        rightAction={canCreate ? (
          <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('QuotationCreate')}>
            <MaterialIcons name="add" size={15} color="#fff" />
            <Text style={styles.newBtnTxt}>New</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Search bar */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by title, ref or property..."
          placeholderTextColor={colors.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!isCaretaker && (
        <View style={styles.segControl}>
          {['pending', 'approved', 'rejected'].map(t => (
            <TouchableOpacity key={t} style={[styles.segBtn, tab === t && styles.segBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.segTxt, tab === t && styles.segTxtActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {counts[t] > 0 ? (
                  <Text style={[styles.segCount, tab === t && styles.segCountActive]}> {counts[t]}</Text>
                ) : null}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primaryMid} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="description" size={48} color={colors.borderStrong} />
          <Text style={styles.emptyTxt}>No {tab} quotations</Text>
          {canCreate && <Text style={styles.emptyHint}>Tap "New" to create one</Text>}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <QuotCard item={item} onPress={() => navigation.navigate('QuotationDetail', { quotationId: item.id })} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  segControl: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 20, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  segBtnActive: { backgroundColor: colors.primaryMid, borderColor: colors.primaryMid },
  segTxt: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  segTxtActive: { color: '#fff' },
  segCount: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
  segCountActive: { color: 'rgba(255,255,255,0.85)' },
  card: { ...card, padding: 14 },
  ref: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  property: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  date: { fontSize: 11, color: colors.textMuted },
  total: { fontSize: 15, fontWeight: '800', color: colors.primaryMid },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTxt: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  emptyHint: { fontSize: 12, color: colors.textMuted },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryMid, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  newBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
