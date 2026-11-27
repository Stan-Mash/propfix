import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

export default function PhotoPicker({ label, value, onChange, propertyName, unitLabel, disabled, variant }) {
  const asButton = variant === 'button';
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const timestamp = () => new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const pickFrom = async (source) => {
    setShowModal(false);
    setLoading(true);
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Camera permission required'); setLoading(false); return; }
        result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false, exif: false });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Media library permission required'); setLoading(false); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false });
      }
      if (!result.canceled && result.assets?.[0]) {
        onChange({
          uri: result.assets[0].uri,
          timestamp: timestamp(),
          propertyName: propertyName || '',
          unitLabel: unitLabel || '',
          width: result.assets[0].width,
          height: result.assets[0].height,
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open ' + (source === 'camera' ? 'camera' : 'gallery'));
    }
    setLoading(false);
  };

  return (
    <View style={s.wrap}>
      {label && !asButton && <Text style={s.label}>{label}</Text>}
      {!value?.uri && asButton ? (
        <TouchableOpacity style={s.btn} onPress={() => !disabled && setShowModal(true)} activeOpacity={0.85} disabled={disabled}>
          {loading ? <ActivityIndicator color={colors.primaryMid} /> : (
            <>
              <MaterialIcons name="photo-camera" size={22} color={colors.primaryMid} />
              <Text style={s.btnTxt}>{label}</Text>
            </>
          )}
        </TouchableOpacity>
      ) : value?.uri ? (
        <View style={s.preview}>
          <Image source={{ uri: value.uri }} style={s.img} resizeMode="cover" />
          <View style={s.watermark}>
            <Text style={s.waterTxt}>{value.propertyName}{value.unitLabel ? ` - ${value.unitLabel}` : ''}</Text>
            <Text style={s.waterTxt}>{value.timestamp}</Text>
          </View>
          {!disabled && (
            <TouchableOpacity style={s.retake} onPress={() => setShowModal(true)} activeOpacity={0.8}>
              <MaterialIcons name="refresh" size={13} color="#fff" />
              <Text style={s.retakeTxt}>Retake</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity style={s.placeholder} onPress={() => !disabled && setShowModal(true)} activeOpacity={0.8} disabled={disabled}>
          {loading ? (
            <ActivityIndicator color={colors.primaryMid} />
          ) : (
            <>
              <MaterialIcons name="camera-alt" size={28} color={colors.textMuted} />
              <Text style={s.placeholderTxt}>{label || 'Tap to add photo'}</Text>
              <Text style={s.placeholderSub}>Camera or gallery</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <Modal visible={showModal} transparent animationType="fade" statusBarTranslucent hardwareAccelerated onRequestClose={() => setShowModal(false)}>
        <Pressable style={s.overlay} onPress={() => setShowModal(false)}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{label || 'Add Photo'}</Text>
            <TouchableOpacity style={s.opt} onPress={() => pickFrom('camera')}>
              <View style={[s.optIcon, { backgroundColor: colors.primaryLight }]}>
                <MaterialIcons name="camera" size={20} color={colors.primaryMid} />
              </View>
              <View>
                <Text style={s.optTxt}>Take Photo</Text>
                <Text style={s.optSub}>Use camera with timestamp</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.opt} onPress={() => pickFrom('gallery')}>
              <View style={[s.optIcon, { backgroundColor: colors.successBg }]}>
                <MaterialIcons name="photo-library" size={20} color={colors.successMid} />
              </View>
              <View>
                <Text style={s.optTxt}>Choose from Gallery</Text>
                <Text style={s.optSub}>Upload existing photo</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  placeholder: { height: 120, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceAlt, gap: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderWidth: 1.5, borderColor: colors.primaryMid, borderRadius: 8, backgroundColor: colors.primaryXLight },
  btnTxt: { fontSize: 14, fontWeight: '700', color: colors.primaryMid },
  placeholderTxt: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  placeholderSub: { fontSize: 11, color: colors.textMuted },
  preview: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, position: 'relative' },
  img: { width: '100%', height: 180 },
  watermark: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', padding: 6 },
  waterTxt: { fontSize: 10, color: '#fff', fontWeight: '600' },
  retake: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  retakeTxt: { fontSize: 11, color: '#fff', fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: 32, paddingTop: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, paddingHorizontal: spacing.md, marginBottom: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.md, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
  optIcon: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  optTxt: { fontSize: 14, fontWeight: '600', color: colors.text },
  optSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
