import { cookies } from "next/headers";
import { cache } from "react";
import { getSessionProfile } from "./supabase/session";
import type { Profile, Role } from "./types";

/**
 * Ce que l'app montre à un compte : encadrer, ou s'entraîner.
 *
 * Distinct du **rôle**, qui reste unique en base et ne change pas. Un coach
 * s'entraîne aussi (issue #62) : il bascule entre les deux vues sans changer
 * de compte, et sans que rien ne bouge côté données — la RLS et le trigger
 * `enforce_session_ownership` raisonnent déjà par séance, pas par personne.
 *
 * Un athlète n'a qu'un mode : la bascule ne lui est jamais proposée, et
 * forcer le cookie ne lui ouvrirait rien (voir `resolveViewMode`).
 */
export type ViewMode = Role;

export const VIEW_MODE_COOKIE = "optiperf-vue";

/** Un an : la bascule est un réglage durable, pas un état de session. */
export const VIEW_MODE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Le mode réellement applicable, en dernier ressort.
 *
 * Le cookie est une préférence d'affichage, pas un droit : seul un compte
 * `coach` peut demander autre chose que son rôle. Un athlète qui poserait
 * `optiperf-vue=coach` à la main retomberait ici sur `athlete` — et n'y
 * gagnerait rien de toute façon, la RLS ne lui montrant aucun athlète.
 */
export function resolveViewMode(
  role: Role,
  cookieValue: string | undefined
): ViewMode {
  if (role !== "coach") return role;
  return cookieValue === "athlete" ? "athlete" : "coach";
}

/** Mode de la requête en cours. Mémorisé : la mise en page et la page le demandent. */
export const getViewMode = cache(async (): Promise<ViewMode> => {
  const profile = await getSessionProfile();
  if (!profile) return "athlete";
  const store = await cookies();
  return resolveViewMode(profile.role, store.get(VIEW_MODE_COOKIE)?.value);
});

/** Vrai quand la bascule a un sens — donc pour un coach seulement. */
export function canSwitchView(profile: Pick<Profile, "role"> | null): boolean {
  return profile?.role === "coach";
}
