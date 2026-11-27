import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { db } from '../../firebase';
import ComplaintCard from '../../components/ComplaintCard';
import FilterBar from '../../components/FilterBar';
import { exportComplaintsReport } from '../../utils/fileUtils';
import { colors, spacing, radius } from '../../theme';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Awaiting Approval', value: 'forwarded' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

export default function LandlordAllComplaints({ navigation }) {
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setComplaints(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const statusFiltered = filter === 'all' ? complaints : complaints.filter(c => c.status === filter);
  const filtered = search.trim()
    ? statusFiltered.filter(c =>
        c.title?.toLowerCase().includes(search.toLowerCase()) ||
        c.propertyName?.toLowerCase().includes(search.toLowerCase()) ||
        c.contractorName?.toLowerCase().includes(search.toLowerCase()) ||
        c.submittedByName?.toLowerCase().includes(search.toLowerCase())
      )
    : statusFiltered;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>All Reports</Text>
          <Text style={styles.count}>{complaints.length} total</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={() => exportComplaintsReport(filtered, 'All_Complaints')}>
          <MaterialIcons name="file-download" size={16} color={colors.primaryMid} />
          <Text style={styles.exportBtnText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by title, property, contractor..."
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
          <Text style={styles.emptyText}>No complaints match the selected filter.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <ComplaintCard
              complaint={item}
              onPress={() => navigation.navigate('LandlordComplaintDetail', { complaintId: item.id })}
            />
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
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryXLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  exportBtnText: { fontSize: 13, color: colors.primaryMid, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: 4, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: 10, height: 40 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  list: { paddingHorizontal: spacing.md, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptyText: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});
