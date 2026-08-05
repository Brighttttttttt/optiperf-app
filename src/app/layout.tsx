import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Optiperf",
  description: "Suivi d'entraînement entre coach et athlètes",
  applicationName: "Optiperf",
  // Ajout à l'écran d'accueil sur iOS : ouverture en plein écran, sans
  // barre d'adresse, avec une barre d'état qui se fond dans la page.
  appleWebApp: {
    capable: true,
    title: "Optiperf",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f2f5f1",
  width: "device-width",
  initialScale: 1,
  // Le contenu passe sous l'encoche ; les zones sûres sont gérées en CSS.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
