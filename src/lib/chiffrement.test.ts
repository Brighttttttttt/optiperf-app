import { beforeAll, describe, expect, it } from "vitest";
import { chiffrer, dechiffrer } from "./chiffrement";

// 32 octets, la taille attendue. Propre au test : la clé de production ne
// vit que dans les variables d'environnement du serveur.
const CLE = Buffer.alloc(32, 7).toString("base64");

beforeAll(() => {
  process.env.PROVIDER_TOKEN_KEY = CLE;
});

describe("chiffrer / dechiffrer", () => {
  it("rend le message d'origine", async () => {
    const jeton = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
    expect(await dechiffrer(await chiffrer(jeton))).toBe(jeton);
  });

  it("ne produit jamais deux fois le même bloc", async () => {
    // Le vecteur d'initialisation est tiré au hasard à chaque chiffrement :
    // deux jetons identiques ne doivent pas se reconnaître en base.
    const [a, b] = await Promise.all([chiffrer("même-jeton"), chiffrer("même-jeton")]);
    expect(a).not.toBe(b);
    expect(await dechiffrer(a)).toBe(await dechiffrer(b));
  });

  it("ne laisse rien lire du clair", async () => {
    const bloc = await chiffrer("secret-tres-reconnaissable");
    expect(bloc).not.toContain("secret");
    expect(Buffer.from(bloc, "base64").toString("utf8")).not.toContain("secret");
  });

  it("rejette un bloc modifié plutôt que de le déchiffrer de travers", async () => {
    // AES-GCM authentifie le message : c'est ce qui distingue une altération
    // d'un déchiffrement en n'importe quoi.
    const octets = Buffer.from(await chiffrer("jeton"), "base64");
    octets[octets.length - 1] ^= 0xff;
    expect(await dechiffrer(octets.toString("base64"))).toBeNull();
  });

  it("rend null sur une entrée qui n'est pas un bloc", async () => {
    // Clé changée, ligne abîmée : une connexion à refaire, pas une panne.
    expect(await dechiffrer("")).toBeNull();
    expect(await dechiffrer("pas-du-base64-chiffré")).toBeNull();
  });
});
