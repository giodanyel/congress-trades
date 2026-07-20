// Simplified Capitol dome silhouette with an upward trend line rising
// through it -- the two things this app is actually about. Drawn as plain
// geometry (no external image) so it stays crisp at any size and themes
// with the brand color automatically.
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" className="fill-brand-soft" />
      {/* Capitol dome + base */}
      <path
        d="M20 8c-2.2 0-4 2.3-4 5.2v.8h8v-.8c0-2.9-1.8-5.2-4-5.2z"
        className="fill-brand"
      />
      <rect x="19" y="6" width="2" height="3" className="fill-brand" />
      <path d="M12 17h16l-1.5 3h-13L12 17z" className="fill-brand" />
      <rect x="13" y="20" width="2.4" height="8" className="fill-brand" />
      <rect x="17" y="20" width="2.4" height="8" className="fill-brand" />
      <rect x="20.6" y="20" width="2.4" height="8" className="fill-brand" />
      <rect x="24.2" y="20" width="2.4" height="8" className="fill-brand" />
      <rect x="11" y="28" width="18" height="2.4" className="fill-brand" />
      {/* Upward trend line rising through the dome */}
      <path
        d="M7 26l6-7 5 4 8-11 6 5"
        stroke="currentColor"
        className="text-emerald-500"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M27 11l5 6-6.5 1.5L27 11z" className="fill-emerald-500" />
    </svg>
  );
}
