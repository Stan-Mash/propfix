import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function FilterBar({ filters, active, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {filters.map(f => (
        <TouchableOpacity
          key={f.value}
          style={[styles.btn, active === f.value && styles.btnActive]}
          onPress={() => onChange(f.value)}
        >
          <Text style={[styles.text, active === f.value && styles.textActive]}>{f.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: {
    backgroundColor: colors.primaryMid,
    borderColor: colors.primaryMid,
  },
  text: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  textActive: {
    color: colors.surface,
    fontWeight: '600',
  },
});
