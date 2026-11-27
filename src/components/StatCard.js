import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, shadow, radius } from '../theme';

export default function StatCard({ label, value, color }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color: color || colors.primaryMid }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
});
