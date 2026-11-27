import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import RoleSwitcher from './RoleSwitcher';

const HEADER_BG = '#0F172A';
export const TOP_INSET = Math.max(Platform.OS === 'android' ? (StatusBar.currentHeight || 38) : 44, 38) + 12;

export default function ScreenHeader({ title, subtitle, showBack = false, rightAction, showRoleSwitcher = false }) {
  const navigation = useNavigation();
  return (
    <View style={s.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_BG} translucent />
      <View style={[s.row, { paddingTop: TOP_INSET }]}>
        {showBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="chevron-left" size={22} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
        <View style={s.mid}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.sub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {rightAction ? <View style={s.right}>{rightAction}</View> : null}
      </View>
      {showRoleSwitcher && (
        <View style={s.rolebar}>
          <RoleSwitcher />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { backgroundColor: HEADER_BG, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#1E293B', marginRight: 10 },
  mid: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  sub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  right: { marginLeft: 10 },
  rolebar: { paddingHorizontal: 16, paddingBottom: 10 },
});
