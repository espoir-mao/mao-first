interface FlagProps {
  lang: "fr" | "en";
  className?: string;
}

/**
 * Small inline SVG flag icons for the language toggle.
 *
 * Plain emoji flags (🇫🇷/🇬🇧) rely on regional-indicator Unicode sequences
 * that many Linux/Windows browser+font combinations don't render — they
 * show blank boxes, "FR"/"GB" fallback text, or nothing at all. Drawing the
 * flags as inline SVG instead guarantees they always render, regardless of
 * the OS/browser's emoji font support, with no network/image dependency.
 */
export default function Flag({ lang, className }: FlagProps) {
  if (lang === "fr") {
    return (
      <svg
        width="20"
        height="14"
        viewBox="0 0 20 14"
        className={className}
        aria-hidden="true"
      >
        <rect width="20" height="14" fill="#fff" />
        <rect width="7" height="14" fill="#002395" />
        <rect x="13" width="7" height="14" fill="#ED2939" />
      </svg>
    );
  }

  // Simplified Union Jack: a diagonal+cross arrangement on a blue field,
  // recognisable as "UK/English" at a glance without full heraldic detail.
  return (
    <svg
      width="20"
      height="14"
      viewBox="0 0 20 14"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="14" fill="#00247D" />
      {/* White diagonals */}
      <path d="M0 0L20 14M20 0L0 14" stroke="#fff" strokeWidth="2.8" />
      {/* Red diagonals, thinner, offset to suggest the St Patrick's cross */}
      <path d="M0 0L20 14" stroke="#CF142B" strokeWidth="1.2" />
      <path d="M20 0L0 14" stroke="#CF142B" strokeWidth="1.2" />
      {/* White cross */}
      <rect x="8" width="4" height="14" fill="#fff" />
      <rect y="5" width="20" height="4" fill="#fff" />
      {/* Red cross */}
      <rect x="8.8" width="2.4" height="14" fill="#CF142B" />
      <rect y="5.8" width="20" height="2.4" fill="#CF142B" />
    </svg>
  );
}
