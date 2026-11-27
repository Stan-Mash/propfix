import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../theme';

export default function PendingApprovalScreen() {
  const { userProfile, logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.iconWrap}>
        <MaterialIcons name="hourglass-empty" size={48} color={colors.warningMid} />
      </View>

      <Text style={styles.title}>Account Pending Approval</Text>
      <Text style={styles.body}>
        Your account has been created but is waiting for the landlord or administrator to review and approve it.
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <MaterialIcons name="person-outline" size={18} color={colors.textMuted} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Name</Text>
            <Text style={styles.rowValue}>{userProfile?.name || 'Not set'}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <MaterialIcons name="mail" size={18} color={colors.textMuted} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{userProfile?.email || 'Not set'}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <MaterialIcons name="badge" size={18} color={colors.textMuted} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Role requested</Text>
            <Text style={styles.rowValue}>
              {userProfile?.role === 'manager' ? 'Property Manager' : userProfile?.role === 'caretaker' ? 'Caretaker' : userProfile?.role || 'Not set'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.infoBox}>
        <MaterialIcons name="info-outline" size={16} color={colors.info} style={{ marginRight: 8, marginTop: 1 }} />
        <Text style={styles.infoText}>
          Contact the property landlord or administrator and ask them to activate your account in the PropFix app.
          Once activated, close and reopen the app to log in.
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
        <MaterialIcons name="logout" size={18} color={colors.dangerMid} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.md, paddingTop: 80, alignItems: 'center' },
  iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.warningBg, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 10, textAlign: 'center' },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, textAlign: 'center', marginBottom: 24, paddingHorizontal: 8 },
  card: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, gap: 12 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
  rowValue: { fontSize: 14, color: colors.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.border },
  infoBox: { flexDirection: 'row', backgroundColor: colors.infoBg, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.infoBorder, marginBottom: 24, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, color: colors.info, lineHeight: 18 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg },
  logoutText: { fontSize: 14, fontWeight: '600', color: colors.dangerMid },
});
