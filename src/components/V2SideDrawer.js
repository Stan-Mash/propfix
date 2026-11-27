import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const DRAWER_W = Math.min(width * 0.78, 300);

const NAV = [
  { key: 'Settings',        icon: 'settings',       label: 'Settings' },
  { key: 'StaffManagement', icon: 'group',           label: 'Staff Management' },
  { key: 'Quotations',      icon: 'request-quote',   label: 'Quotations' },
];

export default function V2SideDrawer({ open, navigation, onClose, companyName, userName, roleLabel, onSignOut }) {
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={s.drawer}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{(userName || 'U')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.company} numberOfLines={1}>{companyName || 'PropFix'}</Text>
              <Text style={s.role}>{userName} · {roleLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Nav items */}
          <View style={s.navList}>
            {NAV.map(item => (
              <TouchableOpacity
                key={item.key}
                style={s.navItem}
                onPress={() => { onClose(); navigation.navigate(item.key); }}
                activeOpacity={0.7}
              >
                <View style={s.navIcon}>
                  <MaterialIcons name={item.icon} size={18} color="#94A3B8" />
                </View>
                <Text style={s.navLabel}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={18} color="#334155" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign out */}
          <TouchableOpacity style={s.signOut} onPress={onSignOut} activeOpacity={0.8}>
            <MaterialIcons name="logout" size={16} color="#DC2626" />
            <Text style={s.signOutTxt}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(11,20,36,0.55)' },
  drawer: { width: DRAWER_W, backgroundColor: '#0F172A', paddingTop: 56, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1E3A5F', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#2563EB' },
  avatarTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  company: { fontSize: 14, fontWeight: '800', color: '#F1F5F9' },
  role: { fontSize: 11, color: '#64748B', marginTop: 2 },
  navList: { paddingTop: 12, paddingHorizontal: 12, flex: 1 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2 },
  navIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  navLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#CBD5E1' },
  signOut: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#3F1515', backgroundColor: '#1A0A0A' },
  signOutTxt: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
});
