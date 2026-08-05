import { describe, expect, it } from "vitest";
import { computeMetrics, sessionLoad, weeklySeries } from "./metrics";
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

describe("weeklySeries", () => {
  it("rend les semaines demandées, de la plus ancienne à la semaine en cours", () => {
    const series = weeklySeries([], 4, NOW);
    expect(series.map((w) => w.weekStart)).toEqual([
      "2026-07-13",
      "2026-07-20",
      "2026-07-27",
      "2026-08-03",
    ]);
  });

  it("agrège charge, volume et RPE dans la bonne semaine", () => {
    const series = weeklySeries(
      [
        // Semaine en cours (lundi 3 août)
        session({ date: "2026-08-04", rpe: 6, duration_actual_min: 60 }),
        session({ date: "2026-08-05", rpe: 8, duration_actual_min: 30 }),
        // Semaine précédente
        session({ date: "2026-07-30", rpe: 5, duration_actual_min: 40 }),
      ],
      2,
      NOW
    );
    const [previous, current] = series;

    expect(current.load).toBe(6 * 60 + 8 * 30);
    expect(current.volumeActualMin).toBe(90);
    expect(current.avgRpe).toBe(7);
    expect(current.completed).toBe(2);
    expect(previous.load).toBe(200);
  });

  it("sépare le volume prévu du volume réalisé", () => {
    const [week] = weeklySeries(
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
      1,
      NOW
    );
    expect(week.volumePlannedMin).toBe(150);
    expect(week.volumeActualMin).toBe(75);
    expect(week.planned).toBe(2);
    expect(week.completed).toBe(2);
  });

  it("lisse la charge chronique sur quatre semaines glissantes", () => {
    const series = weeklySeries(
      [
        session({ date: "2026-07-14", rpe: 10, duration_actual_min: 100 }), // 1000
        session({ date: "2026-08-04", rpe: 10, duration_actual_min: 20 }), // 200
      ],
      4,
      NOW
    );
    // Semaine en cours : (1000 + 0 + 0 + 200) / 4
    expect(series[3].chronicLoad).toBe(300);
    // Première semaine de la fenêtre : elle n'a qu'elle-même comme historique.
    expect(series[0].chronicLoad).toBe(1000);
  });

  it("laisse le RPE moyen vide sur une semaine sans séance réalisée", () => {
    const [week] = weeklySeries(
      [session({ date: "2026-08-04", status: "planned" })],
      1,
      NOW
    );
    expect(week.avgRpe).toBeNull();
    expect(week.load).toBe(0);
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
