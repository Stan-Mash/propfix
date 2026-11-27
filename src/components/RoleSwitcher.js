import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { key: 'landlord', label: 'Landlord', color: '#2563EB', dest: 'LandlordTabs' },
  { key: 'manager', label: 'Manager', color: '#7C3AED', dest: 'ManagerTabs' },
  { key: 'caretaker', label: 'Caretaker', color: '#16A34A', dest: 'CaretakerTabs' },
];

export default function RoleSwitcher() {
  const { userProfile, switchRole } = useAuth();
  const navigation = useNavigation();
  const currentKey = userProfile?.role || 'landlord';

  const handleSwitch = (r) => {
    if (r.key === currentKey) return;
    switchRole(r.key);
    navigation.reset({ index: 0, routes: [{ name: r.dest }] });
  };

  return (
    <View style={s.seg}>
      {ROLES.map((r, i) => {
        const active = r.key === currentKey;
        return (
          <TouchableOpacity
            key={r.key}
            style={[s.btn, i === 0 && s.btnL, i === ROLES.length - 1 && s.btnR, active && { backgroundColor: r.color }]}
            onPress={() => handleSwitch(r)}
            activeOpacity={0.75}
          >
            <Text style={[s.lbl, active && s.lblOn]}>{r.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 8, padding: 3, height: 38 },
  btn: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  btnL: { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
  btnR: { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  lbl: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  lblOn: { color: '#FFFFFF', fontWeight: '700' },
});
