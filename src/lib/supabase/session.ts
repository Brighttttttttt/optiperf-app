import { cache } from "react";
import { createClient } from "./server";
import type { Profile } from "@/lib/types";

/**
 * Utilisateur et profil de la requête en cours.
 *
 * Mémorisés par `cache()` : la mise en page et la page qu'elle enveloppe
 * les demandent toutes les deux, ce qui coûtait deux allers-retours réseau
 * en double sur chaque navigation.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

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
