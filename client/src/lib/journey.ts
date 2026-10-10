import type { ScanResult, TaskDetails } from "../generated/contracts";

export function amountPaise(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error(
      "Enter a positive rupee amount with at most two decimal places.",
    );
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Enter a valid positive amount.");
  return amount;
}
export function doorTone(
  result: ScanResult,
): "verified" | "pending" | "overdue" {
  return result.outcome === "admitted"
    ? "verified"
    : result.outcome === "member_no_ticket"
      ? "pending"
      : "overdue";
}
export function taskProgress(tasks: TaskDetails[]) {
  const done = tasks.filter((task) => task.status === "done").length;
  const overdue = tasks.filter(
    (task) => task.status !== "done" && task.overdue,
  ).length;
  return {
    total: tasks.length,
    done,
    overdue,
    onTrack: tasks.length - overdue,
  };
}
