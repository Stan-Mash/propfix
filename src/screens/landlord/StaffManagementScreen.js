import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Modal, ActivityIndicator, FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { usePortfolio } from '../../context/PortfolioContext';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, radius, spacing } from '../../theme';

const ROLE_LABELS = { manager: 'Manager', caretaker: 'Caretaker', landlord: 'Landlord' };
const ROLE_COLORS = {
  manager:   { bg: '#E1F5EE', text: '#085041' },
  caretaker: { bg: '#FAEEDA', text: '#633806' },
  landlord:  { bg: '#EEEDFE', text: '#3C3489' },
};

export default function StaffManagementScreen({ navigation }) {
  const { properties } = usePortfolio();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState(null); // { uid, name }
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(all);
    } catch (e) {
      Alert.alert('Error', 'Could not load staff list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (uid, currentActive) => {
    const nextActive = !currentActive;
    if (!nextActive) {
      Alert.alert(
        'Deactivate Account',
        'This person will no longer be able to log in. You can reactivate at any time.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Deactivate', style: 'destructive', onPress: () => doUpdate(uid, { active: false }) },
        ]
      );
    } else {
      if (properties.length) {
        setAssignModal({ uid, name: users.find(u => u.uid === uid)?.name || '' });
      } else {
        doUpdate(uid, { active: true });
      }
    }
  };

  const doUpdate = async (uid, patch) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), patch);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...patch } : u));
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const activateWithProperty = async (propertyId) => {
    if (!assignModal) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', assignModal.uid), { active: true, propertyId });
      setUsers(prev => prev.map(u => u.uid === assignModal.uid ? { ...u, active: true, propertyId } : u));
      setAssignModal(null);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const pending = users.filter(u => u.active === false && u.role !== 'landlord');
  const active  = users.filter(u => u.active !== false && u.role !== 'landlord');
  const landlords = users.filter(u => u.role === 'landlord');

  const renderUser = (u, showActions = true) => {
    const rc = ROLE_COLORS[u.role] || ROLE_COLORS.caretaker;
    const propName = u.propertyId ? (properties.find(p => p.id === u.propertyId)?.name || u.propertyId) : null;
    const isActive = u.active !== false;
    const isMe = u.uid === currentUser?.uid;
    const isOwner = u.role === 'landlord';
    const content = (
      <>
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>{(u.name || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{u.name}</Text>
            {isOwner ? (
              <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS.landlord.bg }]}>
                <Text style={[styles.roleText, { color: ROLE_COLORS.landlord.text }]}>Owner · Full access</Text>
              </View>
            ) : (
              <View style={[styles.roleBadge, { backgroundColor: rc.bg }]}>
                <Text style={[styles.roleText, { color: rc.text }]}>{ROLE_LABELS[u.role] || u.role}</Text>
              </View>
            )}
            {isMe && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{u.email}</Text>
          {isOwner ? null : propName ? (
            <Text style={styles.propLabel}>{propName}</Text>
          ) : (
            <Text style={[styles.propLabel, { color: colors.warningMid }]}>No property assigned</Text>
          )}
        </View>
        {showActions && !isMe && (
          <TouchableOpacity
            style={[styles.actionBtn, isActive ? styles.actionDeactivate : styles.actionActivate]}
            onPress={() => toggleActive(u.uid, isActive)}
            disabled={saving}
          >
            <MaterialIcons
              name={isActive ? 'block' : 'check-circle'}
              size={18}
              color={isActive ? colors.dangerMid : colors.successMid}
            />
          </TouchableOpacity>
        )}
      </>
    );
    return showActions && !isOwner && !isMe ? (
      <TouchableOpacity key={u.id} style={styles.userCard} activeOpacity={0.75}
        onPress={() => setAssignModal({ uid: u.uid, name: u.name || '' })}>
        {content}
      </TouchableOpacity>
    ) : (
      <View key={u.id} style={styles.userCard}>{content}</View>
    );
  };

  return (
    <View style={styles.wrap}>
      <ScreenHeader
        title="Staff Accounts"
        subtitle={`${active.length} active · ${pending.length} pending`}
        showBack
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={fetchUsers} style={styles.hdrIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="refresh" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.inviteBtn} onPress={() => navigation.navigate('Register')}>
              <MaterialIcons name="person-add" size={14} color="#fff" />
              <Text style={styles.inviteBtnTxt}>Invite</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.primaryMid} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Pending */}
          {pending.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.pendingDot} />
                <Text style={styles.sectionTitle}>Pending approval ({pending.length})</Text>
              </View>
              <View style={styles.sectionNote}>
                <MaterialIcons name="info-outline" size={14} color={colors.warningMid} />
                <Text style={styles.sectionNoteText}>Tap the check icon to activate an account. You can assign a property at the same time.</Text>
              </View>
              {pending.map(u => renderUser(u, true))}
            </View>
          )}

          {/* Active */}
          {active.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.pendingDot, { backgroundColor: colors.successMid }]} />
                <Text style={styles.sectionTitle}>Active staff ({active.length})</Text>
              </View>
              {active.map(u => renderUser(u, true))}
            </View>
          )}

          {/* Landlords (read-only) */}
          {landlords.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.pendingDot, { backgroundColor: colors.purpleMid }]} />
                <Text style={styles.sectionTitle}>Owners / Landlords</Text>
              </View>
              {landlords.map(u => renderUser(u, false))}
            </View>
          )}

          {pending.length === 0 && active.length === 0 && (
            <View style={styles.empty}>
              <MaterialIcons name="group-off" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No staff accounts yet.</Text>
              <Text style={styles.emptySub}>Staff members register through the app and their accounts appear here for your approval.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Property assignment modal */}
      <Modal visible={!!assignModal} transparent animationType="slide" onRequestClose={() => setAssignModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Assign a property</Text>
            <Text style={styles.modalSub}>Select the property where {assignModal?.name} will work:</Text>

            {properties.length === 0 ? (
              <View style={styles.noProps}>
                <MaterialIcons name="apartment" size={32} color={colors.textMuted} />
                <Text style={styles.noPropsText}>No properties added yet.</Text>
                <Text style={styles.noPropsSub}>Add a property in the Portfolio tab first, then come back to activate this account.</Text>
              </View>
            ) : (
              <FlatList
                data={properties}
                keyExtractor={p => p.id}
                style={{ maxHeight: 260 }}
                renderItem={({ item: p }) => (
                  <TouchableOpacity
                    style={styles.propOption}
                    onPress={() => activateWithProperty(p.id)}
                    disabled={saving}
                  >
                    <MaterialIcons name="apartment" size={20} color={colors.primaryMid} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.propOptionName}>{p.name}</Text>
                      {p.location ? <Text style={styles.propOptionLoc}>{p.location}</Text> : null}
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setAssignModal(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  hdrIconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryMid, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  inviteBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1, padding: spacing.md },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warningMid },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.warningBg, borderRadius: radius.sm, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.warningBorder },
  sectionNoteText: { flex: 1, fontSize: 12, color: colors.warning, lineHeight: 17 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border, gap: 12 },
  userAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryXLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primaryMid },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  userName: { fontSize: 14, fontWeight: '600', color: colors.text },
  roleBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  roleText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  youBadge: { backgroundColor: colors.successBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  youBadgeText: { fontSize: 10, fontWeight: '700', color: colors.successMid },
  userEmail: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  propLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  actionBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  actionDeactivate: { backgroundColor: colors.dangerBg },
  actionActivate: { backgroundColor: colors.successBg },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.md, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  noProps: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noPropsText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  noPropsSub: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  propOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  propOptionName: { fontSize: 14, fontWeight: '600', color: colors.text },
  propOptionLoc: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  modalCancel: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
});
