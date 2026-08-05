import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Optiperf — carnet d'entraînement",
    short_name: "Optiperf",
    description:
      "Suivi d'entraînement entre coach et athlètes : planning, séances, charge et messagerie.",
    lang: "fr",
    start_url: "/",
    // Plein écran : ni barre d'adresse ni onglets, l'app se comporte comme
    // une application native une fois ajoutée à l'écran d'accueil.
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f5f1",
    theme_color: "#17604c",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
