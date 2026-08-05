"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Fin du parcours de confirmation par email, flux implicite.
 *
 * Supabase renvoie les jetons dans le fragment d'URL (`#access_token=…`),
 * que le navigateur n'envoie jamais au serveur : seule cette page cliente
 * peut les lire. Elle ouvre la session, ce qui pose les cookies lus ensuite
 * par le proxy et les pages serveur.
 */
export default function FinaliserPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      router.replace("/login?confirmation=echec");
      return;
    }

    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setFailed(true);
          router.replace("/login?confirmation=echec");
          return;
        }
        // Efface les jetons de la barre d'adresse avant de continuer.
        window.history.replaceState(null, "", "/auth/finaliser");
        router.replace("/");
      });
  }, [router]);

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <p className="text-sm text-ink-soft" role="status">
        {failed ? "Lien invalide, redirection…" : "Confirmation en cours…"}
      </p>
    </main>
  );
}
