import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, shadow } from '../../theme';

export default function PropertiesScreen({ navigation }) {
  const { userProfile } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(
      collection(db, 'properties'),
      where('landlordId', '==', userProfile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [userProfile?.uid]);

  const confirmDelete = (property) => {
    Alert.alert('Delete Property', `Remove "${property.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'properties', property.id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Properties</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddProperty')}
        >
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primaryMid} style={{ marginTop: 40 }} />
      ) : properties.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="business" size={48} color={colors.border} />
          <Text style={styles.emptyTitle}>No properties yet</Text>
          <Text style={styles.emptyText}>Add your properties so caretakers can link complaints to them.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddProperty')}>
            <Text style={styles.emptyBtnText}>Add First Property</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <MaterialIcons name="business" size={22} color={colors.primaryMid} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.propertyName}>{item.name}</Text>
                {item.address ? <Text style={styles.propertyAddress}>{item.address}</Text> : null}
                {item.units ? <Text style={styles.propertyMeta}>{item.units} unit{item.units !== 1 ? 's' : ''}</Text> : null}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('AddProperty', { property: item })}
                  style={styles.iconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="edit" size={18} color={colors.primaryMid} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  style={styles.iconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="delete" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 16, paddingBottom: 12 },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryMid, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8, ...shadow.sm },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  list: { paddingHorizontal: spacing.md, paddingBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.primaryXLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardBody: { flex: 1 },
  propertyName: { fontSize: 15, fontWeight: '700', color: colors.text },
  propertyAddress: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  propertyMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 12, marginLeft: 8 },
  iconBtn: { padding: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptyText: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 20, backgroundColor: colors.primaryMid, borderRadius: radius.sm, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
