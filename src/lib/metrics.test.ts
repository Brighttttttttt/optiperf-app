import { describe, expect, it } from "vitest";
import { computeMetrics, monthlyWeeklySeries, sessionLoad } from "./metrics";
import { lundisDuMois } from "./mois";
import type { TrainingSession } from "./types";

// 10 h heure de Paris un mercredi : les fenêtres 7 j / 28 j sont stables.
const NOW = new Date("2026-08-05T10:00:00+02:00");

let seq = 0;
function session(partial: Partial<TrainingSession>): TrainingSession {
  return {
    id: `s-${++seq}`,
    athlete_id: "athlete-1",
    coach_id: "coach-1",
    date: "2026-08-04",
    title: "Séance",
    type: "endurance",
    description: null,
    duration_planned_min: 60,
    status: "completed",
    duration_actual_min: 60,
    rpe: 5,
    athlete_comment: null,
    completed_at: null,
    created_at: "2026-08-01T10:00:00Z",
    ...partial,
  };
}

describe("sessionLoad", () => {
  it("multiplie RPE par la durée réelle (méthode Foster)", () => {
    expect(sessionLoad(session({ rpe: 7, duration_actual_min: 60 }))).toBe(420);
  });

  it("retombe sur la durée prévue si la durée réelle manque", () => {
    expect(
      sessionLoad(
        session({ rpe: 6, duration_actual_min: null, duration_planned_min: 45 })
      )
    ).toBe(270);
  });

  it("vaut zéro pour une séance non complétée", () => {
    expect(sessionLoad(session({ status: "planned" }))).toBe(0);
    expect(sessionLoad(session({ status: "missed" }))).toBe(0);
  });
});

describe("computeMetrics", () => {
  it("somme le volume des 7 derniers jours, séances complétées uniquement", () => {
    const m = computeMetrics(
      [
        session({ date: "2026-08-04", duration_actual_min: 60 }),
        session({ date: "2026-07-30", duration_actual_min: 45 }),
        session({ date: "2026-08-03", status: "missed" }),
        // hors fenêtre : il y a 8 jours
        session({ date: "2026-07-28", duration_actual_min: 90 }),
      ],
      NOW
    );
    expect(m.weeklyVolumeMin).toBe(105);
  });

  it("calcule l'adhérence sur les séances planifiées par le coach (28 j)", () => {
    const m = computeMetrics(
      [
        session({ date: "2026-08-01", status: "completed" }),
        session({ date: "2026-07-25", status: "completed" }),
        session({ date: "2026-07-20", status: "missed" }),
        // séance libre : n'entre pas dans l'adhérence
        session({ date: "2026-07-22", coach_id: null }),
      ],
      NOW
    );
    expect(m.adherencePct).toBe(67);
  });

  it("rend l'adhérence nulle sans séance planifiée par le coach", () => {
    const m = computeMetrics([session({ date: "2026-08-01", coach_id: null })], NOW);
    expect(m.adherencePct).toBeNull();
  });

  it("arrondit le RPE moyen à une décimale", () => {
    const m = computeMetrics(
      [
        session({ date: "2026-08-04", rpe: 6 }),
        session({ date: "2026-08-03", rpe: 7 }),
        session({ date: "2026-08-02", rpe: 7 }),
      ],
      NOW
    );
    expect(m.avgRpe).toBe(6.7);
  });

  it("signale « fatigué » quand toute la charge est récente (ACWR > 1,3)", () => {
    const m = computeMetrics(
      [
        session({ date: "2026-08-04", rpe: 9, duration_actual_min: 90 }),
        session({ date: "2026-08-02", rpe: 9, duration_actual_min: 90 }),
      ],
      NOW
    );
    // charge aiguë = charge totale, chronique = totale / 4 → ratio 4
    expect(m.status).toBe("fatigue");
  });

  it("signale « frais » quand la semaine est allégée (ACWR < 0,8)", () => {
    const sessions = [
      // 4 grosses semaines passées, hors fenêtre 7 j
      session({ date: "2026-07-10", rpe: 8, duration_actual_min: 120 }),
      session({ date: "2026-07-14", rpe: 8, duration_actual_min: 120 }),
      session({ date: "2026-07-18", rpe: 8, duration_actual_min: 120 }),
      session({ date: "2026-07-24", rpe: 8, duration_actual_min: 120 }),
      // semaine en cours très légère
      session({ date: "2026-08-04", rpe: 3, duration_actual_min: 30 }),
    ];
    expect(computeMetrics(sessions, NOW).status).toBe("frais");
  });

  it("reste « inconnu » sans aucun historique de charge", () => {
    const m = computeMetrics([session({ date: "2026-08-04", status: "planned" })], NOW);
    expect(m.status).toBe("inconnu");
  });
});

