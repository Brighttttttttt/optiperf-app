import { describe, expect, it } from "vitest";
import {
  appliquerDeplacement,
  batchSummary,
  etendreFenetre,
  fenetreAutour,
  fenetreManquante,
  peutDeplacer,
  peutSupprimer,
  planningCalendar,
  planningState,
  pluralize,
} from "./planning";
import { addDays, toISODate } from "./dates";

// Mercredi 5 août 2026, 10 h à Paris.
const NOW = new Date("2026-08-05T10:00:00+02:00");

describe("planningCalendar", () => {
  const days = planningCalendar(3, NOW);

  it("ne propose jamais de date passée", () => {
    expect(days.every((d) => d.iso >= "2026-08-05")).toBe(true);
  });

  it("commence aujourd'hui", () => {
    expect(days[0].iso).toBe("2026-08-05");
    expect(days[0].isToday).toBe(true);
  });

  it("couvre les semaines demandées jusqu'au dimanche", () => {
    // Semaine en cours amputée (mer. → dim. = 5 jours) + 2 semaines pleines.
    expect(days).toHaveLength(5 + 14);
    expect(days[days.length - 1].iso).toBe("2026-08-23");
  });

  it("marque les lundis pour découper la grille", () => {
    const mondays = days.filter((d) => d.startsWeek).map((d) => d.iso);
    expect(mondays).toEqual(["2026-08-10", "2026-08-17"]);
  });
});

describe("pluralize", () => {
  it("accorde selon le nombre", () => {
    expect(pluralize(1, "séance")).toBe("1 séance");
    expect(pluralize(3, "séance")).toBe("3 séances");
    expect(pluralize(0, "séance")).toBe("0 séance");
  });
});

describe("batchSummary", () => {
  it("invite à choisir quand la sélection est vide", () => {
    expect(batchSummary(0, 3)).toMatch(/au moins un athlète/);
    expect(batchSummary(2, 0)).toMatch(/au moins un athlète/);
  });

  it("détaille le produit athlètes × dates", () => {
    expect(batchSummary(3, 4)).toBe("12 séances — 3 athlètes × 4 dates");
    expect(batchSummary(1, 1)).toBe("1 séance — 1 athlète × 1 date");
  });
});

describe("planningState", () => {
  it("lit d'abord le compte rendu, quelle que soit la date", () => {
    // Une séance faite reste faite, même si son jour est passé — et une
    // séance manquée ne redevient pas « à rattraper ».
    expect(planningState({ status: "completed", date: "2026-08-01" }, NOW)).toBe("fait");
    expect(planningState({ status: "completed", date: "2026-08-20" }, NOW)).toBe("fait");
    expect(planningState({ status: "missed", date: "2026-08-01" }, NOW)).toBe("manquee");
  });

  it("distingue une séance à venir d'une séance en retard", () => {
    expect(planningState({ status: "planned", date: "2026-08-06" }, NOW)).toBe("a-venir");
    expect(planningState({ status: "planned", date: "2026-08-04" }, NOW)).toBe("a-rattraper");
  });

  it("compte le jour même comme à venir, pas comme en retard", () => {
    // Une séance du jour se fait encore le soir : la signaler en retard dès
    // le matin serait faux et culpabilisant.
    expect(planningState({ status: "planned", date: "2026-08-05" }, NOW)).toBe("a-venir");
  });
});

describe("peutDeplacer", () => {
  it("n'autorise que les séances encore planifiées", () => {
    expect(peutDeplacer({ status: "planned" })).toBe(true);
    // Déplacer une séance faite réécrirait le jour où l'athlète a couru.
    expect(peutDeplacer({ status: "completed" })).toBe(false);
    expect(peutDeplacer({ status: "missed" })).toBe(false);
  });
});

describe("appliquerDeplacement", () => {
  const seances = [
    { id: "a", date: "2026-08-05", status: "planned" as const },
    { id: "b", date: "2026-08-05", status: "completed" as const },
    { id: "c", date: "2026-08-07", status: "planned" as const },
  ];

  it("ne change la date que de la séance visée", () => {
    const apres = appliquerDeplacement(seances, "a", "2026-08-06");
    expect(apres.map((s) => s.date)).toEqual([
      "2026-08-06",
      "2026-08-05",
      "2026-08-07",
    ]);
  });

  it("ignore une séance qui n'a pas le droit de bouger", () => {
    // Même règle qu'à l'enregistrement : rien ne doit bouger à l'écran qui
    // reviendrait en arrière une seconde plus tard.
    expect(appliquerDeplacement(seances, "b", "2026-08-09")).toEqual(seances);
  });

  it("laisse la liste d'origine intacte", () => {
    appliquerDeplacement(seances, "a", "2026-08-06");
    expect(seances[0].date).toBe("2026-08-05");
  });

  it("ne fait rien d'un identifiant inconnu", () => {
    expect(appliquerDeplacement(seances, "zzz", "2026-08-09")).toEqual(seances);
  });
});

