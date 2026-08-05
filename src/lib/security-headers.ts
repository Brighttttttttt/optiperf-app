// Origine Supabase autorisée pour les appels REST et le temps réel.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// `http` → `ws` et non `https:` → `wss:` : une base servie en clair (la base
// locale de la CLI Supabase, en développement comme en intégration continue)
// ne correspondait pas au motif, `connect-src` se retrouvait sans origine
// WebSocket et le navigateur refusait l'abonnement temps réel — les compteurs
// de la barre de navigation cessaient de se mettre à jour, sans autre trace
// qu'un message de console.
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

// 'unsafe-inline' sur les styles et scripts : Tailwind et Next injectent
// des styles et la charge utile RSC en ligne. 'unsafe-eval' est réservé
// au développement (rechargement à chaud).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": csp,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/**
 * Applique les en-têtes de sécurité à une réponse.
 *
 * Ils sont posés ici plutôt que via `headers()` dans next.config.ts : cette
 * option modifie le routage Vercel et fait servir les pages prérendues
 * (/login, /signup) directement par le CDN, qui refuse alors les POST des
 * server actions avec un 405. Invisible en local, cassant en production.
 */
export function withSecurityHeaders<T extends { headers: Headers }>(
  response: T
): T {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
