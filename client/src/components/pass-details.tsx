import type { Ticket, MerchOrder } from "../generated/contracts";
import { useResource } from "../lib/use-resource";
import { useSession } from "../lib/session";
import { Action, Copy, ErrorNotice, Row, money } from "./ui";
import { MembershipDesk } from "./membership";
import { TicketRow } from "./events";
export function PassDetails() {
  const { user } = useSession();
  const tickets = useResource<{ tickets: Ticket[] }>("/api/tickets/mine");
  const orders = useResource<{ orders: MerchOrder[] }>("/api/orders/mine");
  return (
    <>
      <Copy kind="title">My tickets</Copy>
      <ErrorNotice error={tickets.error ?? orders.error} />
      <Action
        onPress={() => {
          void tickets.reload();
          void orders.reload();
        }}
      >
        Refresh tickets and orders
      </Action>
      {tickets.data?.tickets.length === 0 && (
        <Copy>No tickets yet. Open Events to reserve a seat.</Copy>
      )}
      {tickets.data?.tickets.map((ticket) => (
        <TicketRow key={ticket.id} ticket={ticket} refresh={tickets.reload} />
      ))}
      <Copy kind="title">My merchandise</Copy>
      {orders.data?.orders.length === 0 && (
        <Copy>No merchandise orders yet.</Copy>
      )}
      {orders.data?.orders.map((order) => (
        <Row key={order.id}>
          <Copy>
            {order.productName} · {order.size} × {order.quantity}
          </Copy>
          <Copy>
            {order.status} · {money(order.totalPaise)}
          </Copy>
          {order.status === "pending_payment" && order.holdExpiresAt && (
            <Copy>
              Hold until {new Date(order.holdExpiresAt).toLocaleString()}
            </Copy>
          )}
          <Copy>Manage your order in Shop.</Copy>
        </Row>
      ))}
      {user?.permissions.includes("members:read") && <MembershipDesk />}
    </>
  );
}
