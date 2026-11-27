import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import ComplaintCard from '../../components/ComplaintCard';
import StatCard from '../../components/StatCard';
import FilterBar from '../../components/FilterBar';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, spacing, radius } from '../../theme';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Assigned', value: 'approved' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

export default function ContractorDashboard({ navigation }) {
  const { userProfile, logout } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(
      collection(db, 'complaints'),
      where('contractorId', '==', userProfile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setComplaints(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [userProfile?.uid]);

  const filtered = filter === 'all' ? complaints : complaints.filter(c => c.status === filter);

  const stats = {
    total: complaints.length,
    assigned: complaints.filter(c => c.status === 'approved').length,
    inProgress: complaints.filter(c => c.status === 'in_progress').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
  };

  const handleSignOut = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);

  return (
    <View style={styles.safe}>
      <ScreenHeader
        title={`Hey, ${userProfile?.name?.split(' ')[0] || 'Contractor'}`}
        subtitle="Your assigned jobs"
        rightAction={
          <TouchableOpacity onPress={handleSignOut} style={styles.logoutBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="logout" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        }
      />

      <View style={styles.statsRow}>
        <StatCard label="Total" value={stats.total} color={colors.primaryMid} />
        <View style={{ width: 8 }} />
        <StatCard label="Assigned" value={stats.assigned} color={colors.warning} />
        <View style={{ width: 8 }} />
        <StatCard label="In Progress" value={stats.inProgress} color={colors.amber} />
        <View style={{ width: 8 }} />
        <StatCard label="Resolved" value={stats.resolved} color={colors.success} />
      </View>

      <FilterBar filters={FILTERS} active={filter} onChange={setFilter} />

      {loading ? (
        <ActivityIndicator color={colors.primaryMid} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="build" size={44} color={colors.border} />
          <Text style={styles.emptyTitle}>No assigned jobs</Text>
          <Text style={styles.emptyText}>Jobs assigned to you will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <ComplaintCard
              complaint={item}
              onPress={() => navigation.navigate('ContractorComplaintDetail', { complaintId: item.id })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  logoutBtn: { padding: 8 },
  statsRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: 8 },
  list: { paddingHorizontal: spacing.md, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptyText: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});
