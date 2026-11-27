import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

const STATUS = {
  pending: { label: 'Pending', bg: colors.warningBg, color: colors.warning, border: colors.warningBorder },
  under_review: { label: 'Under Review', bg: colors.primaryXLight, color: colors.primaryMid, border: colors.primaryLight },
  forwarded: { label: 'Awaiting Approval', bg: colors.purpleBg, color: colors.purple, border: colors.purpleBorder },
  approved: { label: 'Approved', bg: colors.successBg, color: colors.success, border: colors.successBorder },
  rejected: { label: 'Rejected', bg: colors.dangerBg, color: colors.danger, border: colors.dangerBorder },
  in_progress: { label: 'In Progress', bg: colors.amberBg, color: colors.amber, border: colors.warningBorder },
  resolved: { label: 'Resolved', bg: '#F0FDF4', color: '#15803D', border: '#86EFAC' },
};

export default function StatusBadge({ status, size = 'md' }) {
  const cfg = STATUS[status] || { label: status, bg: colors.surfaceAlt, color: colors.textSecondary, border: colors.border };
  const isSmall = size === 'sm';
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }, isSmall && styles.badgeSm]}>
      <Text style={[styles.text, { color: cfg.color }, isSmall && styles.textSm]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 11,
  },
});
