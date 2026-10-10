import { useState } from 'react';
import { Redirect } from 'expo-router';
import { TextInput, View } from 'react-native';
import { useSession } from '../lib/session';
import { Action, Copy, ErrorNotice, LoadingRows, Screen, useTheme } from '../components/ui';
import { fonts, radius } from '../constants/theme';
export default function Login() {
  const { status, user, busy, error, client } = useSession(); const theme = useTheme();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  if (user) return <Redirect href="/" />;
  const inputStyle = { borderWidth: 1, borderColor: theme.hairline, borderRadius: radius.input, padding: 12, fontFamily: fonts.body, fontSize: 16, color: theme.ink, backgroundColor: theme.panel };
  return <Screen title="Your club, on the record."><Copy>Sign in to see your membership, tasks and club register.</Copy>{status === 'loading' ? <LoadingRows /> : <View style={{ gap: 12, width: '100%', maxWidth: 440 }}><Copy kind="label">Email</Copy><TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" style={inputStyle} editable={!busy} /><Copy kind="label">Password</Copy><TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" style={inputStyle} editable={!busy} onSubmitEditing={() => { if (email && password) void client.signIn(email, password); }} /><ErrorNotice error={error} /><Action primary disabled={busy || !email.trim() || !password} onPress={() => void client.signIn(email, password)}>{busy ? 'Signing in…' : 'Sign in'}</Action>{status === 'unavailable' && <Action onPress={() => void client.bootstrap()}>Retry saved session</Action>}</View>}<Copy style={{ color: theme.instruction }}>Payments are recorded by club officers. No payment is charged in this app.</Copy></Screen>;
}
