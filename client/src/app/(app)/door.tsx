import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import type { EventDetails, ScanResult } from '../../generated/contracts';
import { useSession } from '../../lib/session';
import { Action, Copy, ErrorNotice, Row, Screen, useTheme } from '../../components/ui';

export default function DoorScanner() {
  const { client } = useSession();
  const theme = useTheme();
  const [events, setEvents] = useState<EventDetails[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [credential, setCredential] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const loadEvents = useCallback(async () => {
    try {
      const response = await client.request<{ events: EventDetails[] }>('/api/events');
      setEvents(response.events);
      setEventId(current => current ?? response.events[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load events.');
    }
  }, [client]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  async function scan(value = credential) {
    if (!eventId || !value.trim() || working) return;
    setWorking(true);
    setError(null);
    try {
      const next = await client.request<ScanResult>(`/api/events/${encodeURIComponent(eventId)}/scan`, {
        method: 'POST',
        body: JSON.stringify({ credential: value.trim() }),
      });
      setResult(next);
      setCredential('');
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(next.admitted ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not check this credential.');
    } finally {
      setWorking(false);
    }
  }

  return <Screen title="Door register">
    <Copy>Choose an event, then scan a QR code on native or type a pass or ticket code.</Copy>
    <ErrorNotice error={error} />
    <View style={styles.choices}>{events.map(event => <Action key={event.id} onPress={() => setEventId(event.id)} primary={event.id === eventId}>{event.title}</Action>)}</View>
    {Platform.OS !== 'web' && <Row>{!permission ? <Copy>Loading camera permission…</Copy> : !permission.granted ? <Action onPress={() => void requestPermission()}>Allow camera access</Action> : <View style={[styles.camera, { borderColor: theme.hairline }]}><CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => void scan(data)} /></View>}</Row>}
    <Row><Copy kind="label">TYPED FALLBACK</Copy><TextInput accessibilityLabel="Pass or ticket code" autoCapitalize="characters" value={credential} onChangeText={setCredential} onSubmitEditing={() => void scan()} placeholder="Enter pass or ticket code" placeholderTextColor={theme.instruction} style={[styles.input, { borderColor: theme.hairline, color: theme.ink }]} /><Action disabled={!eventId || !credential || working} onPress={() => void scan()} primary>{working ? 'Checking…' : 'Check credential'}</Action></Row>
    {result && <Row><Copy kind="label">{result.message}</Copy><Copy style={{ color: result.admitted ? theme.verified : theme.overdue }}>Outcome: {result.outcome.replaceAll('_', ' ')}</Copy>{result.attendee && <Copy>Attendee: {result.attendee.name}</Copy>}{result.checkedInAt && <Copy kind="mono">Checked in {new Date(result.checkedInAt).toLocaleTimeString()}</Copy>}</Row>}
  </Screen>;
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  camera: { height: 280, overflow: 'hidden', borderWidth: 1, borderRadius: 6 },
  input: { borderWidth: 1, borderRadius: 6, padding: 12, fontSize: 16 },
});
