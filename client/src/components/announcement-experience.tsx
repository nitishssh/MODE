import { useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import type { Announcement, AnnouncementOutboxMessage, AnnouncementPublication, Notification } from "../generated/contracts";
import { canInspectOutbox, canPublishAnnouncement } from "../lib/commerce-actions";
import { useSession } from "../lib/session";
import { useResource } from "../lib/use-resource";
import { Action, AsOf, Copy, ErrorNotice, LoadingRows, PaperCard, Screen, StatusBadge, useTheme } from "./ui";
import { Field, useWrite, WriteNotice } from "./forms";

export default function AnnouncementExperience() {
  const archive = useResource<{ announcements: Announcement[] }>("/api/announcements");
  const { user } = useSession();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  return <Screen title="Club announcements" eyebrow="MODE / NOTICE ARCHIVE">
    <Copy>Published club notices, newest first. The archive is public; publishing, personal notifications, and delivery inspection follow your signed-in permissions.</Copy>
    <View style={{ flexDirection: width >= 700 ? "row" : "column", alignItems: width >= 700 ? "center" : "flex-start", gap: 12 }}>
      <Action onPress={() => void archive.reload()} disabled={archive.loading}>Refresh archive</Action>
      <AsOf time={archive.time} refreshing={archive.loading} />
    </View>
    <ErrorNotice error={archive.error} />
    {canPublishAnnouncement(user) && <Composer refresh={archive.reload} />}
    {user && <Inbox />}
    <View style={{ gap: 6, marginTop: 10 }}><Copy kind="mono" style={{ color: theme.terracottaInk, fontSize: 11 }}>PUBLISHED / CHRONOLOGICAL</Copy><Copy kind="title">Announcement archive</Copy></View>
    {archive.loading && !archive.data && <LoadingRows />}
    {!archive.loading && archive.data?.announcements.length === 0 && <PaperCard><Copy kind="title">No published notices</Copy><Copy>The club has not published an announcement yet.</Copy><Action onPress={() => void archive.reload()}>Check again</Action></PaperCard>}
    <View style={{ gap: 14 }}>
      {archive.data?.announcements.map((item) => <AnnouncementCard key={item.id} item={item} canInspect={canInspectOutbox(user)} />)}
    </View>
  </Screen>;
}

function Composer({ refresh }: { refresh(): Promise<void> }) {
  const { client } = useSession();
  const theme = useTheme();
  const write = useWrite();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const attempt = useRef<{ content: string; key: string } | null>(null);
  const publish = () => {
    const normalized = { title: title.trim(), body: body.trim() };
    if (!normalized.title || !normalized.body) {
      setValidation(!normalized.title && !normalized.body ? "Title and message are required." : !normalized.title ? "Announcement title is required." : "Announcement message is required.");
      return;
    }
    setValidation(null);
    void write.run(async () => {
      const content = JSON.stringify(normalized);
      if (attempt.current?.content !== content) attempt.current = { content, key: `publish-${Date.now()}-${Math.random().toString(36).slice(2)}` };
      const result = await client.request<AnnouncementPublication>("/api/announcements", { method: "POST", body: JSON.stringify({ ...normalized, idempotencyKey: attempt.current.key }) });
      setTitle(""); setBody(""); attempt.current = null;
      write.setNotice(`Published to ${result.recipientCount} active member${result.recipientCount === 1 ? "" : "s"}. In-app notifications and simulated outbox rows were created.`);
      await refresh();
    });
  };
  return <PaperCard style={{ borderColor: theme.terracotta }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><Copy kind="title">Publish a notice</Copy><StatusBadge label="Organizer access" tone="warn" /></View>
    <Copy>This publishes immediately to the public archive and creates in-app notifications for the server-selected active-member audience.</Copy>
    <Field label="Announcement title (required)" value={title} onChangeText={(value) => { setTitle(value); setValidation(null); }} editable={!write.busy} maxLength={160} />
    <Field label="Announcement message (required)" value={body} onChangeText={(value) => { setBody(value); setValidation(null); }} editable={!write.busy} multiline maxLength={10000} />
    <Copy kind="mono" style={{ fontSize: 11 }}>{title.length}/160 title · {body.length}/10000 message</Copy>
    {validation && <Copy accessibilityRole="alert" style={{ color: theme.overdue }}>{validation}</Copy>}
    {(title.trim() || body.trim()) && <View style={{ padding: 14, borderLeftWidth: 3, borderLeftColor: theme.marigold, gap: 6 }}><Copy kind="mono" style={{ fontSize: 10 }}>PREVIEW</Copy><Copy kind="label">{title.trim() || "Untitled announcement"}</Copy><Copy>{body.trim() || "Your message will appear here."}</Copy></View>}
    <WriteNotice state={write} />
    <Action primary disabled={write.busy} onPress={publish}>{write.busy ? "Publishing…" : "Publish announcement"}</Action>
  </PaperCard>;
}

function Inbox() {
  const inbox = useResource<{ notifications: Notification[] }>("/api/notifications");
  const theme = useTheme();
  const unread = inbox.data?.notifications.filter((item) => item.readAt === null).length ?? 0;
  return <PaperCard>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}><View><Copy kind="mono" style={{ fontSize: 10 }}>PRIVATE TO YOUR ACCOUNT</Copy><Copy kind="title">Your notifications</Copy></View><StatusBadge label={`${unread} unread`} tone={unread ? "warn" : "good"} /></View>
    <ErrorNotice error={inbox.error} />
    <Action onPress={() => void inbox.reload()} disabled={inbox.loading}>Refresh notifications</Action>
    {inbox.loading && !inbox.data && <LoadingRows />}
    {!inbox.loading && inbox.data?.notifications.length === 0 && <Copy>No notifications yet.</Copy>}
    {inbox.data?.notifications.map((item) => <View key={item.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: theme.hairline, gap: 4 }}><View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 }}><Copy kind="label">{item.title}</Copy><StatusBadge label={item.readAt ? "Read" : "Unread"} tone={item.readAt ? "neutral" : "warn"} /></View><Copy>{item.body}</Copy><Copy kind="mono" style={{ fontSize: 10 }}>{new Date(item.createdAt).toLocaleString()}</Copy></View>)}
  </PaperCard>;
}

