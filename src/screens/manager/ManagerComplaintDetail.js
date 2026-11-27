import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, TextInput, Linking, ActivityIndicator, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, onSnapshot, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { downloadAndShare, shareComplaintSummary } from '../../utils/fileUtils';
import { notifyUserById } from '../../utils/notificationUtils';
import CommentThread from '../../components/CommentThread';
import ImageLightbox from '../../components/ImageLightbox';
import { colors, radius, spacing, shadow } from '../../theme';

export default function ManagerComplaintDetail({ route, navigation }) {
  const { complaintId } = route.params;
  const { userProfile } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState({ visible: false, index: 0 });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [contractors, setContractors] = useState([]);
  const [loadingContractors, setLoadingContractors] = useState(false);

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
          role: 'manager',
          comment: comment.trim() || null,
          at: new Date().toISOString(),
        }),
      });
      setComment('');
      if (complaint?.submittedBy) {
        const statusMsg = newStatus === 'forwarded'
          ? `Your complaint "${complaint.title}" has been forwarded to the landlord for approval.`
          : `Your complaint "${complaint.title}" has been ${newStatus}.`;
        notifyUserById(complaint.submittedBy, 'Complaint Update', statusMsg);
      }
      if (newStatus === 'forwarded' && complaint?.landlordId) {
        notifyUserById(complaint.landlordId, 'Approval Required', `A quotation for "${complaint.title}" is awaiting your approval.`);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const loadAndAssignContractor = async () => {
    setLoadingContractors(true);
    setShowAssignModal(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'contractor')));
      setContractors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setLoadingContractors(false);
    }
  };

  const assignContractor = async (contractor) => {
    setShowAssignModal(false);
    await updateDoc(doc(db, 'complaints', complaintId), {
      contractorId: contractor.uid,
      contractorName: contractor.name,
      updatedAt: new Date().toISOString(),
      timeline: arrayUnion({
        action: `Assigned to contractor: ${contractor.name}`,
        by: userProfile.name,
        role: 'manager',
        at: new Date().toISOString(),
      }),
    });
    notifyUserById(contractor.uid, 'Job Assigned', `You have been assigned to: "${complaint.title}" at ${complaint.propertyName}.`);
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

  const canAct = ['pending', 'under_review'].includes(complaint.status);

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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
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

        {/* Quotation */}
        {complaint.quotationURL ? (
          <View style={[styles.card, styles.quotationCard]}>
            <View style={styles.quotationHeader}>
              <MaterialIcons name="attach-file" size={18} color={colors.primaryMid} />
              <Text style={styles.sectionTitle}>Quotation Attached</Text>
            </View>
            {complaint.quotationAmount && (
              <Text style={styles.quotationAmount}>KES {Number(complaint.quotationAmount).toLocaleString()}</Text>
            )}
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
            <View style={styles.noQuoteRow}>
              <MaterialIcons name="insert-drive-file" size={16} color={colors.textMuted} />
              <Text style={styles.noQuoteText}>No quotation attached to this complaint.</Text>
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
                  <View style={[styles.timelineDot, { backgroundColor: t.role === 'manager' ? colors.primaryMid : colors.border }]} />
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

        {/* Assign contractor */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contractor Assignment</Text>
          {complaint.contractorId ? (
            <View style={styles.assignedRow}>
              <MaterialIcons name="account-circle" size={18} color={colors.success} />
              <Text style={styles.assignedText}>{complaint.contractorName}</Text>
              <TouchableOpacity onPress={loadAndAssignContractor} style={styles.reassignBtn}>
                <Text style={styles.reassignText}>Reassign</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.assignBtn} onPress={loadAndAssignContractor}>
              <MaterialIcons name="person-add" size={16} color={colors.primaryMid} />
              <Text style={styles.assignBtnText}>Assign to Contractor</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <CommentThread complaintId={complaintId} />
        </View>

        {/* Actions */}
        {canAct && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Review Actions</Text>
            <Text style={styles.label}>Note / Comment</Text>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Add a note or instructions for the landlord (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => confirmAction('Reject', 'Reject this complaint and notify the caretaker?', () => updateStatus('rejected', 'Rejected by manager'), true)}
                disabled={submitting}
              >
                <MaterialIcons name="close" size={18} color={colors.danger} />
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.forwardBtn]}
                onPress={() => confirmAction('Forward to Landlord', 'Forward this complaint for landlord approval?', () => updateStatus('forwarded', 'Forwarded to landlord for approval'))}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color={colors.surface} />
                  : <>
                      <MaterialIcons name="arrow-forward" size={18} color={colors.surface} />
                      <Text style={styles.forwardBtnText}>Forward to Landlord</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Assign contractor modal */}
      {showAssignModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Contractor</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <MaterialIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            {loadingContractors ? (
              <ActivityIndicator color={colors.primaryMid} style={{ padding: 24 }} />
            ) : contractors.length === 0 ? (
              <Text style={styles.noContractors}>No contractors registered yet.</Text>
            ) : (
              contractors.map(c => (
                <TouchableOpacity key={c.uid} style={styles.contractorRow} onPress={() => assignContractor(c)}>
                  <View style={styles.contractorAvatar}>
                    <Text style={styles.contractorAvatarText}>{c.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contractorName}>{c.name}</Text>
                    <Text style={styles.contractorEmail}>{c.email}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      )}

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
  quotationCard: { borderColor: colors.primaryLight },
  titleRow: { marginBottom: 10, gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { fontSize: 13, color: colors.textSecondary },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  photosScroll: { marginHorizontal: -4 },
  photo: { width: 100, height: 100, borderRadius: radius.sm, marginHorizontal: 4 },
  quotationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  quotationAmount: { fontSize: 24, fontWeight: '800', color: colors.success, marginBottom: 6 },
  docActions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  viewDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryXLight, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  downloadBtn: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBorder },
  viewDocText: { fontSize: 13, color: colors.primaryMid, fontWeight: '600' },
  headerShareBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primaryXLight, justifyContent: 'center', alignItems: 'center' },
  noQuoteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noQuoteText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
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
  forwardBtn: { backgroundColor: colors.primaryMid, ...shadow.md },
  forwardBtnText: { color: colors.surface, fontWeight: '700', fontSize: 14 },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primaryXLight, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  assignBtnText: { fontSize: 13, color: colors.primaryMid, fontWeight: '600' },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assignedText: { fontSize: 14, color: colors.text, fontWeight: '600', flex: 1 },
  reassignBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.surfaceAlt, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  reassignText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  noContractors: { fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 24, fontStyle: 'italic' },
  contractorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  contractorAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryXLight, justifyContent: 'center', alignItems: 'center' },
  contractorAvatarText: { fontSize: 15, fontWeight: '700', color: colors.primaryMid },
  contractorName: { fontSize: 14, fontWeight: '600', color: colors.text },
  contractorEmail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
