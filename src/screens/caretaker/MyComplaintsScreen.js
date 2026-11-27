import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView, ActivityIndicator,
  TouchableOpacity, TextInput,
} from 'react-native';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import ComplaintCard from '../../components/ComplaintCard';
import FilterBar from '../../components/FilterBar';
import { colors, spacing, radius } from '../../theme';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Awaiting Approval', value: 'forwarded' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Resolved', value: 'resolved' },
];

export default function MyComplaintsScreen({ navigation }) {
  const { userProfile } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(
      collection(db, 'complaints'),
      where('submittedBy', '==', userProfile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setComplaints(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [userProfile?.uid]);

  const statusFiltered = filter === 'all' ? complaints : complaints.filter(c => c.status === filter);
  const filtered = search.trim()
    ? statusFiltered.filter(c =>
        c.title?.toLowerCase().includes(search.toLowerCase()) ||
        c.propertyName?.toLowerCase().includes(search.toLowerCase())
      )
    : statusFiltered;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Reports</Text>
        <Text style={styles.count}>{complaints.length} total</Text>
      </View>

      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by title or property..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="cancel" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FilterBar filters={FILTERS} active={filter} onChange={setFilter} />

      {loading ? (
        <ActivityIndicator color={colors.primaryMid} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="insert-drive-file" size={40} color={colors.border} />
          <Text style={styles.emptyTitle}>No reports found</Text>
          <Text style={styles.emptyText}>
            {search.trim() ? 'No results for your search.' : filter === 'all' ? 'You have not filed any complaints yet.' : `No complaints with status "${FILTERS.find(f => f.value === filter)?.label}".`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <View style={{ flex: 1 }}>
                <ComplaintCard
                  complaint={item}
                  onPress={() => navigation.navigate('ComplaintDetail', { complaintId: item.id })}
                />
              </View>
              {item.status === 'pending' && (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => navigation.navigate('EditComplaint', { complaint: item })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="edit" size={16} color={colors.primaryMid} />
                </TouchableOpacity>
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 16, paddingBottom: 4 },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  count: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginTop: 8, marginBottom: 4, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: 10, height: 40 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  cardWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md },
  editBtn: { padding: 8, backgroundColor: colors.primaryXLight, borderRadius: 8, borderWidth: 1, borderColor: colors.primaryLight },
  list: { paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptyText: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});
