import { useRef, useState } from "react";
import type {
  Announcement,
  AnnouncementOutboxMessage,
  AnnouncementPublication,
  Notification,
} from "../generated/contracts";
import { useSession } from "../lib/session";
import { useResource } from "../lib/use-resource";
import {
  Action,
  AsOf,
  Copy,
  ErrorNotice,
  LoadingRows,
  Row,
  Screen,
} from "./ui";
import { Field, useWrite, WriteNotice } from "./forms";

export default function Announcements() {
  const archive = useResource<{ announcements: Announcement[] }>(
    "/api/announcements",
  );
  const { user, client } = useSession();
  const write = useWrite();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Keep the same key AND payload after uncertain responses; edited content gets a new key.
  const attempt = useRef<{ content: string; key: string } | null>(null);
  return (
    <Screen title="Club announcements">
      <AsOf time={archive.time} refreshing={archive.loading} />
      <ErrorNotice error={archive.error} />
      <Action onPress={() => void archive.reload()} disabled={archive.loading}>
        Refresh archive
      </Action>
      {user?.permissions.includes("announcements:write") && (
        <Row>
          <Copy kind="title">Publish to active members</Copy>
          <Field
            label="Announcement title"
            value={title}
            onChangeText={setTitle}
            editable={!write.busy}
            maxLength={160}
          />
          <Field
            label="Announcement body"
            value={body}
            onChangeText={setBody}
            editable={!write.busy}
            multiline
            maxLength={10000}
          />
          <WriteNotice state={write} />
          <Action
            disabled={write.busy || !title.trim() || !body.trim()}
            onPress={() =>
              void write.run(async () => {
                const content = JSON.stringify({
                  title: title.trim(),
                  body: body.trim(),
                });
                if (attempt.current?.content !== content)
                  attempt.current = {
                    content,
                    key: `publish-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  };
                const result = await client.request<AnnouncementPublication>(
                  "/api/announcements",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      ...JSON.parse(content),
                      idempotencyKey: attempt.current.key,
                    }),
                  },
                );
                setTitle("");
                setBody("");
                attempt.current = null;
                write.setNotice(
                  `Published for ${result.recipientCount} active members. Delivery is simulated.`,
                );
                await archive.reload();
              })
            }
          >
            Publish announcement
          </Action>
        </Row>
      )}
      {user && <Inbox />}
      {archive.loading && !archive.data && <LoadingRows />}
      {archive.data?.announcements.length === 0 && (
        <Copy>No announcements have been published.</Copy>
      )}
      {archive.data?.announcements.map((item) => (
        <Row key={item.id}>
          <Copy kind="label">{item.title}</Copy>
          <Copy>{new Date(item.publishedAt).toLocaleString()}</Copy>
          <Copy>{item.body}</Copy>
          {user?.permissions.includes("outbox:manage") && (
            <Outbox id={item.id} />
          )}
        </Row>
      ))}
    </Screen>
  );
}
function Inbox() {
  const inbox = useResource<{ notifications: Notification[] }>(
    "/api/notifications",
  );
  return (
    <Row>
      <Copy kind="title">Your notifications</Copy>
      <ErrorNotice error={inbox.error} />
      <Action onPress={() => void inbox.reload()}>Refresh notifications</Action>
      {inbox.loading && !inbox.data && <LoadingRows />}
      {inbox.data?.notifications.length === 0 && (
        <Copy>No notifications yet.</Copy>
      )}
      {inbox.data?.notifications.map((item) => (
        <Row key={item.id}>
          <Copy kind="label">{item.title}</Copy>
          <Copy>{item.body}</Copy>
          <Copy>{new Date(item.createdAt).toLocaleString()}</Copy>
        </Row>
      ))}
    </Row>
  );
}
function Outbox({ id }: { id: string }) {
  const { client } = useSession();
  const write = useWrite();
  const [rows, setRows] = useState<AnnouncementOutboxMessage[] | null>(null);
  return (
    <>
      <WriteNotice state={write} />
      <Action
        disabled={write.busy}
        onPress={() =>
          void write.run(async () => {
            const result = await client.request<{
              messages: AnnouncementOutboxMessage[];
            }>(`/api/announcements/${id}/outbox`);
            setRows(result.messages);
          })
        }
      >
        Inspect simulated outbox
      </Action>
      {rows && (
        <Copy>
          {rows.length} simulated messages. No email or WhatsApp was sent.
        </Copy>
      )}
      {rows?.map((row) => (
        <Copy key={row.id}>
          {row.recipientEmail} · {row.status}
        </Copy>
      ))}
    </>
  );
}
