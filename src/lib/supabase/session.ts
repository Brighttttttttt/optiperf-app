import { cache } from "react";
import { createClient } from "./server";
import type { Profile } from "@/lib/types";

export type SessionUser = { id: string; email: string | null };

/**
 * Utilisateur de la requête en cours, déduit du jeton.
 *
 * `getClaims()` vérifie la signature **localement** grâce à la clé publique
 * du projet (ES256), là où `getUser()` interroge Supabase à chaque appel :
 * 1 ms contre ~100 ms mesurés. Un jeton falsifié est rejeté de la même
 * façon — la vérification est réelle, pas une simple lecture.
 *
 * Contrepartie assumée : un jeton reste valide jusqu'à son expiration. Un
 * compte supprimé entre-temps ne verrait rien pour autant, ses données
 * ayant disparu en cascade et la sécurité RLS s'appliquant toujours.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

/** Profil de l'utilisateur courant. Mémorisé : la mise en page et la page
 *  qu'elle enveloppe le demandent toutes les deux. */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  return data;
});
