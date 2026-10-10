import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { PublicTicket } from "@/src/contracts";
import { request } from "@/src/lib/api";
import { lightTheme } from "@/src/constants/theme";
import { Panel, RegisterRow, Screen } from "@/src/components/register";
export default function GuestTicket() {
  const { token } = useLocalSearchParams<{ token: string }>(); const [ticket, setTicket] = useState<PublicTicket | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!token) return; request<{ ticket: PublicTicket }>(`/t/${encodeURIComponent(token)}`).then(({ ticket: next }) => setTicket(next)).catch((reason) => setError(reason instanceof Error ? reason.message : "Ticket not found.")); }, [token]);
  return <ScrollView contentContainerStyle={{ flexGrow: 1 }}><Screen><Text style={styles.kicker}>MODE / GUEST TICKET</Text><Text style={styles.title}>Your entry record</Text>{error ? <Panel><Text style={styles.error}>{error}</Text></Panel> : !ticket ? <Panel><Text>Loading ticket…</Text></Panel> : <Panel><Text style={styles.code}>{ticket.shortCode}</Text><Text style={styles.name}>{ticket.holderName}</Text><RegisterRow label="Event" value={ticket.event.title} /><RegisterRow label="When" value={new Date(ticket.event.startsAt).toLocaleString()} /><RegisterRow label="Venue" value={ticket.event.venue} /><RegisterRow label="Status" value={ticket.status.replace("_", " ")} tone={ticket.status === "paid" ? "paid" : ticket.status === "pending_payment" ? "pending" : "danger"} />{ticket.holdExpiresAt ? <RegisterRow label="Hold until" value={new Date(ticket.holdExpiresAt).toLocaleTimeString()} tone="pending" /> : null}</Panel>}</Screen></ScrollView>;
}
const styles = StyleSheet.create({ kicker: { color: lightTheme.terracotta, fontFamily: "JetBrainsMono", fontSize: 12 }, title: { color: lightTheme.ink, fontFamily: "Literata", fontSize: 30 }, code: { color: lightTheme.terracotta, fontFamily: "JetBrainsMono", fontSize: 26 }, name: { color: lightTheme.ink, fontFamily: "Literata", fontSize: 21 }, error: { color: lightTheme.red } });
