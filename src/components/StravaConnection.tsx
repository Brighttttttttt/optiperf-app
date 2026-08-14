"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deconnecterStrava } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { formatDayLong } from "@/lib/dates";

/**
 * Le lien vers Strava, dans les réglages de l'athlète (#105).
 *
 * Le bouton est un **lien** et non un formulaire : la CSP pose
 * `form-action 'self'`, qui interdirait de poster vers `strava.com`.
 *
 * Le libellé « Se connecter avec Strava » et la mention « Powered by Strava »
 * font partie des conditions d'utilisation de leur API, pas du confort.
 */
export function StravaConnection({
  connectee,
  depuis,
  indisponible,
  message,
}: {
  connectee: boolean;
  /** Date de connexion, en ISO. */
  depuis: string | null;
  /** Les identifiants d'API ne sont pas configurés sur cet environnement. */
  indisponible: boolean;
  message: string | null;
}) {
  const [state, action] = useActionState(deconnecterStrava, null);

  return (
    <div>
      <p className="font-semibold">Strava</p>

      {message && (
        <p
          className={`mt-1 text-[13px] font-medium ${
            message.startsWith("Compte Strava connecté") ? "text-pine" : "text-rpe-max"
          }`}
        >
          {message}
        </p>
      )}

      {connectee ? (
        <>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Ton compte est relié
            {depuis && ` depuis le ${formatDayLong(depuis)}`}. Optiperf ne
            synchronise encore aucune activité : continue de déposer tes
            fichiers à la main.
          </p>
          {state?.error && (
            <p className="mt-2 text-[13px] font-medium text-rpe-max">{state.error}</p>
          )}
          <form action={action} className="mt-3">
            <SubmitButton
              className="bg-card px-3 py-2 text-[14px] text-ink-soft hover:text-rpe-max"
              pendingText="Déconnexion…"
            >
              Déconnecter Strava
            </SubmitButton>
          </form>
        </>
      ) : indisponible ? (
        <p className="mt-0.5 text-[13px] text-ink-soft">
          La connexion Strava n&apos;est pas configurée sur cet environnement.
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Relie ton compte pour préparer l&apos;import automatique. Rien
            n&apos;est synchronisé pour l&apos;instant, et ton coach ne voit
            pas cette connexion.
          </p>
          <Link
            href="/auth/strava/connexion"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#FC4C02] px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Se connecter avec Strava
          </Link>
          <p className="mt-2 text-[12px] text-ink-soft">Powered by Strava</p>
        </>
      )}
    </div>
  );
}
