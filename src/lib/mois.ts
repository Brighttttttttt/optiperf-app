/**
 * Le mois comme unité de lecture (#143).
 *
 * La semaine sert à agir — qu'est-ce que je fais demain. Le mois sert à
 * relire : un bloc d'entraînement, une coupure, une reprise. Aucune vue ne
 * parlait cette langue-là, si bien qu'on ne pouvait ni regarder son mois de
 * juillet ni le comparer à juin.
 *
 * Tout se calcule ici sur des chaînes `AAAA-MM-JJ` et des instants **à midi
 * UTC**, jamais sur l'heure locale de la machine : `src/lib/dates.ts` force
 * Europe/Paris parce que Vercel tourne en UTC, et un calcul de quantième posé
 * près de minuit se décale d'un jour d'un côté ou de l'autre — c'est
 * exactement ce qui a fait échouer un test connecté (#146).
 */

/** Un mois, au format `AAAA-MM`. */
export type Mois = string;

/** Midi UTC le jour donné : assez loin des deux bascules pour être stable. */
function midi(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function isoDe(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "2026-08-14" → "2026-08". */
export function moisDe(iso: string): Mois {
  return iso.slice(0, 7);
}

/** Le mois qui contient `iso`, décalé de `n` mois. */
export function decalerMois(mois: Mois, n: number): Mois {
  const [an, m] = mois.split("-").map(Number);
  // `Date.UTC` normalise de lui-même un mois hors bornes : décembre + 1 tombe
  // en janvier de l'année suivante sans qu'on ait à le traiter.
  const d = new Date(Date.UTC(an, m - 1 + n, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "août 2026" — l'entête de la vue. */
export function libelleMois(mois: Mois): string {
  return midi(`${mois}-01`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Premier et dernier jour du mois, inclus. */
export function bornesMois(mois: Mois): { debut: string; fin: string } {
  const [an, m] = mois.split("-").map(Number);
  return {
    debut: `${mois}-01`,
    // Jour 0 du mois suivant = dernier jour de celui-ci.
    fin: isoDe(new Date(Date.UTC(an, m, 0, 12))),
  };
}

export type JourMois = {
  iso: string;
  dayOfMonth: number;
  /** Faux pour les jours de complément en début et fin de grille. */
  dansLeMois: boolean;
  isToday: boolean;
  isPast: boolean;
};

export type SemaineMois = {
  /** Lundi de la semaine, en ISO — la clé de rendu, et l'ancre des courbes. */
  lundi: string;
  jours: JourMois[];
};

/**
 * La grille du mois, **une ligne par semaine**.
 *
 * Les semaines vont du lundi au dimanche et débordent des deux côtés : une
 * semaine à cheval appartient tout entière à la grille, et ses jours hors du
 * mois sont marqués comme tels. Les couper donnerait des lignes de longueur
 * variable, où les colonnes ne seraient plus alignées sur les jours.
 *
 * Sept colonnes et quatre à six lignes : l'encombrement d'une vue semaine
 * multiplié par le nombre de lignes, et rien de plus.
 */
export function grilleMois(mois: Mois, aujourdhui: string): SemaineMois[] {
  const { debut, fin } = bornesMois(mois);

  // Lundi de la semaine du 1er. `getUTCDay()` rend 0 pour dimanche, d'où le
  // +6 %7 qui fait commencer la semaine au lundi, à la française.
  const premier = midi(debut);
  const depart = new Date(premier);
  depart.setUTCDate(depart.getUTCDate() - ((premier.getUTCDay() + 6) % 7));

  const semaines: SemaineMois[] = [];
  const curseur = new Date(depart);

  // Tant que la semaine commencée contient encore un jour du mois.
  while (isoDe(curseur) <= fin) {
    const jours: JourMois[] = [];
    for (let i = 0; i < 7; i++) {
      const jour = new Date(curseur);
      jour.setUTCDate(jour.getUTCDate() + i);
      const iso = isoDe(jour);
      jours.push({
        iso,
        dayOfMonth: jour.getUTCDate(),
        dansLeMois: iso >= debut && iso <= fin,
        isToday: iso === aujourdhui,
        isPast: iso < aujourdhui,
      });
    }
    semaines.push({ lundi: isoDe(curseur), jours });
    curseur.setUTCDate(curseur.getUTCDate() + 7);
  }

  return semaines;
}

/** Les lundis des semaines de la grille — l'axe des courbes mensuelles. */
export function lundisDuMois(mois: Mois): string[] {
  return grilleMois(mois, "").map((s) => s.lundi);
}
