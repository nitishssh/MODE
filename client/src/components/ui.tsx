import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, type TextProps, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PropsWithChildren } from 'react';
import { colors, fonts, radius } from '../constants/theme';
export function useTheme() { return colors[useColorScheme() === 'dark' ? 'dark' : 'light']; }
export function Copy({ style, children, kind = 'body', ...props }: TextProps & { kind?: 'body' | 'title' | 'mono' | 'label' }) {
  const theme = useTheme();
  const text = typeof children === 'string' ? children : '';
  return <Text {...props} style={[{ color: theme.ink, fontFamily: kind === 'title' ? fonts.display : kind === 'mono' ? fonts.mono : /[\u0900-\u097F]/.test(text) ? fonts.devanagari : kind === 'label' ? fonts.strong : fonts.body, fontSize: kind === 'title' ? 30 : kind === 'label' ? 14 : 16, lineHeight: kind === 'title' ? 40 : 24, fontVariant: kind === 'mono' ? ['tabular-nums'] : undefined }, style]}>{children}</Text>;
}
export function Action({ children, onPress, disabled = false, primary = false, accessibilityLabel }: PropsWithChildren<{ onPress(): void; disabled?: boolean; primary?: boolean; accessibilityLabel?: string }>) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: primary ? theme.marigold : theme.hairline, backgroundColor: primary ? theme.marigold : theme.panel, borderRadius: radius.input, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}><Copy kind="label" style={{ color: primary ? colors.light.ink : theme.ink }}>{children}</Copy></Pressable>;
}
export function Screen({ title, eyebrow = 'MODE / CLUB REGISTER', children }: PropsWithChildren<{ title: string; eyebrow?: string }>) {
  const theme = useTheme(); const insets = useSafeAreaInsets();
  return <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={{ paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 24), paddingHorizontal: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled"><View style={{ maxWidth: 1100, width: '100%', paddingLeft: 20, borderLeftWidth: 1, borderLeftColor: theme.hairline, flex: 1, gap: 20 }}><Copy kind="mono" style={{ fontSize: 11, color: theme.instruction }}>{eyebrow}</Copy><Copy kind="title" accessibilityRole="header">{title}</Copy>{children}</View></ScrollView>;
}
export function Row({ style, ...props }: ViewProps) { const theme = useTheme(); return <View {...props} style={[{ paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline, gap: 4 }, style]} />; }
export function ErrorNotice({ error }: { error: string | null }) { const theme = useTheme(); return error ? <Copy accessibilityRole="alert" style={{ color: theme.overdue }}>{error}</Copy> : null; }
export function LoadingRows() { const theme = useTheme(); return <View accessibilityLabel="Loading records" accessibilityRole="progressbar">{[0, 1, 2].map(i => <View key={i} style={{ height: 44, borderBottomWidth: 1, borderColor: theme.hairline, justifyContent: 'center' }}><View style={{ height: 1, width: `${70 - i * 15}%`, backgroundColor: theme.hairline }} /></View>)}</View>; }
export function AsOf({ time, refreshing }: { time: Date | null; refreshing?: boolean }) { const theme = useTheme(); return time ? <Copy kind="mono" style={{ fontSize: 11, color: theme.instruction }}>As of {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{refreshing ? ' · refreshing' : ''}</Copy> : null; }
export function money(paise: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100); }
