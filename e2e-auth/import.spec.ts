import { expect, test, type Page } from "@playwright/test";
import {
  Encoder,
  Profile,
  type Encodable,
  type FileIdMesg,
  type SessionMesg,
} from "@garmin/fitsdk";

/**
 * Parcours d'import d'un fichier de montre, de bout en bout.
 *
 * Le fichier est fabriqué ici plutôt que repris des exemples réels : ceux-ci
 * portent une date fixe, alors que le rattachement demande une activité
 * tombant le même jour qu'une séance planifiée. L'analyse des exports réels
 * est couverte par les tests unitaires ; ce qui se joue ici, c'est le
 * parcours.
 */

const MOT_DE_PASSE = "optiperf-demo";

/**
 * Aujourd'hui à 10 h UTC, soit midi à Paris : aucun risque de bascule de jour.
 *
 * La graine rend l'empreinte du fichier unique à chaque exécution. Sans elle,
 * une reprise après échec buterait sur l'anti-doublon de l'exécution
 * précédente et échouerait pour une raison qui n'a rien à voir.
 */
function gpxDuJour(graine = crypto.randomUUID(), decalageMinutes = 0) {
  const jour = new Date();
  const debut = new Date(
    Date.UTC(jour.getFullYear(), jour.getMonth(), jour.getDate(), 10, decalageMinutes)
  );
  const point = (minutes: number, lat: number, hr: number) =>
    `<trkpt lat="${lat.toFixed(7)}" lon="2.3522000">
       <time>${new Date(debut.getTime() + minutes * 60_000).toISOString()}</time>
       <extensions><gpxtpx:hr>${hr}</gpxtpx:hr></extensions>
     </trkpt>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${graine} -->
<gpx creator="Test" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><name>Séance de test</name><trkseg>
  ${point(0, 48.8566, 140)}
  ${point(21, 48.8616, 142)}
  ${point(42, 48.8666, 144)}
 </trkseg></trk>
</gpx>`;
}

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

async function deposer(page: Page, contenu: string | Buffer, nom = "seance-test.gpx") {
  await page.getByRole("button", { name: "Ajouter une séance" }).click();
  await page.getByText("Fichier de montre").click();
  await page.getByLabel(/Fichier exporté/).setInputFiles({
    name: nom,
    mimeType: "application/gpx+xml",
    buffer: typeof contenu === "string" ? Buffer.from(contenu, "utf8") : contenu,
  });
}

/**
 * TCX minimal, sur le modèle des fixtures réelles
 * (src/lib/__exemples__/*.tcx) : un seul tour porte les totaux.
 */
