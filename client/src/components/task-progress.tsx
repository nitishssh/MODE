import type { TaskDetails } from "../generated/contracts";
import { taskProgress } from "../lib/journey";
import { Copy, Row } from "./ui";
export function TaskProgress({ tasks }: { tasks: TaskDetails[] }) {
  const progress = taskProgress(tasks);
  return (
    <Row>
      <Copy kind="label">Team progress</Copy>
      <Copy>
        {progress.done} of {progress.total} complete · {progress.overdue}{" "}
        overdue
      </Copy>
      <Copy>
        On track: {progress.onTrack} of {progress.total}. On track means
        completed or not yet overdue; tasks without a deadline are not overdue.
      </Copy>
    </Row>
  );
}
