import { useState } from "react";
import type { ExpenseLedgerEntry, LedgerSource } from "../generated/contracts";
import { usePagedList } from "../lib/use-paged-list";
import { useSession } from "../lib/session";
import { savePrivateFile } from "../lib/files";
import { Action, ActionGroup, Copy, LoadingRows, Row, money } from "./ui";
import { useWrite, WriteNotice } from "./forms";
import { ListFilters, ListPageControls } from "./list-pagination";

export function Ledger() {
  const entries = usePagedList<ExpenseLedgerEntry>("ledger");
  const { client } = useSession();
  const write = useWrite();
  return (
    <Row>
      <Copy kind="title">Ledger entries</Copy>
      <ListFilters key={entries.filterKey} kind="ledger" query={entries.query} update={entries.updateFilters} clear={entries.clearFilters} />
      <ListPageControls page={entries.data} loading={entries.loading} error={entries.error} time={entries.time} cursor={entries.query.cursor} next={entries.next} restart={entries.restart} reload={entries.reload} queryError={entries.query.error} />
      <WriteNotice state={write} />
      <ActionGroup>
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
          Export all ledger entries CSV
        </Action>
      </ActionGroup>
      <Copy>The totals above and CSV cover the whole ledger. These filters apply to the entries below.</Copy>
      {entries.loading && !entries.data && <LoadingRows />}
      {entries.data?.items.length === 0 && <Copy>No ledger entries match this page and its filters.</Copy>}
      {entries.data?.items.map((entry) => (
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
