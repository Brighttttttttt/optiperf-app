import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialité · Optiperf",
  description:
    "Ce qu'Optiperf enregistre, qui le voit, où c'est hébergé et comment tout effacer.",
};

/**
 * Politique de confidentialité — page **publique**, hors du groupe `(app)`.
 *
 * Elle doit rester lisible sans compte : c'est l'adresse qu'on donne à
 * quelqu'un qui hésite à s'inscrire, et celle que réclament les programmes
 * d'API des fabricants de montres avant d'accorder un accès.
 *
 * Écrite à partir du schéma réel (`supabase/migrations/`) et non d'un modèle :
 * chaque catégorie de données correspond à une table, et chaque règle de
 * visibilité à une politique RLS qu'on peut aller relire.
 */
export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-pine">
        Optiperf
      </p>
      <h1 className="mt-1 font-display text-[34px] leading-9 font-semibold uppercase tracking-wide">
        Confidentialité
      </h1>
      <p className="mt-3 text-[14px] text-ink-soft">
        Dernière mise à jour : 15 août 2026.
      </p>

      <Section titre="En bref">
        <p>
          Optiperf est un carnet d&apos;entraînement partagé entre un athlète et
          son coach. Il enregistre ce que vous y saisissez et ce que votre
          montre a mesuré, pour vous le restituer.
        </p>
        <ul className="mt-3 space-y-1.5">
          <Puce>Aucune publicité, aucun traceur, aucune mesure d&apos;audience.</Puce>
          <Puce>Aucune donnée vendue ni cédée à qui que ce soit.</Puce>
          <Puce>
            Vos données d&apos;entraînement ne sont visibles que par vous et par
            le coach auquel <strong>vous</strong> avez choisi de vous lier.
          </Puce>
          <Puce>
            Vous supprimez votre compte et tout ce qu&apos;il contient depuis
            l&apos;application, sans rien demander à personne.
          </Puce>
        </ul>
      </Section>

      <Section titre="Qui est responsable">
        <p>
          Optiperf est édité par <Aremplir>votre nom ou raison sociale</Aremplir>
          , <Aremplir>adresse</Aremplir>. Pour toute question ou demande
          relative à vos données : <Aremplir>adresse email de contact</Aremplir>.
        </p>
      </Section>

      <Section titre="Ce qui est enregistré">
        <Tableau
          entetes={["Catégorie", "Détail", "Pourquoi"]}
          lignes={[
            [
              "Compte",
              "Adresse email, mot de passe (chiffré par notre hébergeur, jamais lisible par nous), nom affiché, rôle coach ou athlète.",
              "Vous identifier et vous reconnecter.",
            ],
            [
              "Entraînement",
              "Séances prévues et réalisées, effort ressenti (RPE), durées, commentaires, objectifs, records personnels, exercices de musculation.",
              "C'est le carnet lui-même.",
            ],
            [
              "Repères physiologiques",
              "Fréquence cardiaque maximale et de repos, seuil, VMA — uniquement si vous les saisissez.",
              "Calculer vos zones d'entraînement.",
            ],
            [
              "Fichiers de montre",
              "Date, durée, distance, fréquence cardiaque moyenne, tours, et une trace allégée (400 points au maximum).",
              "Analyser la structure réelle de vos séances.",
            ],
            [
              "Messages",
              "Les messages échangés avec votre coach ou votre athlète.",
              "La messagerie de l'application.",
            ],
            [
              "Connexions à une montre",
              "Le lien vers un compte Strava, Garmin ou Coros, et les jetons d'accès correspondants — chiffrés, illisibles depuis la base comme depuis votre navigateur.",
              "Récupérer vos activités sans que vous ayez à déposer un fichier.",
            ],
          ]}
        />
        <p className="mt-4">
          <strong>Le fichier de votre montre ne quitte pas votre appareil.</strong>{" "}
          Il est lu par votre navigateur, qui n&apos;envoie que les valeurs
          affichées à l&apos;écran avant que vous ne validiez. Un fichier de
          plusieurs mégaoctets ne traverse jamais le réseau.
        </p>
        <p className="mt-3">
          Il n&apos;y a <strong>ni cookie publicitaire, ni outil de mesure
          d&apos;audience</strong>. Les seuls cookies déposés font fonctionner
          l&apos;application : votre session, votre préférence d&apos;affichage
          (« je coache » / « je m&apos;entraîne »), et un jeton temporaire de dix
          minutes lors d&apos;une connexion à une montre.
        </p>
      </Section>

      <Section titre="Qui voit quoi">
        <ul className="space-y-1.5">
          <Puce>
            <strong>Vous</strong> voyez toutes vos données.
          </Puce>
          <Puce>
            <strong>Votre coach</strong> voit vos séances, vos comptes rendus,
            vos activités importées et vos repères physiologiques — parce que
            c&apos;est l&apos;objet du service. Ce lien s&apos;établit
            <strong> à votre initiative</strong>, en saisissant un code
            d&apos;invitation, et vous pouvez le rompre à tout moment : son
            accès cesse immédiatement.
          </Puce>
          <Puce>
            <strong>Votre coach tient des notes privées</strong> à votre sujet,
            que vous ne voyez pas. C&apos;est un carnet professionnel — blessure
            passée, contrainte d&apos;emploi du temps. Il disparaît quand la
            relation de coaching prend fin. Vous pouvez en demander le contenu
            à l&apos;adresse ci-dessus.
          </Puce>
          <Puce>
            <strong>Votre connexion à une montre ne se voit pas</strong>, pas
            même de votre coach.
          </Puce>
          <Puce>
            <strong>Personne d&apos;autre.</strong> Aucun autre athlète, aucun
            autre coach.
          </Puce>
        </ul>
        <p className="mt-4">
          Ces règles ne sont pas de simples choix d&apos;affichage : elles sont
          appliquées par la base de données elle-même, ligne par ligne. Une page
          mal écrite ne peut pas les contourner.
        </p>
      </Section>

      <Section titre="Où c'est hébergé">
        <p>
          La base de données et l&apos;authentification sont confiées à{" "}
          <strong>Supabase</strong> (serveurs en Europe). L&apos;application est
          servie par <strong>Vercel</strong>, dont nous forçons l&apos;exécution
          sur la région de <strong>Paris</strong>.
        </p>
        <p className="mt-3">
          Si vous reliez un compte Strava, Garmin ou Coros, ces services
          reçoivent la demande d&apos;autorisation que vous approuvez chez eux,
          et leurs propres conditions s&apos;appliquent à ce qu&apos;ils
          détiennent.
        </p>
      </Section>

      <Section titre="Combien de temps">
        <p>
          Vos données sont conservées tant que votre compte existe. Il n&apos;y a
          pas d&apos;archivage silencieux après suppression : effacer le compte
          efface tout, en cascade — profil, séances, activités, messages,
          objectifs, notes vous concernant et connexions aux montres.
        </p>
      </Section>

      <Section titre="Vos droits">
        <p>
          Vous pouvez accéder à vos données, les corriger, les effacer, en
          demander une copie, ou vous opposer à leur traitement.
        </p>
        <p className="mt-3">
          <strong>Deux d&apos;entre eux s&apos;exercent sans nous écrire :</strong>{" "}
          la correction, dans vos réglages, et la suppression complète, par
          « Supprimer mon compte » au bas de la même page. Pour les autres,
          écrivez à <Aremplir>adresse email de contact</Aremplir> ; nous
          répondons sous trente jours.
        </p>
        <p className="mt-3">
          Vous pouvez également saisir la <abbr title="Commission nationale de l'informatique et des libertés">CNIL</abbr>{" "}
          (<a className="text-pine hover:underline" href="https://www.cnil.fr">cnil.fr</a>) si une réponse ne vous satisfait pas.
        </p>
      </Section>

      <Section titre="Les mineurs">
        <p>
          Optiperf n&apos;est pas destiné aux moins de 15 ans. Un athlète mineur
          ne peut y être suivi qu&apos;avec l&apos;accord de son représentant
          légal, à qui cette page s&apos;adresse aussi.
        </p>
      </Section>

      <Section titre="Modifications">
        <p>
          Cette page peut évoluer avec l&apos;application. La date en tête
          indique la dernière version ; un changement qui élargirait ce que nous
          faisons de vos données vous serait signalé dans l&apos;application, et
          pas seulement ici.
        </p>
      </Section>

      <div className="mt-10 border-t border-line pt-5">
        <Link href="/login" className="text-[14px] font-semibold text-pine hover:underline">
          ← Retour à la connexion
        </Link>
      </div>
    </main>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-[19px] font-semibold uppercase tracking-wide">
        {titre}
      </h2>
      <div className="mt-2 space-y-0 text-[15px] leading-relaxed text-ink">
        {children}
      </div>
    </section>
  );
}

function Puce({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-pine" />
      <span>{children}</span>
    </li>
  );
}

/** Ce qui reste à compléter avant publication : visible, pas noyé. */
function Aremplir({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-rpe-max-soft px-1 font-semibold text-rpe-max">
      [{children}]
    </mark>
  );
}

function Tableau({
  entetes,
  lignes,
}: {
  entetes: string[];
  lignes: string[][];
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-line text-left">
            {entetes.map((e) => (
              <th key={e} className="py-2 pr-3 font-semibold text-ink-soft">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne[0]} className="border-b border-line align-top">
              {ligne.map((cellule, i) => (
                <td key={i} className={`py-2.5 pr-3 ${i === 0 ? "font-semibold" : "text-ink-soft"}`}>
                  {cellule}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
