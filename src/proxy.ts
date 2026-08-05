import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les images, et les ressources que le
    // système d'exploitation récupère sans session : manifeste et icônes
    // d'installation. Les protéger empêcherait l'ajout à l'écran d'accueil.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest$|icon$|apple-icon$|robots.txt$|sitemap.xml$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
