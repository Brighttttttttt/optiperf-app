"use client";

import { useState } from "react";
import { FreeSessionForm } from "./FreeSessionForm";
import { ImportActivityForm } from "./ImportActivityForm";
import { IconPlus } from "./Icons";
import { btnGhost } from "@/lib/styles";
import type { TrainingSession } from "@/lib/types";

type Etape = "ferme" | "choix" | "libre" | "fichier";

/**
 * Point d'entrée unique pour ajouter une séance déjà faite : saisie libre ou
 * dépôt d'un fichier de montre sont deux comptes rendus de la même chose, pas
 * deux fonctionnalités distinctes — un seul bouton, puis le choix.
 */
export function AddSessionSheet({ sessions }: { sessions: TrainingSession[] }) {
  const [etape, setEtape] = useState<Etape>("ferme");

  if (etape === "ferme") {
    return (
      <button
        type="button"
        onClick={() => setEtape("choix")}
        className={`${btnGhost} w-full py-3`}
      >
        <IconPlus className="size-4" />
        Ajouter une séance
      </button>
    );
  }

  if (etape === "libre") {
    return (
      <FreeSessionForm
        onCancel={() => setEtape("choix")}
        onDone={() => setEtape("ferme")}
      />
    );
  }

  if (etape === "fichier") {
    return (
      <ImportActivityForm
        sessions={sessions}
        onCancel={() => setEtape("choix")}
        onDone={() => setEtape("ferme")}
      />
    );
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4">
      <p className="font-display text-[18px] font-semibold uppercase tracking-wide">
        Ajouter une séance
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setEtape("libre")}
          className="rounded-xl border border-line bg-card px-3 py-3 text-left transition-colors hover:border-pine/40"
        >
          <span className="block font-semibold">Séance libre</span>
          <span className="block text-[12px] text-ink-soft">Je saisis à la main</span>
        </button>
        <button
          type="button"
          onClick={() => setEtape("fichier")}
          className="rounded-xl border border-line bg-card px-3 py-3 text-left transition-colors hover:border-pine/40"
        >
          <span className="block font-semibold">Fichier de montre</span>
          <span className="block text-[12px] text-ink-soft">GPX ou TCX</span>
        </button>
      </div>
      <button
        type="button"
        onClick={() => setEtape("ferme")}
        className={`${btnGhost} mt-3 w-full`}
      >
        Annuler
      </button>
    </div>
  );
}
