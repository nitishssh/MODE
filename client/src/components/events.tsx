import { EventCreate } from "./setup-forms";
import { useState } from "react";
import { Platform, Linking } from "react-native";
import type { EventDetails, Ticket } from "../generated/contracts";
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
  money,
} from "./ui";
import { Field, useWrite, WriteNotice } from "./forms";
import { PassCode } from "./pass-code";
import { Door } from "./door";

export default function Events() {
  const { user } = useSession();
  const events = useResource<{ events: EventDetails[] }>("/api/events");
  const [selected, setSelected] = useState<string | null>(null);
  const event = events.data?.events.find((e) => e.id === selected);
  return (
    <Screen title="Events and tickets">
      {user?.permissions.includes("events:write") && (
        <EventCreate refresh={events.reload} />
      )}
      <AsOf time={events.time} refreshing={events.loading} />
      <ErrorNotice error={events.error} />
      <Action onPress={() => void events.reload()}>Refresh availability</Action>
      {events.loading && !events.data && <LoadingRows />}
      {events.data?.events.length === 0 && (
        <Copy>No events are published.</Copy>
      )}
      {events.data?.events.map((item) => (
        <Row key={item.id}>
          <Copy kind="label">{item.title}</Copy>
          <Copy>
            {item.venue} · {new Date(item.startsAt).toLocaleString()}
          </Copy>
          <Copy>
            {item.available} of {item.capacity} seats available · {item.status}
          </Copy>
          <Copy kind="mono">
            Active member {money(item.memberPricePaise)} · guest{" "}
            {money(item.guestPricePaise)}
          </Copy>
          <Action
            disabled={selected === item.id}
            onPress={() => setSelected(item.id)}
          >
            Select {item.title}
          </Action>
        </Row>
      ))}
      {event && (
        <EventDesk key={event.id} event={event} refresh={events.reload} />
      )}
    </Screen>
  );
}
function EventDesk({
  event,
  refresh,
}: {
  event: EventDetails;
  refresh(): Promise<void>;
}) {
  const { user, client } = useSession();
  const write = useWrite();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [guest, setGuest] = useState<Ticket | null>(null);
  const [version, setVersion] = useState(0);
  const reload = async () => {
    await refresh();
    setVersion((v) => v + 1);
  };
  const guestUrl = guest?.qrToken
    ? `${Platform.OS === "web" ? globalThis.location.origin : process.env.EXPO_PUBLIC_API_URL}/t/${encodeURIComponent(guest.qrToken)}`
    : null;
  return (
    <Row>
      <Copy kind="title">{event.title}</Copy>
      <Copy>{event.description}</Copy>
      <Copy>
        Holds last 30 minutes. Pay a club officer, who will record receipt of
        payment. A pending ticket does not allow admission.
      </Copy>
      <WriteNotice state={write} />
      {user && (
        <Action
          disabled={
            write.busy || event.available < 1 || event.status !== "published"
          }
          onPress={() =>
            void write.run(async () => {
              try {
                const result = await client.request<{ ticket: Ticket }>(
                  `/api/events/${event.id}/tickets`,
                  { method: "POST" },
                );
                write.setNotice(
                  `Reserved at ${money(result.ticket.pricePaise)}. Your ticket is below.`,
                );
              } finally {
                await reload();
              }
            })
          }
        >
          Reserve my ticket
        </Action>
      )}
      <Copy kind="label">Guest booking</Copy>
      <Field
        label="Guest name"
        value={name}
        onChangeText={setName}
        editable={!write.busy}
      />
      <Field
        label="Guest email"
        value={email}
        onChangeText={setEmail}
        editable={!write.busy}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Action
        disabled={
          write.busy ||
          name.trim().length < 2 ||
          !email.trim() ||
          event.available < 1 ||
          event.status !== "published"
        }
        onPress={() =>
          void write.run(async () => {
            try {
              const result = await client.request<{ ticket: Ticket }>(
                `/api/events/${event.id}/guest-tickets`,
                { method: "POST", body: JSON.stringify({ name, email }) },
              );
              setGuest(result.ticket);
              setName("");
              setEmail("");
            } finally {
              await reload();
            }
          })
        }
      >
        Reserve guest ticket
      </Action>
      {guest && (
        <Row>
          <Copy>
            Guest ticket · {guest.status} · {money(guest.pricePaise)}
          </Copy>
          <PassCode token={guest.qrToken} code={guest.shortCode} />
          {guestUrl && (
            <>
              <Copy selectable>Save this private ticket link: {guestUrl}</Copy>
              <Action onPress={() => void Linking.openURL(guestUrl)}>
                Open guest ticket
              </Action>
            </>
          )}
        </Row>
      )}
      {user && (
        <TicketList key={version} eventId={event.id} refresh={refresh} />
      )}
      {user?.permissions.includes("tickets:check_in") && (
        <Door eventId={event.id} eventTitle={event.title} />
      )}
    </Row>
  );
}
function TicketList({
  eventId,
  refresh,
}: {
  eventId: string;
  refresh(): Promise<void>;
}) {
  const { user } = useSession();
  const officer = user?.permissions.includes("payments:confirm");
  const tickets = useResource<{ tickets: Ticket[] }>(
    officer ? `/api/events/${eventId}/tickets` : "/api/tickets/mine",
  );
  return (
    <Row>
      <Copy kind="title">
        {officer ? "Event ticket register" : "My tickets"}
      </Copy>
      <ErrorNotice error={tickets.error} />
      <Action onPress={() => void tickets.reload()}>Refresh tickets</Action>
      {tickets.loading && !tickets.data && <LoadingRows />}
      {tickets.data?.tickets.filter((t) => t.eventId === eventId).length ===
        0 && <Copy>No tickets for this event.</Copy>}
      {tickets.data?.tickets
        .filter((t) => t.eventId === eventId)
        .map((ticket) => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            refresh={async () => {
              await tickets.reload();
              await refresh();
            }}
          />
        ))}
    </Row>
  );
}
export function TicketRow({
  ticket,
  refresh,
}: {
  ticket: Ticket;
  refresh(): Promise<void>;
}) {
  const { client, user } = useSession();
  const write = useWrite();
  const [reference, setReference] = useState("");
  const officer = user?.permissions.includes("payments:confirm");
  const act = (action: string) =>
    write.run(async () => {
      try {
        await client.request(`/api/tickets/${ticket.id}/${action}`, {
          method: "POST",
          body: JSON.stringify(action === "confirm" ? { reference } : {}),
        });
      } finally {
        await refresh();
      }
    });
  return (
    <Row>
      <Copy kind="label">
        {ticket.holderName} · {ticket.status}
      </Copy>
      <Copy kind="mono">
        {money(ticket.pricePaise)} · fixed {ticket.pricing} price
      </Copy>
      <PassCode token={ticket.qrToken} code={ticket.shortCode} />
      {ticket.status === "pending_payment" && ticket.holdExpiresAt && (
        <Copy>
          Hold until {new Date(ticket.holdExpiresAt).toLocaleString()}
        </Copy>
      )}
      {ticket.status === "expired" && <Copy>Hold expired, rebook.</Copy>}
      {ticket.checkedInAt && (
        <Copy>Admitted {new Date(ticket.checkedInAt).toLocaleString()}</Copy>
      )}
      <WriteNotice state={write} />
      {ticket.status === "pending_payment" && (
        <>
          {officer && (
            <>
              <Field
                label="Ticket payment reference"
                value={reference}
                onChangeText={setReference}
                editable={!write.busy}
              />
              <Action
                disabled={write.busy || reference.trim().length < 3}
                onPress={() => void act("confirm")}
              >
                Record ticket payment received
              </Action>
            </>
          )}
          {(officer || ticket.memberId === user?.id) && (
            <Action disabled={write.busy} onPress={() => void act("cancel")}>
              Cancel ticket hold
            </Action>
          )}
        </>
      )}
    </Row>
  );
}
