/**
 * Réponse immédiate pendant qu'une page se prépare : sans elle, une
 * navigation d'un tiers de seconde est perçue comme un blocage.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-hidden>
      <header className="px-5 pt-6 pb-4">
        <div className="h-3 w-24 rounded bg-line" />
        <div className="mt-2 h-8 w-48 rounded bg-line" />
      </header>
      <div className="px-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-card p-4">
            <div className="h-4 w-32 rounded bg-line" />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((j) => (
                <div key={j}>
                  <div className="h-6 rounded bg-line" />
                  <div className="mt-1 h-2 w-3/4 rounded bg-line/70" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
