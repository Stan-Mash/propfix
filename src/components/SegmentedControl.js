import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function SegmentedControl({ segments, activeKey, onChange }) {
  return (
    <View style={s.track}>
      {segments.map(seg => {
        const active = seg.key === activeKey;
        return (
          <TouchableOpacity
            key={seg.key}
            style={[s.tab, active && s.tabActive]}
            onPress={() => onChange(seg.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.label, active && s.labelActive]} numberOfLines={1}>
              {seg.label}
            </Text>
            {seg.count !== undefined && (
              <View style={[s.badge, active && s.badgeActive]}>
                <Text style={[s.badgeText, active && s.badgeTextActive]}>{seg.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: '#CBD5E1', borderRadius: 10, padding: 3, marginHorizontal: 16, marginVertical: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 8 },
  tabActive: { backgroundColor: '#FFFFFF', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  labelActive: { color: colors.text, fontWeight: '700' },
  badge: { minWidth: 20, height: 18, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeActive: { backgroundColor: colors.primaryMid },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  badgeTextActive: { color: '#FFFFFF' },
});
