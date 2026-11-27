import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTickets } from '../../context/TicketsContext';
import { usePortfolio } from '../../context/PortfolioContext';
import ScreenHeader from '../../components/ScreenHeader';
import BottomSheet from '../../components/BottomSheet';
import { saveTicketDraft, clearDraft } from '../../utils/offline';
import { logAudit } from '../../utils/auditLog';
import { colors, radius, spacing } from '../../theme';

const CATEGORIES = ['Plumbing', 'Electrical', 'Masonry', 'Carpentry', 'Painting', 'Security', 'Roofing', 'Pest Control', 'Other'];
const PRIORITIES = ['Routine', 'Urgent', 'Emergency'];
const COMMON_AREAS = ['Roof', 'Gate', 'Borehole/Pump', 'Perimeter Wall', 'Staircase', 'Septic/Drainage', 'Water Tank', 'Car Park', 'Compound'];

function SelectField({ label, value, placeholder, onPress, error }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={[s.picker, error && { borderColor: colors.dangerMid }]} onPress={onPress} activeOpacity={0.8}>
        <Text style={[s.pickerTxt, !value && { color: colors.textMuted }]}>{value || placeholder}</Text>
        <MaterialIcons name="expand-more" size={14} color={colors.textMuted} />
      </TouchableOpacity>
      {error && <Text style={s.errorTxt}>{error}</Text>}
    </View>
  );
}

