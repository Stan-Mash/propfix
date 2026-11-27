import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme';

// Centred two-button dialog, reserved for decisions that cannot be undone
export default function ConfirmModal({ visible, title, message, confirmLabel, icon = 'warning', danger = true, onConfirm, onCancel }) {
  const tint = danger ? colors.dangerMid : colors.successMid;
  return (
    <Modal visible={!!visible} transparent animationType="fade" statusBarTranslucent hardwareAccelerated onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={[s.icon, { backgroundColor: danger ? colors.dangerBg : colors.successBg }]}>
            <MaterialIcons name={icon} size={26} color={tint} />
          </View>
          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.msg}>{message}</Text> : null}
          <View style={s.row}>
            <TouchableOpacity style={s.cancel} onPress={onCancel} activeOpacity={0.8}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.confirm, { backgroundColor: tint }]} onPress={onConfirm} activeOpacity={0.85}>
              <Text style={s.confirmTxt} numberOfLines={1} adjustsFontSizeToFit>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, alignItems: 'center' },
  icon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  msg: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  cancel: { flex: 1, minHeight: 52, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'center', alignItems: 'center' },
  cancelTxt: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  confirm: { flex: 1.4, minHeight: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
