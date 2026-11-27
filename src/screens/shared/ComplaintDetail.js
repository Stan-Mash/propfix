import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Linking, ActivityIndicator, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import CommentThread from '../../components/CommentThread';
import ImageLightbox from '../../components/ImageLightbox';
import { colors, radius, spacing } from '../../theme';

export default function ComplaintDetail({ route, navigation }) {
  const { complaintId } = route.params;
  const [complaint, setComplaint] = useState(null);
  const [lightbox, setLightbox] = useState({ visible: false, index: 0 });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'complaints', complaintId), snap => {
      if (snap.exists()) setComplaint({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [complaintId]);

  if (!complaint) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Complaint Detail" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={colors.primaryMid} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Complaint Detail" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{complaint.title}</Text>
            <StatusBadge status={complaint.status} />
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="location-on" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {complaint.propertyName}{complaint.unitNumber ? ` · Unit ${complaint.unitNumber}` : ''}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="access-time" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{new Date(complaint.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{complaint.description}</Text>
        </View>

        {complaint.photos?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Photos ({complaint.photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {complaint.photos.map((p, i) => {
                const uri = typeof p === 'string' ? p : p?.uri;
                return (
                  <TouchableOpacity key={i} onPress={() => setLightbox({ visible: true, index: i })}>
                    <Image source={{ uri }} style={styles.photo} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {complaint.quotationURL && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quotation</Text>
            {complaint.quotationAmount && (
              <Text style={styles.quotationAmount}>KES {Number(complaint.quotationAmount).toLocaleString()}</Text>
            )}
            {complaint.contractorName && (
              <View style={styles.metaRow}>
                <MaterialIcons name="business" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>{complaint.contractorName}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.viewDocBtn} onPress={() => Linking.openURL(complaint.quotationURL)}>
              <MaterialIcons name="open-in-new" size={16} color={colors.primaryMid} />
              <Text style={styles.viewDocText}>Open Quotation Document</Text>
            </TouchableOpacity>
          </View>
        )}

        {complaint.timeline?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Activity Timeline</Text>
            {[...complaint.timeline].reverse().map((t, i) => (
              <View key={i} style={[styles.timelineItem, i === complaint.timeline.length - 1 && styles.timelineItemLast]}>
                <View style={styles.timelineDotCol}>
                  <View style={[styles.timelineDot, {
                    backgroundColor: t.role === 'landlord' ? colors.purple : t.role === 'manager' ? colors.primaryMid : colors.textMuted,
                  }]} />
                  {i < complaint.timeline.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineAction}>{t.action}</Text>
                  <Text style={styles.timelineMeta}>{t.by} · {t.role} · {new Date(t.at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}</Text>
                  {t.comment && <Text style={styles.timelineComment}>{t.comment}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <CommentThread complaintId={complaintId} />
        </View>
      </ScrollView>

      <ImageLightbox
        photos={complaint.photos || []}
        initialIndex={lightbox.index}
        visible={lightbox.visible}
        onClose={() => setLightbox({ visible: false, index: 0 })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: spacing.md, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  titleRow: { marginBottom: 10, gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { fontSize: 13, color: colors.textSecondary },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  photo: { width: 100, height: 100, borderRadius: radius.sm, marginRight: 8 },
  quotationAmount: { fontSize: 24, fontWeight: '800', color: colors.success, marginBottom: 6 },
  viewDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryXLight, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, alignSelf: 'flex-start' },
  viewDocText: { fontSize: 13, color: colors.primaryMid, fontWeight: '600' },
  timelineItem: { flexDirection: 'row', paddingBottom: 16 },
  timelineItemLast: { paddingBottom: 0 },
  timelineDotCol: { alignItems: 'center', marginRight: 12, width: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  timelineLine: { width: 1.5, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  timelineBody: { flex: 1 },
  timelineAction: { fontSize: 13, fontWeight: '600', color: colors.text },
  timelineMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  timelineComment: { fontSize: 13, color: colors.textSecondary, marginTop: 4, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: 8, fontStyle: 'italic' },
});
