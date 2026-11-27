import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, Linking, ActivityIndicator, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import CommentThread from '../../components/CommentThread';
import ImageLightbox from '../../components/ImageLightbox';
import { compressImage } from '../../utils/imageUtils';
import { colors, radius, spacing, shadow } from '../../theme';

export default function ContractorComplaintDetail({ route, navigation }) {
  const { complaintId } = route.params;
  const { userProfile } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState({ visible: false, index: 0 });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'complaints', complaintId), snap => {
      if (snap.exists()) setComplaint({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [complaintId]);

  const markInProgress = () => {
    Alert.alert('Start Job', 'Mark this complaint as in progress?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start', onPress: async () => {
          await updateDoc(doc(db, 'complaints', complaintId), {
            status: 'in_progress',
            updatedAt: new Date().toISOString(),
            timeline: arrayUnion({
              action: 'Work started by contractor',
              by: userProfile.name,
              role: 'contractor',
              at: new Date().toISOString(),
            }),
          });
        },
      },
    ]);
  };

  const uploadCompletionPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const newUrls = [];
      for (let i = 0; i < result.assets.length; i++) {
        const compressed = await compressImage(result.assets[i].uri);
        const response = await fetch(compressed);
        const blob = await response.blob();
        const storageRef = ref(storage, `completion/${complaintId}/${Date.now()}_${i}.jpg`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        newUrls.push(url);
      }
      const existing = complaint.completionPhotos || [];
      await updateDoc(doc(db, 'complaints', complaintId), {
        completionPhotos: [...existing, ...newUrls],
        updatedAt: new Date().toISOString(),
        timeline: arrayUnion({
          action: `${newUrls.length} completion photo${newUrls.length > 1 ? 's' : ''} uploaded`,
          by: userProfile.name,
          role: 'contractor',
          at: new Date().toISOString(),
        }),
      });
      Alert.alert('Uploaded', 'Completion photos uploaded successfully.');
    } catch (e) {
      Alert.alert('Upload Failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  if (!complaint) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Job Detail" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={colors.primaryMid} /></View>
      </SafeAreaView>
    );
  }

  const allPhotos = [...(complaint.photos || []), ...(complaint.completionPhotos || [])];

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Job Detail" onBack={() => navigation.goBack()} />

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
          <Text style={styles.sectionTitle}>Job Description</Text>
          <Text style={styles.description}>{complaint.description}</Text>
        </View>

        {allPhotos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Photos ({allPhotos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {allPhotos.map((p, i) => {
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
            <TouchableOpacity style={styles.viewDocBtn} onPress={() => Linking.openURL(complaint.quotationURL)}>
              <MaterialIcons name="open-in-new" size={16} color={colors.primaryMid} />
              <Text style={styles.viewDocText}>Open Quotation Document</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        {complaint.status === 'approved' && (
          <TouchableOpacity style={[styles.actionBtn, styles.startBtn]} onPress={markInProgress}>
            <MaterialIcons name="build" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Start Work</Text>
          </TouchableOpacity>
        )}

        {complaint.status === 'in_progress' && (
          <TouchableOpacity style={[styles.actionBtn, styles.photoBtn]} onPress={uploadCompletionPhotos} disabled={uploading}>
            {uploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <MaterialIcons name="camera" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Upload Completion Photos</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {/* Timeline */}
        {complaint.timeline?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Activity Timeline</Text>
            {[...complaint.timeline].reverse().map((t, i) => (
              <View key={i} style={[styles.timelineItem, i === complaint.timeline.length - 1 && styles.timelineItemLast]}>
                <View style={styles.timelineDotCol}>
                  <View style={[styles.timelineDot, {
                    backgroundColor: t.role === 'landlord' ? colors.purple : t.role === 'manager' ? colors.primaryMid : t.role === 'contractor' ? colors.amber : colors.textMuted,
                  }]} />
                  {i < complaint.timeline.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineAction}>{t.action}</Text>
                  <Text style={styles.timelineMeta}>{t.by} · {t.role} · {new Date(t.at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}</Text>
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
        photos={allPhotos}
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
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingVertical: 14, marginBottom: 10, ...shadow.md },
  startBtn: { backgroundColor: colors.amber },
  photoBtn: { backgroundColor: colors.success },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  timelineItem: { flexDirection: 'row', paddingBottom: 16 },
  timelineItemLast: { paddingBottom: 0 },
  timelineDotCol: { alignItems: 'center', marginRight: 12, width: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  timelineLine: { width: 1.5, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  timelineBody: { flex: 1 },
  timelineAction: { fontSize: 13, fontWeight: '600', color: colors.text },
  timelineMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
