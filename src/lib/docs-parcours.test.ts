import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La carte des pages (`docs/parcours.md`) ne doit pas mentir en silence.
 *
 * C'est le seul document de référence tenu par un test, et il l'est parce que
 * son contenu est **dérivable** : les routes existent dans l'arborescence, on
 * peut donc vérifier qu'aucune n'a été ajoutée sans être documentée. Les deux
 * autres références (fonctionnalités, modèle de données) reposent sur la
 * relecture — un catalogue faux coûte plus cher que pas de catalogue, mais
 * personne ne sait le vérifier automatiquement.
 *
 * Le sens du test est volontairement unique : route existante → doit être
 * documentée. L'inverse (une route documentée qui n'existe plus) n'est pas
 * vérifié, la carte citant aussi des chemins qui ne sont pas des routes
 * (`/auth/*`, le matcher du proxy).
 */

const RACINE = path.resolve(__dirname, "..", "..");
const APP = path.join(RACINE, "src", "app");
const CARTE = path.join(RACINE, "docs", "parcours.md");

/**
 * Les routes rendues, sous la forme qu'elles ont dans l'URL.
 *
 * Un dossier entre parenthèses est un groupe de routes : il organise les
 * fichiers sans apparaître dans l'adresse. Un dossier préfixé par `_` ou `@`
 * ne produit pas de route non plus.
 */
function routesDe(dir: string, url = ""): string[] {
  const entrees = readdirSync(dir, { withFileTypes: true });
  const routes: string[] = [];

  if (entrees.some((e) => e.isFile() && (e.name === "page.tsx" || e.name === "route.ts"))) {
    routes.push(url === "" ? "/" : url);
  }

  for (const e of entrees) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith("_") || e.name.startsWith("@")) continue;
    const groupe = e.name.startsWith("(") && e.name.endsWith(")");
    routes.push(
      ...routesDe(path.join(dir, e.name), groupe ? url : `${url}/${e.name}`)
    );
  }

  return routes;
}

describe("docs/parcours.md", () => {
  const routes = routesDe(APP).sort();
  const carte = readFileSync(CARTE, "utf8");

  it("connaît toutes les routes de l'application", () => {
    // Citées entre accents graves, comme partout dans la carte : chercher le
    // chemin nu ferait passer `/planning` pour documenté dès que
    // `/athletes/[id]/planning` l'est.
    const absentes = routes.filter((r) => !carte.includes(`\`${r}\``));
    expect(absentes, "routes ajoutées sans être documentées").toEqual([]);
  });

  it("trouve bien des routes à vérifier", () => {
    // Garde-fou du garde-fou : si l'arborescence change de forme et que le
    // parcours ne trouve plus rien, le test ci-dessus passerait à vide.
    expect(routes.length).toBeGreaterThan(10);
    expect(routes).toContain("/");
  });
});