function AnnouncementCard({ item, canInspect }: { item: Announcement; canInspect: boolean }) {
  return <PaperCard>
    <Copy kind="mono" style={{ fontSize: 10 }}>{new Date(item.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</Copy>
    <Copy kind="title" style={{ fontSize: 24, lineHeight: 31 }}>{item.title}</Copy>
    <Copy>{item.body}</Copy>
    <Copy kind="mono" style={{ fontSize: 10 }}>Published {new Date(item.publishedAt).toLocaleString()}</Copy>
    {canInspect && <Outbox id={item.id} />}
  </PaperCard>;
}

function Outbox({ id }: { id: string }) {
  const { client } = useSession();
  const theme = useTheme();
  const write = useWrite();
  const [rows, setRows] = useState<AnnouncementOutboxMessage[] | null>(null);
  return <View style={{ borderTopWidth: 1, borderColor: theme.hairline, paddingTop: 12, gap: 8 }}>
    <WriteNotice state={write} />
    <Action disabled={write.busy} onPress={() => void write.run(async () => {
      const result = await client.request<{ delivery: "simulated"; messages: AnnouncementOutboxMessage[] }>(`/api/announcements/${id}/outbox`);
      setRows(result.messages);
    })}>{write.busy ? "Loading outbox…" : rows ? "Refresh simulated outbox" : "Inspect simulated outbox"}</Action>
    {rows && <><Copy>{rows.length} queued record{rows.length === 1 ? "" : "s"}. These are simulated results—no email or WhatsApp was sent.</Copy>{rows.map((row) => <View key={row.id} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><Copy>{row.recipientEmail}</Copy><StatusBadge label="Simulated" tone="neutral" /></View>)}</>}
  </View>;
}
