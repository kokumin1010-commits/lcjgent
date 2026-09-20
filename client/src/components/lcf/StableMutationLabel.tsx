import type { ReactNode } from "react";

export function StableMutationLabel({ pending, pendingContent, idleContent }: {
  pending: boolean;
  pendingContent: ReactNode;
  idleContent: ReactNode;
}) {
  return (
    <span className="inline-grid" aria-live="polite">
      <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${pending ? "visible" : "invisible"}`} aria-hidden={!pending}>
        {pendingContent}
      </span>
      <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${pending ? "invisible" : "visible"}`} aria-hidden={pending}>
        {idleContent}
      </span>
    </span>
  );
}
