/**
 * Discreet developer badge shown only while the ?player=vjs feature flag is on.
 * Helps QA confirm at a glance which player is rendering.
 */
export function NewPlayerBadge({ surface }: { surface: string }) {
  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-[9999] rounded-md bg-primary/90 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-primary-foreground shadow"
      aria-hidden
    >
      VJS · {surface}
    </div>
  );
}

export default NewPlayerBadge;
