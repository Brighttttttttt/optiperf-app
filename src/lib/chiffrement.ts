/**
 * Chiffrement des jetons de fournisseurs (#105).
 *
 * **Ne jamais importer depuis un composant client.** Ce module lit
 * `PROVIDER_TOKEN_KEY`, qui n'existe que côté serveur : l'importer ailleurs
 * ferait échouer le rendu au lieu de fuiter la clé, mais la règle vaut d'être
 * dite. Le dépôt ne déclare pas `server-only` et n'ajoutera pas une
 * dépendance pour cela.
 *
 * Pourquoi chiffrer une donnée que la RLS protège déjà : l'application n'a pas
 * d'identité propre. Elle interroge Supabase sous le rôle `authenticated` de
 * l'utilisateur — c'est tout l'intérêt de la RLS — donc **tout droit de
 * lecture qu'on lui accorde, un XSS l'obtient aussi**. Retirer le droit de
 * lecture ne marche pas davantage : le serveur en a besoin pour renouveler un
 * jeton expiré.
 *
 * Le chiffrement tranche : la base et le navigateur ne voient qu'un bloc
 * inexploitable, et la clé ne quitte jamais le serveur.
 *
 * AES-GCM plutôt qu'AES-CBC : il authentifie le message en plus de le
 * chiffrer, donc un bloc modifié est rejeté au lieu de se déchiffrer en
 * n'importe quoi.
 */

const ALGO = "AES-GCM";
/** 96 bits, la taille recommandée pour GCM — au-delà, la spec re-hache. */
const TAILLE_IV = 12;

let cleMemorisee: Promise<CryptoKey> | null = null;

/**
 * La clé, lue une fois. `PROVIDER_TOKEN_KEY` est 32 octets en base64.
 *
 * Absente, on échoue franchement : une connexion à Strava qui s'enregistrerait
 * en clair « parce que la clé manquait » serait le pire des deux mondes.
 */
function cle(): Promise<CryptoKey> {
  if (cleMemorisee) return cleMemorisee;

  const brut = process.env.PROVIDER_TOKEN_KEY;
  if (!brut) {
    throw new Error(
      "PROVIDER_TOKEN_KEY manquante : impossible de chiffrer les jetons."
    );
  }
  const octets = Buffer.from(brut, "base64");
  if (octets.length !== 32) {
    throw new Error(
      `PROVIDER_TOKEN_KEY doit faire 32 octets en base64 (reçu ${octets.length}).`
    );
  }

  cleMemorisee = crypto.subtle.importKey("raw", octets, ALGO, false, [
    "encrypt",
    "decrypt",
  ]);
  return cleMemorisee;
}

/** Chiffre une chaîne. Le vecteur d'initialisation voyage avec le message. */
export async function chiffrer(clair: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(TAILLE_IV));
  const chiffre = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    await cle(),
    new TextEncoder().encode(clair)
  );
  // IV puis message : sa taille étant fixe, la relecture n'a rien à deviner.
  return Buffer.concat([iv, Buffer.from(chiffre)]).toString("base64");
}

/**
 * Déchiffre. Rend `null` plutôt que de lever : un jeton illisible — clé
 * changée, ligne abîmée — se traite comme une connexion à refaire, pas comme
 * une panne du serveur.
 */
export async function dechiffrer(stocke: string): Promise<string | null> {
  try {
    const octets = Buffer.from(stocke, "base64");
    if (octets.length <= TAILLE_IV) return null;
    const clair = await crypto.subtle.decrypt(
      { name: ALGO, iv: octets.subarray(0, TAILLE_IV) },
      await cle(),
      octets.subarray(TAILLE_IV)
    );
    return new TextDecoder().decode(clair);
  } catch {
    return null;
  }
}