describe("fenetreAutour", () => {
  it("couvre douze semaines de part et d'autre", () => {
    expect(fenetreAutour(NOW)).toEqual({
      debut: "2026-05-13",
      fin: "2026-10-28",
    });
  });
});

describe("fenetreManquante", () => {
  const fenetre = fenetreAutour(NOW);
  /** La période telle que la passe la vue : les bornes de la grille affichée. */
  const semaine = (lundiIso: string) => ({
    debut: lundiIso,
    fin: toISODate(addDays(new Date(`${lundiIso}T12:00:00Z`), 6)),
  });

  it("ne demande rien pour une période déjà couverte", () => {
    expect(fenetreManquante(fenetre, semaine("2026-08-03"))).toBeNull();
    // Un mois entier, loin des bords.
    expect(
      fenetreManquante(fenetre, { debut: "2026-06-29", fin: "2026-08-02" })
    ).toBeNull();
  });

  it("réclame la tranche antérieure quand on remonte trop loin", () => {
    // Le cas réel : une séance importée du 21 mai, hors fenêtre, sur laquelle
    // la vue affichait « Rien de prévu ce jour-là » (#141).
    const manque = fenetreManquante(fenetre, {
      debut: "2026-03-30",
      fin: "2026-05-03",
    });
    expect(manque).toEqual({ debut: "2026-02-18", fin: "2026-05-12" });
    // La tranche touche la fenêtre sans la recouvrir : pas de trou, pas de
    // séance ramenée deux fois.
    expect(manque!.fin < fenetre.debut).toBe(true);
  });

  it("réclame la tranche suivante quand on avance trop loin", () => {
    const manque = fenetreManquante(fenetre, {
      debut: "2026-11-02",
      fin: "2026-12-06",
    });
    expect(manque).toEqual({ debut: "2026-10-29", fin: "2027-01-20" });
  });

  it("réclame dès qu'un seul jour de la période dépasse", () => {
    // Une grille qui finit le 1er novembre alors que la fenêtre s'arrête au
    // 28 octobre : quatre jours manquent. Une période incomplète affichée
    // comme entière est le défaut même.
    expect(
      fenetreManquante(fenetre, { debut: "2026-09-28", fin: "2026-11-01" })
    ).not.toBeNull();
  });
});

describe("etendreFenetre", () => {
  it("recule le début sans toucher à la fin", () => {
    expect(
      etendreFenetre(
        { debut: "2026-06-10", fin: "2026-09-30" },
        { debut: "2026-04-15", fin: "2026-06-09" }
      )
    ).toEqual({ debut: "2026-04-15", fin: "2026-09-30" });
  });

  it("ne rétrécit jamais", () => {
    expect(
      etendreFenetre(
        { debut: "2026-06-10", fin: "2026-09-30" },
        { debut: "2026-07-01", fin: "2026-07-31" }
      )
    ).toEqual({ debut: "2026-06-10", fin: "2026-09-30" });
  });
});

describe("peutSupprimer", () => {
  const COACH = "coach-1";
  const ATHLETE = "athlete-1";
  const prescrite = (status: "planned" | "completed" | "missed") => ({
    coach_id: COACH,
    athlete_id: ATHLETE,
    status,
  });
  const libre = (status: "planned" | "completed" | "missed") => ({
    coach_id: null,
    athlete_id: ATHLETE,
    status,
  });

  it("laisse le coach retirer une prescription encore à venir", () => {
    expect(peutSupprimer(prescrite("planned"), COACH)).toBe(true);
  });

  it("empêche le coach d'effacer une séance déjà rapportée", () => {
    // Elle porte le RPE, la durée et le ressenti de l'athlète : l'effacer
    // reviendrait à effacer son travail.
    expect(peutSupprimer(prescrite("completed"), COACH)).toBe(false);
    expect(peutSupprimer(prescrite("missed"), COACH)).toBe(false);
  });

  it("empêche l'athlète d'effacer une prescription", () => {
    // S'il ne l'a pas faite, il la déclare manquée — c'est à ça que sert le
    // statut, et c'est ce qui garde l'adhérence honnête.
    expect(peutSupprimer(prescrite("planned"), ATHLETE)).toBe(false);
    expect(peutSupprimer(prescrite("missed"), ATHLETE)).toBe(false);
  });

  it("laisse l'athlète retirer ses séances libres, faites ou non", () => {
    expect(peutSupprimer(libre("planned"), ATHLETE)).toBe(true);
    expect(peutSupprimer(libre("completed"), ATHLETE)).toBe(true);
  });

  it("ne laisse personne d'autre y toucher", () => {
    expect(peutSupprimer(libre("planned"), "quelqu-un-dautre")).toBe(false);
    expect(peutSupprimer(prescrite("planned"), "quelqu-un-dautre")).toBe(false);
  });
});
