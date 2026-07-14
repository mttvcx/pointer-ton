/**
 * Instant route-transition skeleton for the whole authenticated portal. Next
 * renders this the moment a nav link is clicked (before the page's data
 * resolves), so switching pages feels immediate instead of a blank ~1s wait.
 */
export default function PortalLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded-md bg-white/[0.06]" />
        <div className="h-3.5 w-64 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="creator-glass h-28 animate-pulse rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="creator-glass h-24 animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="creator-glass h-48 animate-pulse rounded-2xl" />
    </div>
  );
}
