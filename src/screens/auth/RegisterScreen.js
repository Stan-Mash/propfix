import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../theme';

const LANDLORD_CODE = 'PROPFIX-OWNER';

const ROLES = [
  { label: 'Caretaker', value: 'caretaker', icon: 'handyman', desc: 'On-site maintenance & repairs' },
  { label: 'Manager', value: 'manager', icon: 'manage-accounts', desc: 'Oversees tenants & operations' },
  { label: 'Landlord', value: 'landlord', icon: 'home-work', desc: 'Property owner (access code required)' },
];

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('caretaker');
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { register } = useAuth();

  const isLandlord = role === 'landlord';

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
    if (isLandlord && !accessCode.trim()) e.accessCode = 'Access code is required for landlord registration';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    if (isLandlord && accessCode.trim() !== LANDLORD_CODE) {
      setErrors(p => ({ ...p, accessCode: 'Invalid access code. Contact the system administrator.' }));
      return;
    }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim(), role, isLandlord);
    } catch (e) {
      const msg = e.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists.'
        : e.message;
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heading}>Create Account</Text>
        <Text style={styles.subheading}>
          {isLandlord
            ? 'Landlord accounts are activated immediately with a valid access code.'
            : 'Your account will be reviewed by the landlord before you can access the app.'}
        </Text>

        <View style={styles.card}>
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
              <MaterialIcons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={t => { setName(t); setErrors(p => ({ ...p, name: null })); }}
                placeholder="e.g. John Kamau"
                autoCorrect={false}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
              <MaterialIcons name="mail" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={t => { setEmail(t); setErrors(p => ({ ...p, email: null })); }}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
              <MaterialIcons name="lock" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={t => { setPassword(t); setErrors(p => ({ ...p, password: null })); }}
                placeholder="Minimum 6 characters"
                secureTextEntry={!showPassword}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          {/* Role selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Your Role</Text>
            <View style={styles.roleGrid}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleCard, role === r.value && styles.roleCardActive]}
                  onPress={() => { setRole(r.value); setAccessCode(''); setErrors(p => ({ ...p, accessCode: null })); }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={r.icon} size={22} color={role === r.value ? colors.primaryMid : colors.textMuted} />
                  <Text style={[styles.roleName, role === r.value && { color: colors.primaryMid }]}>{r.label}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Landlord access code */}
          {isLandlord && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Access Code</Text>
              <View style={[styles.inputWrapper, errors.accessCode && styles.inputError]}>
                <MaterialIcons name="vpn-key" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={accessCode}
                  onChangeText={t => { setAccessCode(t); setErrors(p => ({ ...p, accessCode: null })); }}
                  placeholder="Enter landlord access code"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  secureTextEntry={!showCode}
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity onPress={() => setShowCode(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialIcons name={showCode ? 'visibility-off' : 'visibility'} size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {errors.accessCode
                ? <Text style={styles.errorText}>{errors.accessCode}</Text>
                : <Text style={styles.hintText}>Contact your system administrator for the access code.</Text>}
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnLoading]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>{loading ? 'Creating account...' : isLandlord ? 'Create Landlord Account' : 'Request Access'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.loginText, styles.loginLink]}>Sign In</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.md, paddingTop: 56 },
  topBar: { marginBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subheading: { fontSize: 13, color: colors.textSecondary, marginBottom: 24, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 2 },
  inputError: { borderColor: colors.dangerMid },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 11 },
  errorText: { fontSize: 12, color: colors.dangerMid, marginTop: 4, marginLeft: 2 },
  hintText: { fontSize: 11, color: colors.textMuted, marginTop: 4, marginLeft: 2 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleCard: { flex: 1, minWidth: '28%', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 10, alignItems: 'center', backgroundColor: colors.surfaceAlt, gap: 4 },
  roleCardActive: { borderColor: colors.primaryMid, backgroundColor: colors.primaryXLight },
  roleName: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  roleDesc: { fontSize: 9, color: colors.textMuted, textAlign: 'center', lineHeight: 13 },
  btn: { backgroundColor: colors.primaryMid, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnLoading: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4, marginBottom: 32 },
  loginText: { fontSize: 14, color: colors.textSecondary },
  loginLink: { color: colors.primaryMid, fontWeight: '600' },
});
