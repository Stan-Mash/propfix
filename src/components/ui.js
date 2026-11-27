import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, accent } from '../theme';

// 8px status dot: the only colour cue a card carries for criticality
export function StatusDot({ color, style }) {
  return <View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color || accent.neutral }, style]} />;
}

export const priorityDot = (ticket) =>
  ticket.status === 'resolved' ? accent.done : ticket.status === 'rejected' ? accent.neutral : accent[ticket.priority] || accent.Routine;

export function Badge({ label, text, bg, border, icon }) {
  return (
    <View style={[u.badge, { backgroundColor: bg, borderColor: border || bg }]}>
      {icon ? <MaterialIcons name={icon} size={12} color={text} /> : null}
      <Text style={[u.badgeTxt, { color: text }]}>{label}</Text>
    </View>
  );
}

export function Field({ label, hint, error, style, ...input }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={u.fieldLabel}>{label}</Text>
      <TextInput style={[u.input, error && { borderColor: colors.dangerMid }]} placeholderTextColor={colors.textMuted} {...input} />
      {error ? <Text style={u.errorTxt}>{error}</Text> : hint ? <Text style={u.hintTxt}>{hint}</Text> : null}
    </View>
  );
}

// Solid-fill single choice, for two to four options
export function ChoiceRow({ label, options, value, onChange }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={u.fieldLabel}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {options.map(o => {
          const on = o.value === value;
          return (
            <TouchableOpacity key={String(o.value)} style={[u.choice, on && u.choiceOn]} onPress={() => onChange(o.value)} activeOpacity={0.8}>
              <Text style={[u.choiceTxt, on && { color: '#fff' }]} numberOfLines={1}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function Btn({ label, icon, onPress, color = colors.primaryMid, outline, disabled, style }) {
  return (
    <TouchableOpacity
      style={[u.btn, outline ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong } : { backgroundColor: color }, disabled && { opacity: 0.45 }, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {icon ? <MaterialIcons name={icon} size={20} color={outline ? color : '#fff'} /> : null}
      <Text style={[u.btnTxt, { color: outline ? color : '#fff' }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// Tappable drill-down row used inside sheets
export function LinkRow({ icon, label, sub, onPress, danger }) {
  const tint = danger ? colors.dangerMid : colors.primaryMid;
  return (
    <TouchableOpacity style={u.linkRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[u.linkIcon, { backgroundColor: danger ? colors.dangerBg : colors.primaryXLight }]}>
        <MaterialIcons name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[u.linkTxt, danger && { color: colors.dangerMid }]}>{label}</Text>
        {sub ? <Text style={u.linkSub}>{sub}</Text> : null}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function SheetHeader({ title, sub, onBack }) {
  return (
    <View style={u.sheetHead}>
      {onBack ? (
        <TouchableOpacity style={u.backBtn} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={u.sheetTitle}>{title}</Text>
        {sub ? <Text style={u.sheetSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function SectionLabel({ children }) {
  return <Text style={u.section}>{children}</Text>;
}

export const u = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, minHeight: 50, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg },
  errorTxt: { fontSize: 12, fontWeight: '500', color: colors.dangerMid, marginTop: 6 },
  hintTxt: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  choice: { flexGrow: 1, minHeight: 48, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  choiceOn: { backgroundColor: colors.primaryMid, borderColor: colors.primaryMid },
  choiceTxt: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 8, paddingHorizontal: 14 },
  btnTxt: { fontSize: 15, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderTopWidth: 1, borderTopColor: colors.border },
  linkIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  linkTxt: { fontSize: 15, fontWeight: '600', color: colors.text },
  linkSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtn: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sheetSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  section: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6, marginBottom: 10 },
});
