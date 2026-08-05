"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { inputClass, labelClass } from "@/lib/styles";

/** Isolé dans une frontière Suspense : useSearchParams empêcherait sinon
 *  le prérendu statique de la page de connexion. */
function ConfirmationNotice() {
  if (useSearchParams().get("confirmation") !== "echec") return null;
  return (
    <p className="mt-4 rounded-xl bg-rpe-mid-soft px-3.5 py-3 text-sm font-medium text-rpe-high">
      Ce lien de confirmation a expiré ou a déjà été utilisé. Connecte-toi, ou
      refais une inscription pour en recevoir un nouveau.
    </p>
  );
}

export default function LoginPage() {
  const [state, action] = useActionState(login, null);

  return (
    <div>
      <h1 className="font-display text-[34px] leading-9 font-semibold uppercase tracking-wide">
        Connexion
      </h1>
      <Suspense>
        <ConfirmationNotice />
      </Suspense>
      <form action={action} className="mt-6 space-y-4">
        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
        {state?.error && (
          <p className="text-sm font-medium text-rpe-max">{state.error}</p>
        )}
        <SubmitButton className="w-full">Se connecter</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="font-semibold text-pine">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
