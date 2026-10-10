import { useState } from "react";
import type { Member, ExpiringMember } from "../generated/contracts";
import { useResource } from "../lib/use-resource";
import { useSession } from "../lib/session";
import { Action, Copy, ErrorNotice, LoadingRows, Row } from "./ui";
import { Field, useWrite, WriteNotice } from "./forms";
export function MembershipDesk() {
  const members = useResource<{ members: Member[] }>("/api/members");
  const expiring = useResource<{ members: ExpiringMember[] }>(
    "/api/membership/expiring",
  );
  const { user, client } = useSession();
  const write = useWrite();
  return (
    <Row>
      <Copy kind="title">Membership desk</Copy>
      <ErrorNotice error={members.error ?? expiring.error} />
      <Action
        onPress={() => {
          void members.reload();
          void expiring.reload();
        }}
      >
        Refresh members
      </Action>
      {members.loading && !members.data && <LoadingRows />}
      {members.data?.members.map((member) => (
        <DuesRow
          key={member.id}
          member={member}
          refresh={async () => {
            await members.reload();
            await expiring.reload();
          }}
        />
      ))}
      <Copy kind="label">Renewals due within 30 days</Copy>
      {expiring.data?.members.length === 0 && (
        <Copy>No renewals due in this window.</Copy>
      )}
      {expiring.data?.members.map((member) => (
        <Copy key={member.id}>
          {member.name} · {member.expiresOn} · {member.daysLeft} days left
        </Copy>
      ))}
      <WriteNotice state={write} />
      {user?.permissions.includes("membership:reminders") && (
        <Action
          disabled={write.busy}
          onPress={() =>
            void write.run(async () => {
              await client.request("/api/membership/reminders/run", {
                method: "POST",
                body: JSON.stringify({ days: 30 }),
              });
              write.setNotice(
                "Renewal reminders queued in-app with simulated outbox delivery. No email was sent.",
              );
            })
          }
        >
          Queue renewal reminders
        </Action>
      )}
    </Row>
  );
}
function DuesRow({
  member,
  refresh,
}: {
  member: Member;
  refresh(): Promise<void>;
}) {
  const { user, client } = useSession();
  const [reference, setReference] = useState("");
  const write = useWrite();
  return (
    <Row>
      <Copy kind="label">{member.name}</Copy>
      <Copy>
        {member.email} · {member.membership} · {member.duesStatus}
      </Copy>
      {member.expiresOn && <Copy>Through {member.expiresOn}</Copy>}
      {user?.permissions.includes("membership:record_payment") && (
        <>
          <Field
            label={`Dues reference for ${member.name}`}
            value={reference}
            onChangeText={setReference}
            editable={!write.busy}
          />
          <WriteNotice state={write} />
          <Action
            disabled={write.busy || reference.trim().length < 3}
            onPress={() =>
              void write.run(async () => {
                await client.request("/api/membership/dues", {
                  method: "POST",
                  body: JSON.stringify({ memberId: member.id, reference }),
                });
                write.setNotice(
                  "Dues recorded. Reusing this reference will not charge dues twice.",
                );
                await refresh();
              })
            }
          >
            Record dues received / renew
          </Action>
        </>
      )}
    </Row>
  );
}