describe("monthlyWeeklySeries", () => {
  const lundisAout = lundisDuMois("2026-08");

  it("rend une entrée par ligne de la grille du mois", () => {
    const series = monthlyWeeklySeries([], lundisAout);
    expect(series.map((w) => w.weekStart)).toEqual(lundisAout);
    // Août 2026 déborde des deux côtés : six lignes.
    expect(series).toHaveLength(6);
  });

  it("agrège dans la semaine qui contient la date, pas dans le mois", () => {
    // Le 1er août 2026 est un samedi : il appartient à la semaine du 27
    // juillet, première ligne de la grille.
    const series = monthlyWeeklySeries(
      [session({ date: "2026-08-01", rpe: 6, duration_actual_min: 50 })],
      lundisAout
    );
    expect(series[0].weekStart).toBe("2026-07-27");
    expect(series[0].load).toBe(300);
    expect(series[1].load).toBe(0);
  });

  /**
   * Le piège : la charge chronique est une moyenne sur quatre semaines. Sans
   * les trois qui précèdent le mois, celle de la première ligne serait sa
   * propre moyenne — le repère collerait à la barre, et l'écran annoncerait
   * une charge « normale » là où il y a en fait un doublement.
   */
  it("calcule la charge chronique avec les semaines d'avant le mois", () => {
    const reguliere = ["2026-07-06", "2026-07-13", "2026-07-20"].map((date) =>
      session({ date, rpe: 5, duration_actual_min: 60 })
    );
    const series = monthlyWeeklySeries(
      [
        ...reguliere,
        // Semaine du 27 juillet : le double.
        session({ date: "2026-07-28", rpe: 10, duration_actual_min: 60 }),
      ],
      lundisAout
    );

    expect(series[0].weekStart).toBe("2026-07-27");
    expect(series[0].load).toBe(600);
    // Moyenne des quatre : (300 + 300 + 300 + 600) / 4.
    expect(series[0].chronicLoad).toBe(375);
  });

  it("sépare le volume prévu du volume réalisé", () => {
    // Repris de la série glissante que ce calcul remplace : les agrégats sont
    // les mêmes, seul l'axe change.
    const series = monthlyWeeklySeries(
      [
        session({
          date: "2026-08-04",
          status: "missed",
          duration_planned_min: 90,
          duration_actual_min: null,
          rpe: null,
        }),
        session({ date: "2026-08-05", duration_planned_min: 60, duration_actual_min: 55 }),
        // Séance libre : réalisée, mais jamais comptée comme prévue.
        session({ date: "2026-08-05", coach_id: null, duration_actual_min: 20 }),
      ],
      lundisAout
    );
    const semaine = series[1]; // semaine du 3 août
    expect(semaine.volumePlannedMin).toBe(150);
    expect(semaine.volumeActualMin).toBe(75);
    expect(semaine.planned).toBe(2);
    expect(semaine.completed).toBe(2);
  });

  it("agrège charge et RPE moyen dans la bonne semaine", () => {
    const series = monthlyWeeklySeries(
      [
        session({ date: "2026-08-04", rpe: 6, duration_actual_min: 60 }),
        session({ date: "2026-08-05", rpe: 8, duration_actual_min: 30 }),
      ],
      lundisAout
    );
    const semaine = series[1];
    expect(semaine.load).toBe(6 * 60 + 8 * 30);
    expect(semaine.volumeActualMin).toBe(90);
    expect(semaine.avgRpe).toBe(7);
    expect(semaine.completed).toBe(2);
  });

  it("laisse le RPE moyen vide sur une semaine sans séance réalisée", () => {
    const series = monthlyWeeklySeries(
      [session({ date: "2026-08-04", status: "planned" })],
      lundisAout
    );
    expect(series[1].avgRpe).toBeNull();
    expect(series[1].load).toBe(0);
  });

  it("ne laisse pas les semaines de contexte dans le résultat", () => {
    const series = monthlyWeeklySeries(
      [session({ date: "2026-07-06", rpe: 5, duration_actual_min: 60 })],
      lundisAout
    );
    expect(series.some((w) => w.weekStart < lundisAout[0])).toBe(false);
  });

  it("rend une liste vide sans lundi", () => {
    expect(monthlyWeeklySeries([session({})], [])).toEqual([]);
  });
});
