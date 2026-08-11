import { setViewMode } from "@/app/(app)/actions";
import type { ViewMode } from "@/lib/view-mode";

const MODES: { value: ViewMode; label: string }[] = [
  { value: "coach", label: "Je coache" },
  { value: "athlete", label: "Je m'entraîne" },
];

/**
 * Bascule du coach entre encadrer et s'entraîner (issue #62).
 *
 * Rendue en haut de chaque page et non dans un réglage : « se croire dans le
 * mauvais mode est la pire issue » — le mode actif doit se lire sans avoir à
 * le chercher. Deux boutons plutôt qu'un interrupteur, pour que l'état soit
 * nommé en toutes lettres au lieu de se deviner à une position.
 *
 * Un formulaire par mode, sans état client : la bascule survit au
 * rechargement parce qu'elle vit dans un cookie, pas dans le navigateur.
 */
export function ViewModeSwitch({ mode }: { mode: ViewMode }) {
  return (
    <nav
      aria-label="Vue"
      className="flex gap-1 rounded-full bg-surface p-1 border border-line"
    >
      {MODES.map((m) => {
        const actif = m.value === mode;
        return (
          <form key={m.value} action={setViewMode} className="contents">
            <input type="hidden" name="mode" value={m.value} />
            <button
              type="submit"
              aria-current={actif ? "true" : undefined}
              // Le mode actif n'est pas cliquable : il n'y a rien à y faire,
              // et le désactiver dit mieux « tu es ici » qu'un simple fond.
              disabled={actif}
              className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${
                actif
                  ? "bg-card text-pine shadow-sm"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          </form>
        );
      })}
    </nav>
  );
}