function tcxDuJour(graine = crypto.randomUUID(), decalageMinutes = 0) {
  const jour = new Date();
  const debut = new Date(
    Date.UTC(jour.getFullYear(), jour.getMonth(), jour.getDate(), 11, decalageMinutes)
  ).toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${graine} -->
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
 <Activities><Activity Sport="Running">
  <Id>${debut}</Id>
  <Lap StartTime="${debut}">
   <TotalTimeSeconds>1500.0</TotalTimeSeconds>
   <DistanceMeters>5000.0</DistanceMeters>
   <AverageHeartRateBpm><Value>150</Value></AverageHeartRateBpm>
  </Lap>
 </Activity></Activities>
</TrainingCenterDatabase>`;
}

test("déposer un fichier, le rattacher, ne saisir que le RPE", async ({ page }) => {
  await seConnecter(page, "sofia@example.com");
  await deposer(page, gpxDuJour());

  // L'aperçu, avant tout enregistrement : l'athlète doit pouvoir constater
  // que la durée est juste avant de valider.
  await expect(page.getByText("42 min · 1,1 km · 142 bpm")).toBeVisible();

  // La séance planifiée du jour est proposée au rattachement.
  await page.getByLabel("Rattacher à").selectOption({ label: "Séance du jour" });

  // La seule chose qu'aucune montre ne mesure.
  await page.getByRole("radio", { name: "6", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // Le formulaire se referme : l'enregistrement a abouti.
  await expect(
    page.getByRole("button", { name: "Ajouter une séance" })
  ).toBeVisible();

  // Et la séance est bien passée au réalisé, avec la durée du fichier.
  await page.getByRole("link", { name: "Historique" }).click();
  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  await expect(page.getByText("Séance du jour")).toBeVisible();
  await expect(page.getByText("42 min").first()).toBeVisible();
});

// Régression : .tcx n'a aucun type de fichier associé sur iOS. Restreindre
// l'attribut accept (même à plusieurs types XML génériques) grisait ces
// fichiers dans le sélecteur natif — parfois le GPX aussi (signalé depuis un
// téléphone, persistant après un premier correctif moins radical).
test("le sélecteur de fichier n'exclut aucun type de fichier", async ({ page }) => {
  await seConnecter(page, "sofia@example.com");
  await page.getByRole("button", { name: "Ajouter une séance" }).click();
  await page.getByText("Fichier de montre").click();

  const accept = await page.getByLabel(/Fichier exporté/).getAttribute("accept");
  expect(accept).toBe("*/*");
});

// Le dépôt d'un GPX a sa propre couverture ailleurs dans ce fichier ; celui
// d'un TCX ne l'avait jamais eue alors que c'est lui qui posait problème.
test("un fichier TCX est importable de bout en bout", async ({ page }) => {
  await seConnecter(page, "sofia@example.com");
  await deposer(page, tcxDuJour(crypto.randomUUID(), 33), "montre.tcx");

  await expect(page.getByText("25 min · 5,0 km · 150 bpm")).toBeVisible();

  await page.getByLabel("Rattacher à").selectOption({ label: "Aucune — nouvelle séance" });
  await page.getByRole("radio", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(
    page.getByRole("button", { name: "Ajouter une séance" })
  ).toBeVisible();
});

/**
 * FIT minimal, construit avec le même SDK que celui qui le lit
 * (@garmin/fitsdk) : binaire et non du XML, il n'y a pas d'autre façon d'en
 * fabriquer un valide pour ce test que d'utiliser son propre encodeur.
 */
function fitDuJour(graine = Math.floor(Math.random() * 65_000), decalageMinutes = 0) {
  const jour = new Date();
  const debut = new Date(
    Date.UTC(jour.getFullYear(), jour.getMonth(), jour.getDate(), 12, decalageMinutes)
  );

  const encoder = new Encoder();
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: "activity",
    manufacturer: "garmin",
    // Un champ sans effet sur la lecture, mais qui rend l'empreinte du
    // fichier unique à chaque exécution — comme la graine des GPX/TCX.
    product: graine,
    timeCreated: debut,
  } as Encodable<FileIdMesg>);
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.SESSION,
    startTime: debut,
    totalElapsedTime: 1500.0,
    totalTimerTime: 1500.0,
    totalDistance: 5000.0,
    avgHeartRate: 150,
  } as Encodable<SessionMesg>);
  return Buffer.from(encoder.close());
}

test("un fichier FIT est importable de bout en bout", async ({ page }) => {
  await seConnecter(page, "sofia@example.com");
  await deposer(page, fitDuJour(undefined, 47), "montre.fit");

  await expect(page.getByText("25 min · 5,0 km · 150 bpm")).toBeVisible();

  await page.getByLabel("Rattacher à").selectOption({ label: "Aucune — nouvelle séance" });
  await page.getByRole("radio", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(
    page.getByRole("button", { name: "Ajouter une séance" })
  ).toBeVisible();
});

test("le même fichier déposé deux fois est refusé", async ({ page }) => {
  await seConnecter(page, "sofia@example.com");

  // Un fichier propre à ce test : son empreinte ne doit croiser aucune autre,
  // mais rester la même d'un dépôt à l'autre — c'est tout l'objet du test.
  const contenu = gpxDuJour(crypto.randomUUID(), 7);

  // Sans rattachement : ce test couvre au passage la création d'une séance
  // libre, chemin que le premier ne prend pas. Le choix est explicite, car
  // plusieurs séances peuvent tomber le même jour selon le calendrier.
  await deposer(page, contenu, "doublon.gpx");
  await page.getByLabel("Rattacher à").selectOption({ label: "Aucune — nouvelle séance" });
  await page.getByRole("radio", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByRole("button", { name: "Ajouter une séance" })
  ).toBeVisible();

  await deposer(page, contenu, "doublon.gpx");
  await page.getByLabel("Rattacher à").selectOption({ label: "Aucune — nouvelle séance" });
  await page.getByRole("radio", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText("Cette séance a déjà été importée.")).toBeVisible();
});

test("un fichier illisible est refusé avant tout enregistrement", async ({ page }) => {
  await seConnecter(page, "sofia@example.com");
  await deposer(page, "<html><body>Erreur 404</body></html>", "pasunetrace.gpx");

  await expect(page.getByText(/n'est pas un GPX exploitable/)).toBeVisible();
  // Aucun formulaire ne s'ouvre : il n'y a rien à enregistrer.
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeHidden();
});
