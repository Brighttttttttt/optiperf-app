"use client";

import { useRef, useState } from "react";
import { chargerPlanning } from "@/app/(app)/actions";
import {
  etendreFenetre,
  fenetreManquante,
  type FenetreDates,
} from "@/lib/planning";
import type { AnalyseSeance } from "@/lib/analyse-seance";
import type {
  Exercise,
  ExerciseLog,
  TrainingSession,
  WorkoutBlock,
} from "@/lib/types";

/**
 * Les séances d'une période, en allant chercher ce qui manque (#141).
 *
 * La page charge une fenêtre large pour que la navigation ordinaire n'attende
 * jamais le serveur. Au-delà, la vue affichait des jours vides
 * indistinguables de jours libres — une séance importée d'une sortie
 * ancienne n'apparaissait nulle part.
 *
 * Partagé par la grille du mois et les courbes : deux implémentations
 * divergeraient, et l'une des deux finirait par mentir sur ce qu'elle sait.
 */
export type ContenuPlanning = {
  sessions: TrainingSession[];
  blocksBySession: Record<string, WorkoutBlock[]>;
  exercisesBySession: Record<string, Exercise[]>;
  logsBySession: Record<string, ExerciseLog[]>;
  analysesBySession: Record<string, AnalyseSeance>;
};

export function useFenetrePlanning(
  athleteId: string,
  initial: ContenuPlanning,
  fenetre: FenetreDates
) {
  /**
   * Ce qui a été ramené en plus, gardé à part des props : celles-ci se
   * renouvellent à chaque revalidation du serveur, et un état qui les
   * recopierait perdrait ce qu'on est allé chercher.
   */
  const [charge, setCharge] = useState<ContenuPlanning & { fenetre: FenetreDates }>(
    () => ({
      fenetre,
      sessions: [],
      blocksBySession: {},
      exercisesBySession: {},
      logsBySession: {},
      analysesBySession: {},
    })
  );
  const [chargement, setChargement] = useState(false);
  /** Les demandes déjà parties, pour n'en jamais rejouer une à l'identique. */
  const demandees = useRef(new Set<string>());

  /**
   * Complète la fenêtre pour couvrir `periode`, si besoin.
   *
   * À appeler depuis le geste de navigation et non depuis un effet : c'est la
   * navigation qui révèle le manque, et un effet qui poserait un état à
   * chaque rendu est précisément ce que `react-hooks/set-state-in-effect`
   * interdit dans ce dépôt.
   */
  async function assurer(periode: FenetreDates) {
    const manque = fenetreManquante(charge.fenetre, periode);
    if (!manque) return;

    // Une même tranche ne se redemande pas, même si elle n'a rien rendu : une
    // période réellement vide doit le rester sans rejouer la requête à chaque
    // aller-retour entre deux mois.
    const cle = `${manque.debut}→${manque.fin}`;
    if (demandees.current.has(cle)) return;
    demandees.current.add(cle);

    setChargement(true);
    try {
      const recu = await chargerPlanning(athleteId, manque.debut, manque.fin);
      setCharge((etat) => ({
        fenetre: etendreFenetre(etat.fenetre, manque),
        sessions: [...etat.sessions, ...(recu?.sessions ?? [])],
        blocksBySession: {
          ...etat.blocksBySession,
          ...(recu?.blocksBySession ?? {}),
        },
        exercisesBySession: {
          ...etat.exercisesBySession,
          ...(recu?.exercisesBySession ?? {}),
        },
        logsBySession: { ...etat.logsBySession, ...(recu?.logsBySession ?? {}) },
        analysesBySession: {
          ...etat.analysesBySession,
          ...(recu?.analysesBySession ?? {}),
        },
      }));
    } finally {
      setChargement(false);
    }
  }

  return {
    sessions: [...initial.sessions, ...charge.sessions],
    blocksBySession: { ...initial.blocksBySession, ...charge.blocksBySession },
    exercisesBySession: {
      ...initial.exercisesBySession,
      ...charge.exercisesBySession,
    },
    logsBySession: { ...initial.logsBySession, ...charge.logsBySession },
    analysesBySession: {
      ...initial.analysesBySession,
      ...charge.analysesBySession,
    },
    chargement,
    assurer,
  };
}
