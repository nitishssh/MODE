import { useState } from "react";
import type { ExpenseLedgerEntry, LedgerSource } from "../generated/contracts";
import { useResource } from "../lib/use-resource";
import { useSession } from "../lib/session";
import { savePrivateFile } from "../lib/files";
import { Action, Copy, ErrorNotice, LoadingRows, Row, money } from "./ui";
import { useWrite, WriteNotice } from "./forms";

export function Ledger() {
  const entries = useResource<ExpenseLedgerEntry[]>("/api/ledger/entries");
  const { client } = useSession();
  const write = useWrite();
  return (
    <Row>
      <Copy kind="title">Ledger entries</Copy>
      <ErrorNotice error={entries.error} />
      <Action onPress={() => void entries.reload()}>Refresh entries</Action>
      <WriteNotice state={write} />
      <Action
        disabled={write.busy}
        onPress={() =>
          void write.run(() =>
            savePrivateFile(
              client,
              "/api/ledger/export.csv",
              "mode-ledger.csv",
            ),
          )
        }
      >
        Export ledger CSV
      </Action>
      {entries.loading && !entries.data && <LoadingRows />}
      {entries.data?.length === 0 && <Copy>No ledger entries.</Copy>}
      {entries.data?.map((entry) => (
        <Entry key={entry.id} entry={entry} />
      ))}
    </Row>
  );
}
function Entry({ entry }: { entry: ExpenseLedgerEntry }) {
  const { client } = useSession();
  const write = useWrite();
  const [source, setSource] = useState<LedgerSource | null>(null);
  return (
    <Row>
      <Copy kind="label">{entry.description}</Copy>
      <Copy kind="mono">
        {entry.kind === "expense" ? "OUT" : "IN"} {money(entry.amountPaise)}
      </Copy>
      <Copy>
        {new Date(entry.occurredAt).toLocaleString()} · recorded by{" "}
        {entry.recordedByName ?? "Opening balance"}
      </Copy>
      <WriteNotice state={write} />
      {entry.sourceType !== "opening" && entry.sourceId && (
        <Action
          disabled={write.busy}
          onPress={() =>
            void write.run(async () => {
              setSource(
                await client.request<LedgerSource>(
                  `/api/ledger/entries/${entry.id}/source`,
                ),
              );
            })
          }
        >
          Open exact source
        </Action>
      )}
      {source && (
        <Row>
          <Copy kind="label">{source.title}</Copy>
          <Copy selectable>
            {source.type} · {source.id}
          </Copy>
          {source.details.map((detail, i) => (
            <Copy key={i}>
              {detail.label}: {detail.value}
            </Copy>
          ))}
          {source.receiptId && (
            <Action
              disabled={write.busy}
              onPress={() =>
                void write.run(() =>
                  savePrivateFile(
                    client,
                    `/api/receipts/${source.receiptId}`,
                    `receipt-${source.id}`,
                  ),
                )
              }
            >
              Open source receipt
            </Action>
          )}
        </Row>
      )}
    </Row>
  );
}
