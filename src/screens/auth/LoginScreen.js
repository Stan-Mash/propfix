import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const { login, googleSignIn, resetPassword } = useAuth();

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { profile } = await login(email.trim().toLowerCase(), password);
      const dest = { landlord: 'LandlordTabs', manager: 'ManagerTabs', caretaker: 'CaretakerTabs' }[profile?.role] || 'CaretakerTabs';
      navigation.replace(dest);
    } catch (e) {
      const msg =
        e.code === 'auth/invalid-credential' ? 'Incorrect email or password.' :
        e.code === 'auth/account-inactive' ? e.message :
        e.message;
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim() || !/\S+@\S+\.\S+/.test(forgotEmail)) {
      Alert.alert('Invalid Email', 'Enter a valid email address.');
      return;
    }
    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail.trim().toLowerCase());
      setForgotSent(true);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { profile } = await googleSignIn();
      if (!profile) {
        // No profile yet — AppNavigator will route to CompleteProfile
        return;
      }
      if (profile.active === false) {
        // AppNavigator will show PendingApproval
        return;
      }
      const dest = { landlord: 'LandlordTabs', manager: 'ManagerTabs', caretaker: 'CaretakerTabs' }[profile?.role] || 'CaretakerTabs';
      navigation.replace(dest);
    } catch (e) {
      if (e.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google Sign-In Failed', e.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <MaterialIcons name="build" size={32} color="#fff" />
            <View style={styles.logoBadge}>
              <MaterialIcons name="home" size={14} color={colors.primaryMid} />
            </View>
          </View>
          <Text style={styles.appName}>PropFix</Text>
          <Text style={styles.tagline}>Property Operations, Billing & Maintenance</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Sign In</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputWrap, errors.email && styles.inputErr]}>
              <MaterialIcons name="mail" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={t => { setEmail(t); setErrors(p => ({ ...p, email: null })); }}
                placeholder="you@company.co.ke"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            {errors.email ? <Text style={styles.errText}>{errors.email}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrap, errors.password && styles.inputErr]}>
              <MaterialIcons name="lock" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={t => { setPassword(t); setErrors(p => ({ ...p, password: null })); }}
                placeholder="Enter password"
                secureTextEntry={!showPw}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name={showPw ? 'visibility-off' : 'visibility'} size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errText}>{errors.password}</Text> : null}
          </View>

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading || googleLoading} activeOpacity={0.8}>
            <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotRow} onPress={() => { setShowForgot(true); setForgotSent(false); setForgotEmail(email); }}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            style={[styles.socialBtn, googleLoading && { opacity: 0.6 }]}
            onPress={handleGoogle}
            disabled={loading || googleLoading}
            activeOpacity={0.8}
          >
            <GoogleMark />
            <Text style={styles.socialBtnText}>{googleLoading ? 'Connecting...' : 'Continue with Google'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerRow} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerText}>No account? </Text>
            <Text style={[styles.registerText, { color: colors.primaryMid, fontWeight: '700' }]}>Request Access</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal visible={showForgot} transparent animationType="fade" onRequestClose={() => setShowForgot(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {forgotSent ? (
              <>
                <MaterialIcons name="mark-email-read" size={40} color={colors.primaryMid} style={{ marginBottom: 12 }} />
                <Text style={styles.modalTitle}>Check your inbox</Text>
                <Text style={styles.modalBody}>A password reset link has been sent to {forgotEmail}. Check your spam folder if it doesn't arrive.</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setShowForgot(false)}>
                  <Text style={styles.modalBtnTxt}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Reset Password</Text>
                <Text style={styles.modalBody}>Enter your account email and we'll send a reset link.</Text>
                <TextInput
                  style={styles.modalInput}
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  placeholder="you@company.co.ke"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowForgot(false)}>
                    <Text style={styles.modalCancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { flex: 1 }, forgotLoading && { opacity: 0.6 }]} onPress={handleForgot} disabled={forgotLoading}>
                    <Text style={styles.modalBtnTxt}>{forgotLoading ? 'Sending...' : 'Send Link'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function GoogleMark() {
  return (
    <View style={{ width: 20, height: 20, position: 'relative' }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: 10, height: 10, backgroundColor: '#4285F4', borderTopLeftRadius: 10 }} />
      <View style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, backgroundColor: '#EA4335', borderTopRightRadius: 10 }} />
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, backgroundColor: '#34A853', borderBottomRightRadius: 10 }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: 10, height: 10, backgroundColor: '#FBBC05', borderBottomLeftRadius: 10 }} />
      <View style={{ position: 'absolute', top: 4, left: 4, width: 12, height: 12, backgroundColor: colors.surface, borderRadius: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0B1320' },
  container: { flexGrow: 1, padding: spacing.md, paddingTop: 56, paddingBottom: 40 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  logoBadge: { position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.primary },
  appName: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '500' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: 20 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.inputBg, paddingHorizontal: 10, paddingVertical: 2 },
  inputErr: { borderColor: colors.dangerMid },
  input: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 10 },
  errText: { fontSize: 11, color: colors.dangerMid, marginTop: 3 },
  btn: { backgroundColor: colors.primaryMid, borderRadius: radius.sm, paddingVertical: 15, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 13, gap: 10, backgroundColor: colors.surface, marginBottom: 4 },
  googleIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dadce0', justifyContent: 'center', alignItems: 'center' },
  googleG: { fontSize: 12, fontWeight: '700', color: '#4285F4' },
  socialBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  registerText: { fontSize: 13, color: colors.textSecondary },
  forgotRow: { alignItems: 'center', marginTop: 10, marginBottom: 4 },
  forgotText: { fontSize: 13, color: colors.primaryMid, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' },
  modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: 16, textAlign: 'center' },
  modalInput: { width: '100%', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg },
  modalBtn: { backgroundColor: colors.primaryMid, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  modalBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  modalCancelBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center' },
  modalCancelTxt: { fontSize: 15, fontWeight: '700', color: colors.text },
  googleIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dadce0', justifyContent: 'center', alignItems: 'center' },
  googleG: { fontSize: 12, fontWeight: '700', color: '#4285F4' },
});
