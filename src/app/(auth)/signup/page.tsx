"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signup } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { inputClass, labelClass } from "@/lib/styles";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "athlete", label: "Athlète", hint: "Je suis un programme" },
  { value: "coach", label: "Coach", hint: "J'entraîne des athlètes" },
];

export default function SignupPage() {
  const [state, action] = useActionState(signup, null);
  const [role, setRole] = useState<Role>("athlete");

  return (
    <div>
      <h1 className="font-display text-[34px] leading-9 font-semibold uppercase tracking-wide">
        Créer un compte
      </h1>
      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Rôle">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={role === r.value}
              onClick={() => setRole(r.value)}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                role === r.value
                  ? "border-pine bg-pine-soft"
                  : "border-line bg-card hover:border-pine/40"
              }`}
            >
              <span className="block font-semibold">{r.label}</span>
              <span className="block text-[12px] text-ink-soft">{r.hint}</span>
            </button>
          ))}
        </div>
        <div>
          <label className={labelClass} htmlFor="full_name">
            Nom complet
          </label>
          <input
            id="full_name"
            name="full_name"
            autoComplete="name"
            required
            className={inputClass}
          />
        </div>
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
            autoComplete="new-password"
            minLength={8}
            required
            className={inputClass}
          />
        </div>
        {role === "athlete" && (
          <div>
            <label className={labelClass} htmlFor="invite_code">
              Code coach{" "}
              <span className="font-normal text-ink-soft">(optionnel)</span>
            </label>
            <input
              id="invite_code"
              name="invite_code"
              placeholder="Ex. A3F2C1"
              autoCapitalize="characters"
              className={`${inputClass} uppercase tracking-[0.2em] font-display`}
            />
            <p className="mt-1.5 text-[12px] text-ink-soft">
              Ton coach te l&apos;a partagé ? Tu peux aussi l&apos;ajouter plus
              tard dans Réglages.
            </p>
          </div>
        )}
        {state?.error && (
          <p className="text-sm font-medium text-rpe-max">{state.error}</p>
        )}
        {state?.info && (
          <p className="text-sm font-medium text-pine">{state.info}</p>
        )}
        <SubmitButton className="w-full">Créer mon compte</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Déjà inscrit ?{" "}
        <Link href="/login" className="font-semibold text-pine">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
