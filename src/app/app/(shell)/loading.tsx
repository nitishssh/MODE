import { Skeleton } from "../_components/ui";

export default function Loading() {
  return (
    <div className="mx-stack" aria-busy="true">
      <span className="mx-skel" style={{ width: 260, height: 34 }} />
      <div className="mx-grid mx-grid-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="mx-stat"><Skeleton rows={2} /></div>)}
      </div>
      <div className="mx-card"><Skeleton rows={6} /></div>
    </div>
  );
}
