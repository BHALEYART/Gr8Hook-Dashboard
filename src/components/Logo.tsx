/** Gr8 Hook mark + wordmark. Follows the theme unless `dark` forces white ink (for always-dark backgrounds). */
export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const ink = dark ? "#FFFFFF" : "var(--ink)";
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Gr8 Hook">
      <svg width="20" height="28" viewBox="0 0 100 140" fill="none" aria-hidden="true">
        <circle cx="50" cy="17" r="10" strokeWidth="9" style={{ stroke: ink }} />
        <circle cx="50" cy="40" r="13" strokeWidth="9" style={{ stroke: ink }} />
        <path d="M50 53 L50 100 A22 22 0 0 1 6 100 L6 80 L17 90" stroke="#FF5A36" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span className="font-display text-lg font-extrabold tracking-tight" style={{ color: ink }}>
          Gr<span className="text-coral">8</span> Hook
        </span>
      )}
    </span>
  );
}