function PickerModal({ visible, title, options, selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent hardwareAccelerated onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{title}</Text>
          {options.map(opt => (
            <TouchableOpacity key={opt} style={s.sheetOpt} onPress={() => { onSelect(opt); onClose(); }}>
              <Text style={[s.sheetOptTxt, opt === selected && s.sheetOptSel]}>{opt}</Text>
              {opt === selected && <MaterialIcons name="check" size={16} color={colors.primaryMid} />}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

export default function LogIssueScreen({ navigation, route }) {
  const { userProfile } = useAuth();
  const { addTicket } = useTickets();
  const { properties, units: allUnits } = usePortfolio();
  const isCaretaker = userProfile?.role === 'caretaker';

  const availableProps = isCaretaker && userProfile?.assignedProperties?.length
    ? properties.filter(p => userProfile.assignedProperties.includes(p.id))
    : properties;

  const presetId = route?.params?.propertyId;
  const [propertyId, setPropertyId] = useState(
    availableProps.some(p => p.id === presetId) ? presetId : availableProps.length === 1 ? availableProps[0].id : ''
  );
  const [mediaSheet, setMediaSheet] = useState(null); // 'image' | 'video'
  const [isCommon, setIsCommon] = useState(false);
  const [unit, setUnit] = useState('');
  const [commonArea, setCommonArea] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Routine');
  const [expenseTag, setExpenseTag] = useState('landlord'); // 'landlord' | 'tenant_deposit'
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [showPropPicker, setShowPropPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);

  const propUnits = propertyId ? (allUnits[propertyId] || []).map(u => u.unit) : [];
  const selectedProp = availableProps.find(p => p.id === propertyId);

  // Auto-save draft as user fills form
  useEffect(() => {
    if (propertyId || description) {
      saveTicketDraft({ propertyId, unit, commonArea, category, priority, expenseTag, description, isCommon, mediaCount: media.length });
    }
  }, [propertyId, unit, commonArea, category, priority, expenseTag, description, isCommon]);

  const validate = () => {
    const e = {};
    if (!propertyId) e.property = 'Select a property';
    if (!isCommon && !unit) e.unit = 'Select a unit or switch to Common Area';
    if (isCommon && !commonArea) e.area = 'Select the common area';
    if (!category) e.category = 'Select a category';
    if (description.trim().length < 10) e.description = 'Describe the issue (min 10 chars)';
    if (media.length === 0) e.photo = 'Add at least one photo or video';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Camera or gallery, chosen from the bottom sheet; the result shows at once as a preview card
  const pickMedia = async (source) => {
    const kind = mediaSheet;
    setMediaSheet(null);
    if (!kind) return;
    const mediaTypes = [kind === 'video' ? 'videos' : 'images'];
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Camera permission needed', 'Allow camera access to take damage photos and videos.'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes, quality: 0.7, videoMaxDuration: 60 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Gallery permission needed', 'Allow gallery access to attach existing photos and videos.'); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes, quality: 0.7, allowsMultipleSelection: false });
      }
      if (!result.canceled && result.assets?.[0]) {
        setMedia(prev => [...prev, { ...result.assets[0], type: kind }]);
        setErrors(e => ({ ...e, photo: undefined }));
      }
    } catch (_) {
      Alert.alert('Could not open ' + (source === 'camera' ? 'the camera' : 'the gallery'));
    }
  };

  const fmtDuration = (ms) => {
    if (!ms) return '';
    const sec = Math.round(ms / 1000);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

  const removeMedia = (i) => setMedia(prev => prev.filter((_, j) => j !== i));

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Missing Information', 'Please complete all required fields including at least one photo or video.');
      return;
    }
    setSubmitting(true);
    const ticketData = {
      propertyId,
      propertyName: selectedProp?.name,
      unit: isCommon ? null : unit,
      areaLabel: isCommon ? commonArea : null,
      category,
      priority,
      expenseTag,
      description,
      media,
      status: 'reported',
      createdAt: new Date().toISOString(),
    };
    await logAudit({
      userId: userProfile?.uid,
      role: userProfile?.role,
      action: 'LOG_TICKET',
      entityId: `ticket_draft_${Date.now()}`,
      data: { propertyId, category, priority },
    });
    addTicket({
      propertyId,
      propertyName: selectedProp?.name,
      unit: isCommon ? '' : unit,
      area: isCommon ? 'common' : 'unit',
      areaLabel: isCommon ? commonArea : undefined,
      category,
      priority,
      description: description.trim(),
      expense: expenseTag === 'tenant_deposit' ? 'tenant' : 'landlord',
      expenseTag,
      createdBy: userProfile?.uid,
      photos: media.map(m => ({ uri: m.uri, type: m.type, duration: fmtDuration(m.duration) })),
    });
    setTimeout(async () => {
      setSubmitting(false);
      Alert.alert('Issue Logged', `Your ${priority.toLowerCase()} ${category} ticket for ${selectedProp?.name} has been submitted.`, [
        { text: 'Done', onPress: () => navigation.goBack() }
      ]);
    }, 800);
  };

  const pri_map = { Routine: { text: colors.textSecondary, bg: colors.surfaceAlt, border: colors.border }, Urgent: { text: colors.warningMid, bg: colors.warningBg, border: colors.warningBorder }, Emergency: { text: colors.dangerMid, bg: colors.dangerBg, border: colors.dangerBorder } };

  return (
    <View style={s.root}>
      <ScreenHeader title="Log Issue" showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <SelectField label="Property *" value={selectedProp?.name} placeholder="Select property" onPress={() => setShowPropPicker(true)} error={errors.property} />

          {/* Area type */}
          <View style={s.field}>
            <Text style={s.label}>Area Type *</Text>
            <View style={s.toggle}>
              <TouchableOpacity style={[s.toggleBtn, !isCommon && s.toggleOn]} onPress={() => { setIsCommon(false); setCommonArea(''); }}>
                <MaterialIcons name="home" size={13} color={!isCommon ? '#fff' : colors.textSecondary} />
                <Text style={[s.toggleTxt, !isCommon && s.toggleTxtOn]}>Specific Unit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.toggleBtn, isCommon && s.toggleOn]} onPress={() => { setIsCommon(true); setUnit(''); }}>
                <MaterialIcons name="business" size={13} color={isCommon ? '#fff' : colors.textSecondary} />
                <Text style={[s.toggleTxt, isCommon && s.toggleTxtOn]}>Common Area</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!isCommon ? (
            <SelectField label="Unit *" value={unit} placeholder="Select unit" onPress={() => propertyId ? setShowUnitPicker(true) : Alert.alert('Select a property first')} error={errors.unit} />
          ) : (
            <SelectField label="Common Area *" value={commonArea} placeholder="Select area" onPress={() => setShowAreaPicker(true)} error={errors.area} />
          )}

          <SelectField label="Category *" value={category} placeholder="Select category" onPress={() => setShowCatPicker(true)} error={errors.category} />

          {/* Priority */}
          <View style={s.field}>
            <Text style={s.label}>Priority *</Text>
            <View style={s.priRow}>
              {PRIORITIES.map(p => {
                const c = pri_map[p]; const active = priority === p;
                return (
                  <TouchableOpacity key={p} style={[s.priBtn, { borderColor: active ? c.border : colors.borderStrong, backgroundColor: active ? c.bg : colors.surface }]} onPress={() => setPriority(p)}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? c.text : colors.textMuted }}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Expense Responsibility / hidden for caretakers, they always log as landlord expense */}
          {!isCaretaker && (
            <View style={s.field}>
              <Text style={s.label}>Expense Responsibility *</Text>
              <View style={s.toggle}>
                <TouchableOpacity style={[s.toggleBtn, expenseTag === 'landlord' && s.toggleOn]} onPress={() => setExpenseTag('landlord')}>
                  <MaterialIcons name="business" size={13} color={expenseTag === 'landlord' ? '#fff' : colors.textSecondary} />
                  <Text style={[s.toggleTxt, expenseTag === 'landlord' && s.toggleTxtOn]}>Landlord Expense</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.toggleBtn, expenseTag === 'tenant_deposit' && { backgroundColor: colors.warningMid, borderColor: colors.warningMid }]} onPress={() => setExpenseTag('tenant_deposit')}>
                  <MaterialIcons name="person-outline" size={13} color={expenseTag === 'tenant_deposit' ? '#fff' : colors.textSecondary} />
                  <Text style={[s.toggleTxt, expenseTag === 'tenant_deposit' && s.toggleTxtOn]}>Deduct from Deposit</Text>
                </TouchableOpacity>
              </View>
              {expenseTag === 'tenant_deposit' && (
                <View style={s.depositNote}>
                  <MaterialIcons name="info" size={13} color={colors.warningMid} />
                  <Text style={s.depositNoteTxt}>Repair cost will be deducted from tenant security deposit on move-out</Text>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          <View style={s.field}>
            <Text style={s.label}>Description * <Text style={{ color: colors.textMuted, fontWeight: '400' }}>(min 10 chars)</Text></Text>
            <TextInput
              style={[s.textarea, errors.description && { borderColor: colors.dangerMid }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue clearly: what is broken, when did it start, how severe..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
            {errors.description && <Text style={s.errorTxt}>{errors.description}</Text>}
            <Text style={s.charCount}>{description.length} chars</Text>
          </View>

          {/* Before Photo / Video */}
          <View style={s.field}>
            <Text style={s.label}>Damage Evidence * <Text style={{ color: colors.textMuted, fontWeight: '400', textTransform: 'none' }}>(min 1 photo or video)</Text></Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <TouchableOpacity style={s.mediaBtn} onPress={() => setMediaSheet('image')} activeOpacity={0.85}>
                <MaterialIcons name="photo-camera" size={22} color="#fff" />
                <Text style={s.mediaBtnTxt}>Add Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.mediaBtn, { backgroundColor: '#7C3AED' }]} onPress={() => setMediaSheet('video')} activeOpacity={0.85}>
                <MaterialIcons name="videocam" size={22} color="#fff" />
                <Text style={s.mediaBtnTxt}>Add Video</Text>
              </TouchableOpacity>
            </View>
            {media.length === 0 ? (
              <View style={s.mediaEmpty}>
                <MaterialIcons name="image" size={22} color={colors.textMuted} />
                <Text style={s.mediaEmptyTxt}>Nothing attached yet. Photos and videos you add will appear here.</Text>
              </View>
            ) : (
              <>
                <Text style={s.mediaCount}>{media.length} attached</Text>
                <View style={s.mediaGrid}>
                  {media.map((m, i) => (
                    <View key={i} style={s.mediaCard}>
                      {m.type === 'video' ? (
                        <View style={s.mediaThumbVideo}>
                          {m.uri ? <Image source={{ uri: m.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                          <MaterialIcons name="play-circle-filled" size={34} color="#fff" />
                        </View>
                      ) : (
                        <Image source={{ uri: m.uri }} style={s.mediaThumb} resizeMode="cover" />
                      )}
                      <View style={s.mediaCaption}>
                        <MaterialIcons name={m.type === 'video' ? 'videocam' : 'photo-camera'} size={13} color={colors.textSecondary} />
                        <Text style={s.mediaCaptionTxt}>{m.type === 'video' ? `Video ${fmtDuration(m.duration)}` : `Photo ${i + 1}`}</Text>
                      </View>
                      <TouchableOpacity style={s.mediaRemove} onPress={() => removeMedia(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialIcons name="close" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            )}
            {errors.photo && <Text style={s.errorTxt}>{errors.photo}</Text>}
          </View>

          <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
            <MaterialIcons name="send" size={16} color="#fff" />
            <Text style={s.submitTxt}>{submitting ? 'Sending...' : 'Report This Repair'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={!!mediaSheet} onClose={() => setMediaSheet(null)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text style={s.mediaSheetTitle}>{mediaSheet === 'video' ? 'Add Video' : 'Add Photo'}</Text>
          <TouchableOpacity style={s.mediaOpt} onPress={() => pickMedia('camera')} activeOpacity={0.8}>
            <View style={[s.mediaOptIcon, { backgroundColor: colors.primaryLight }]}>
              <MaterialIcons name={mediaSheet === 'video' ? 'videocam' : 'photo-camera'} size={24} color={colors.primaryMid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.mediaOptTxt}>{mediaSheet === 'video' ? 'Take Video with Camera' : 'Take Photo with Camera'}</Text>
              <Text style={s.mediaOptSub}>Record the damage now</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={s.mediaOpt} onPress={() => pickMedia('gallery')} activeOpacity={0.8}>
            <View style={[s.mediaOptIcon, { backgroundColor: colors.successBg }]}>
              <MaterialIcons name="photo-library" size={24} color={colors.successMid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.mediaOptTxt}>Choose from Gallery</Text>
              <Text style={s.mediaOptSub}>{mediaSheet === 'video' ? 'Attach a video already on this phone' : 'Attach a photo already on this phone'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <PickerModal visible={showPropPicker} title="Select Property" options={availableProps.map(p => p.name)} selected={selectedProp?.name}
        onSelect={name => { const p = availableProps.find(x => x.name === name); setPropertyId(p?.id || ''); setUnit(''); }}
        onClose={() => setShowPropPicker(false)} />
      <PickerModal visible={showUnitPicker} title="Select Unit" options={propUnits} selected={unit} onSelect={setUnit} onClose={() => setShowUnitPicker(false)} />
      <PickerModal visible={showCatPicker} title="Select Category" options={CATEGORIES} selected={category} onSelect={setCategory} onClose={() => setShowCatPicker(false)} />
      <PickerModal visible={showAreaPicker} title="Select Common Area" options={COMMON_AREAS} selected={commonArea} onSelect={setCommonArea} onClose={() => setShowAreaPicker(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 40 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 },
  pickerTxt: { fontSize: 14, color: colors.text },
  textarea: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: colors.text, minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 10, color: colors.textMuted, textAlign: 'right', marginTop: 4 },
  errorTxt: { fontSize: 11, color: colors.dangerMid, marginTop: 4 },
  toggle: { flexDirection: 'row', borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, overflow: 'hidden' },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: colors.surface },
  toggleOn: { backgroundColor: colors.primaryMid, borderColor: colors.primaryMid },
  toggleTxt: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  toggleTxtOn: { color: '#fff' },
  priRow: { flexDirection: 'row', gap: 8 },
  priBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1.5 },
  depositNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.warningBg, borderRadius: radius.xs, padding: 8, marginTop: 6 },
  depositNoteTxt: { flex: 1, fontSize: 11, color: colors.warningMid },
  submitBtn: { backgroundColor: colors.primaryMid, borderRadius: radius.sm, paddingVertical: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  submitTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  mediaBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16A34A', borderRadius: radius.sm, paddingVertical: 14, minHeight: 52 },
  mediaBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  mediaEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderStyle: 'dashed', borderRadius: 8, padding: 14 },
  mediaEmptyTxt: { flex: 1, fontSize: 13, color: colors.textSecondary },
  mediaCount: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaCard: { width: 104, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: 8, overflow: 'hidden', elevation: 2 },
  mediaThumb: { width: '100%', height: 96 },
  mediaThumbVideo: { width: '100%', height: 96, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  mediaCaption: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 5 },
  mediaCaptionTxt: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  mediaRemove: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.85)', justifyContent: 'center', alignItems: 'center' },
  mediaSheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 8 },
  mediaOpt: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, borderTopWidth: 1, borderTopColor: colors.border },
  mediaOptIcon: { width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  mediaOptTxt: { fontSize: 15, fontWeight: '700', color: colors.text },
  mediaOptSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: 32 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginVertical: 10 },
  sheetTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, paddingHorizontal: spacing.md, paddingBottom: 8 },
  sheetOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.border },
  sheetOptTxt: { fontSize: 14, color: colors.text },
  sheetOptSel: { color: colors.primaryMid, fontWeight: '700' },
});
