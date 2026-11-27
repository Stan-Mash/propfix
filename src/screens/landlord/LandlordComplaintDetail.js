import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, TextInput, Linking, ActivityIndicator, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { downloadAndShare, shareComplaintSummary } from '../../utils/fileUtils';
import { notifyUserById } from '../../utils/notificationUtils';
import CommentThread from '../../components/CommentThread';
import ImageLightbox from '../../components/ImageLightbox';
import { colors, radius, spacing, shadow } from '../../theme';

export default function LandlordComplaintDetail({ route, navigation }) {
  const { complaintId } = route.params;
  const { userProfile } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState({ visible: false, index: 0 });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'complaints', complaintId), snap => {
      if (snap.exists()) setComplaint({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [complaintId]);

  const updateStatus = async (newStatus, actionLabel) => {
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'complaints', complaintId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        timeline: arrayUnion({
          action: actionLabel,
          by: userProfile.name,
          role: 'landlord',
          comment: comment.trim() || null,
          at: new Date().toISOString(),
        }),
      });
      setComment('');
      if (complaint?.submittedBy) {
        const msg = newStatus === 'approved'
          ? `Your quotation for "${complaint.title}" has been approved by the landlord.`
          : newStatus === 'rejected'
          ? `Your quotation for "${complaint.title}" was rejected.`
          : `"${complaint.title}" has been marked as resolved.`;
        notifyUserById(complaint.submittedBy, 'Complaint Update', msg);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmAction = (title, message, onConfirm, destructive = false) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: title, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  };

  if (!complaint) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Complaint Detail" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={colors.primaryMid} /></View>
      </SafeAreaView>
    );
  }

  const canApprove = complaint.status === 'forwarded';
  const canResolve = ['approved', 'in_progress'].includes(complaint.status);

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Complaint Detail"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={() => shareComplaintSummary(complaint)} style={styles.headerShareBtn}>
            <MaterialIcons name="share" size={20} color={colors.primaryMid} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Overview */}
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
            <MaterialIcons name="person-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>Filed by {complaint.submittedByName}</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="access-time" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{new Date(complaint.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{complaint.description}</Text>
        </View>

        {/* Photos */}
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

        {/* Quotation / the critical section for landlord */}
        {complaint.quotationURL ? (
          <View style={[styles.card, styles.quotationCard]}>
            <View style={styles.quotationHeaderRow}>
              <MaterialIcons name="attach-file" size={18} color={colors.primaryMid} />
              <Text style={styles.sectionTitle}>Quotation for Approval</Text>
            </View>
            {complaint.quotationAmount ? (
              <View style={styles.amountBlock}>
                <Text style={styles.amountLabel}>Amount Requested</Text>
                <Text style={styles.amountValue}>KES {Number(complaint.quotationAmount).toLocaleString()}</Text>
              </View>
            ) : null}
            {complaint.contractorName && (
              <View style={styles.metaRow}>
                <MaterialIcons name="business" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>{complaint.contractorName}</Text>
              </View>
            )}
            <View style={styles.docActions}>
              <TouchableOpacity style={styles.viewDocBtn} onPress={() => Linking.openURL(complaint.quotationURL)}>
                <MaterialIcons name="open-in-new" size={15} color={colors.primaryMid} />
                <Text style={styles.viewDocText}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.viewDocBtn, styles.downloadBtn]} onPress={() => downloadAndShare(complaint.quotationURL, complaint.quotationFileName || 'quotation.pdf')}>
                <MaterialIcons name="file-download" size={15} color={colors.success} />
                <Text style={[styles.viewDocText, { color: colors.success }]}>Download / Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <MaterialIcons name="insert-drive-file" size={14} color={colors.textMuted} />
              <Text style={styles.noDocText}>No quotation has been attached yet.</Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        {complaint.timeline?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Activity Timeline</Text>
            {[...complaint.timeline].reverse().map((t, i) => (
              <View key={i} style={[styles.timelineItem, i === complaint.timeline.length - 1 && styles.timelineItemLast]}>
                <View style={styles.timelineDotCol}>
                  <View style={[styles.timelineDot, { backgroundColor: t.role === 'landlord' ? colors.purple : t.role === 'manager' ? colors.primaryMid : colors.border }]} />
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

        {/* Approval / Resolution Actions */}
        {(canApprove || canResolve) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{canApprove ? 'Approve or Reject Quotation' : 'Mark Repair as Resolved'}</Text>
            <Text style={styles.label}>Decision Note</Text>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Add a note or reason (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
            {canApprove && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => confirmAction('Reject Quotation', `Reject this quotation${complaint.quotationAmount ? ` of KES ${Number(complaint.quotationAmount).toLocaleString()}` : ''}?`, () => updateStatus('rejected', 'Quotation rejected by landlord'), true)}
                  disabled={submitting}
                >
                  <MaterialIcons name="close" size={18} color={colors.danger} />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => confirmAction('Approve Quotation', `Approve this quotation${complaint.quotationAmount ? ` of KES ${Number(complaint.quotationAmount).toLocaleString()}` : ''}?`, () => updateStatus('approved', 'Quotation approved by landlord'))}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color={colors.surface} />
                    : <>
                        <MaterialIcons name="check" size={18} color={colors.surface} />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            )}
            {canResolve && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.resolveBtn]}
                onPress={() => confirmAction('Mark as Resolved', 'Confirm that this repair has been completed?', () => updateStatus('resolved', 'Repair marked as resolved by landlord'))}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color={colors.surface} />
                  : <>
                      <MaterialIcons name="done-all" size={18} color={colors.surface} />
                      <Text style={styles.resolveBtnText}>Mark as Resolved</Text>
                    </>
                }
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <ImageLightbox
        photos={complaint?.photos || []}
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
  quotationCard: { borderColor: colors.primaryLight, borderWidth: 1.5 },
  titleRow: { marginBottom: 10, gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { fontSize: 13, color: colors.textSecondary },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  photo: { width: 100, height: 100, borderRadius: radius.sm, marginRight: 8 },
  quotationHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  amountBlock: { backgroundColor: colors.successBg, borderRadius: radius.sm, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.successBorder },
  amountLabel: { fontSize: 11, color: colors.success, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  amountValue: { fontSize: 28, fontWeight: '800', color: colors.success, marginTop: 2 },
  docActions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  viewDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryXLight, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  downloadBtn: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBorder },
  viewDocText: { fontSize: 13, color: colors.primaryMid, fontWeight: '600' },
  headerShareBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primaryXLight, justifyContent: 'center', alignItems: 'center' },
  noDocText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  timelineItem: { flexDirection: 'row', paddingBottom: 16 },
  timelineItemLast: { paddingBottom: 0 },
  timelineDotCol: { alignItems: 'center', marginRight: 12, width: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  timelineLine: { width: 1.5, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  timelineBody: { flex: 1 },
  timelineAction: { fontSize: 13, fontWeight: '600', color: colors.text },
  timelineMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  timelineComment: { fontSize: 13, color: colors.textSecondary, marginTop: 4, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: 8, fontStyle: 'italic' },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  commentInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, padding: 12, fontSize: 14, color: colors.text, height: 80, textAlignVertical: 'top', backgroundColor: colors.surfaceAlt, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: radius.md },
  rejectBtn: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder },
  rejectBtnText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  approveBtn: { backgroundColor: colors.success, ...shadow.md },
  approveBtnText: { color: colors.surface, fontWeight: '700', fontSize: 14 },
  resolveBtn: { backgroundColor: colors.purple, ...shadow.md },
  resolveBtnText: { color: colors.surface, fontWeight: '700', fontSize: 14 },
});
