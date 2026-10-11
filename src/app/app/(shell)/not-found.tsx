import { EmptyState, LinkButton } from "../_components/ui";

export default function NotFound() {
  return (
    <section className="panel">
      <EmptyState title="There is nothing at this address" action={<LinkButton href="/app" variant="primary">Back to overview</LinkButton>}>
        The page may have moved, or the record belongs to another club.
      </EmptyState>
    </section>
  );
}
