import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import { colors, shadow, radius } from '../theme';

const CATEGORY_ICONS = {
  leakage: 'water-outline',
  electrical: 'flash-outline',
  structural: 'construct-outline',
  plumbing: 'build-outline',
  painting: 'color-palette-outline',
  security: 'shield-outline',
  cleaning: 'sparkles-outline',
  other: 'document-outline',
};

export default function ComplaintCard({ complaint, onPress }) {
  const iconName = CATEGORY_ICONS[complaint.category] || 'document-outline';
  const date = complaint.createdAt
    ? new Date(complaint.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <MaterialIcons name={iconName} size={20} color={colors.primaryMid} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{complaint.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {complaint.propertyName}{complaint.unitNumber ? ` · Unit ${complaint.unitNumber}` : ''}
          </Text>
          <View style={styles.footer}>
            <Text style={styles.date}>{date}</Text>
            {complaint.quotationAmount ? (
              <Text style={styles.quote}>KES {Number(complaint.quotationAmount).toLocaleString()}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.right}>
          <StatusBadge status={complaint.status} size="sm" />
          <MaterialIcons name="chevron-right" size={14} color={colors.textMuted} style={{ marginTop: 6 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryXLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    fontSize: 11,
    color: colors.textMuted,
  },
  quote: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '600',
  },
  right: {
    alignItems: 'flex-end',
  },
});
