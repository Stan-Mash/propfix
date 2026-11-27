import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, SafeAreaView, ActivityIndicator, Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import { compressImage } from '../../utils/imageUtils';
import { colors, radius, spacing, shadow } from '../../theme';

const CATEGORIES = [
  { label: 'Water Leakage', value: 'leakage' },
  { label: 'Electrical Issue', value: 'electrical' },
  { label: 'Structural Damage', value: 'structural' },
  { label: 'Plumbing', value: 'plumbing' },
  { label: 'Painting / Finishing', value: 'painting' },
  { label: 'Security', value: 'security' },
  { label: 'Cleaning', value: 'cleaning' },
  { label: 'Other', value: 'other' },
];

export default function EditComplaintScreen({ route, navigation }) {
  const { complaint } = route.params;
  const { userProfile } = useAuth();

  const [title, setTitle] = useState(complaint.title || '');
  const [description, setDescription] = useState(complaint.description || '');
  const [category, setCategory] = useState(complaint.category || 'leakage');
  const [propertyName, setPropertyName] = useState(complaint.propertyName || '');
  const [unitNumber, setUnitNumber] = useState(complaint.unitNumber || '');
  const [photos, setPhotos] = useState(complaint.photos?.map(uri => ({ uri, existing: true })) || []);
  const [quotationFile, setQuotationFile] = useState(null);
  const [quotationAmount, setQuotationAmount] = useState(complaint.quotationAmount ? String(complaint.quotationAmount) : '');
  const [contractorName, setContractorName] = useState(complaint.contractorName || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!propertyName.trim()) e.propertyName = 'Property name is required';
    if (!description.trim()) e.description = 'Description is required';
    if (quotationAmount && isNaN(Number(quotationAmount))) e.quotationAmount = 'Enter a valid amount';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const toAdd = result.assets.slice(0, 4 - photos.length);
      setPhotos(prev => [...prev, ...toAdd.map(a => ({ uri: a.uri, existing: false }))]);
    }
  };

  const removePhoto = i => setPhotos(prev => prev.filter((_, idx) => idx !== i));

  const pickQuotation = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) setQuotationFile(result.assets[0]);
  };

  const uploadFile = async (uri, path) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const ts = Date.now();
      const uid = userProfile.uid;

      const photoURLs = [];
      for (let i = 0; i < photos.length; i++) {
        if (photos[i].existing) {
          photoURLs.push(photos[i].uri);
        } else {
          const compressed = await compressImage(photos[i].uri);
          const url = await uploadFile(compressed, `complaints/${uid}/${ts}_photo_${i}.jpg`);
          photoURLs.push(url);
        }
      }

      let quotationURL = complaint.quotationURL;
      let quotationFileName = complaint.quotationFileName;
      if (quotationFile) {
        quotationURL = await uploadFile(quotationFile.uri, `quotations/${uid}/${ts}_${quotationFile.name}`);
        quotationFileName = quotationFile.name;
      }

      await updateDoc(doc(db, 'complaints', complaint.id), {
        title: title.trim(),
        description: description.trim(),
        category,
        propertyName: propertyName.trim(),
        unitNumber: unitNumber.trim() || null,
        photos: photoURLs,
        quotationURL,
        quotationFileName,
        quotationAmount: quotationAmount ? parseFloat(quotationAmount) : null,
        contractorName: contractorName.trim() || null,
        updatedAt: new Date().toISOString(),
      });

      Alert.alert('Saved', 'Complaint updated successfully.', [{ text: 'Done', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Edit Complaint" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Complaint Details</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              value={title}
              onChangeText={t => { setTitle(t); setErrors(p => ({ ...p, title: null })); }}
              placeholder="e.g. Water pipe leaking in bathroom"
              placeholderTextColor={colors.textMuted}
            />
            {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker}>
                {CATEGORIES.map(c => <Picker.Item key={c.value} label={c.label} value={c.value} color={colors.text} />)}
              </Picker>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 2, marginRight: 8 }]}>
              <Text style={styles.label}>Property Name *</Text>
              <TextInput
                style={[styles.input, errors.propertyName && styles.inputError]}
                value={propertyName}
                onChangeText={t => { setPropertyName(t); setErrors(p => ({ ...p, propertyName: null })); }}
                placeholder="e.g. Sunrise Apartments"
                placeholderTextColor={colors.textMuted}
              />
              {errors.propertyName ? <Text style={styles.errorText}>{errors.propertyName}</Text> : null}
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Unit No.</Text>
              <TextInput
                style={styles.input}
                value={unitNumber}
                onChangeText={setUnitNumber}
                placeholder="B12"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.textarea, errors.description && styles.inputError]}
              value={description}
              onChangeText={t => { setDescription(t); setErrors(p => ({ ...p, description: null })); }}
              placeholder="Describe the issue"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
            />
            {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Photos <Text style={styles.optional}>(max 4)</Text></Text>
          <View style={styles.photosGrid}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoItem}>
                <Image source={{ uri: p.uri }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(i)}>
                  <MaterialIcons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 4 && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhotos}>
                <MaterialIcons name="camera-alt" size={22} color={colors.primaryMid} />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quotation <Text style={styles.optional}>(optional)</Text></Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickQuotation}>
            <MaterialIcons name={quotationFile ? 'document-attach' : complaint.quotationURL ? 'document-attach' : 'cloud-upload-outline'} size={20} color={quotationFile || complaint.quotationURL ? colors.success : colors.primaryMid} />
            <Text style={[styles.uploadBtnText, (quotationFile || complaint.quotationURL) && { color: colors.success }]}>
              {quotationFile ? quotationFile.name : complaint.quotationURL ? complaint.quotationFileName || 'Quotation attached' : 'Upload PDF or Image'}
            </Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Amount (KES)</Text>
              <TextInput
                style={[styles.input, errors.quotationAmount && styles.inputError]}
                value={quotationAmount}
                onChangeText={t => { setQuotationAmount(t); setErrors(p => ({ ...p, quotationAmount: null })); }}
                placeholder="e.g. 15000"
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
              {errors.quotationAmount ? <Text style={styles.errorText}>{errors.quotationAmount}</Text> : null}
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Contractor</Text>
              <TextInput
                style={styles.input}
                value={contractorName}
                onChangeText={setContractorName}
                placeholder="Contractor name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <MaterialIcons name="check" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  optional: { color: colors.textMuted, fontWeight: '400', fontSize: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 },
  row: { flexDirection: 'row' },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, backgroundColor: colors.surfaceAlt },
  textarea: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, height: 100, textAlignVertical: 'top', backgroundColor: colors.surfaceAlt },
  inputError: { borderColor: colors.danger },
  pickerWrapper: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  picker: { color: colors.text },
  errorText: { fontSize: 11, color: colors.danger, marginTop: 3 },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoItem: { position: 'relative' },
  photo: { width: 76, height: 76, borderRadius: radius.sm },
  removePhoto: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  addPhotoBtn: { width: 76, height: 76, borderRadius: radius.sm, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primaryMid, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primaryXLight },
  addPhotoText: { fontSize: 10, color: colors.primaryMid, marginTop: 2, fontWeight: '600' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.sm, padding: 14, backgroundColor: colors.surfaceAlt, marginBottom: 12 },
  uploadBtnText: { flex: 1, fontSize: 13, color: colors.primaryMid, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryMid, borderRadius: radius.md, paddingVertical: 15, marginTop: 4, ...shadow.md },
  saveBtnDisabled: { backgroundColor: colors.primaryLight },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
