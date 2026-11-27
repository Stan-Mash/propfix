import React from 'react';
import { View, Modal, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { colors, radius } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');

export default function BottomSheet({ visible, onClose, children, maxHeight = 0.75 }) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent hardwareAccelerated onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[s.sheet, { maxHeight: SCREEN_H * maxHeight }]} onStartShouldSetResponder={() => true}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
});
