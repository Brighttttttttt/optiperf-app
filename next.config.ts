import path from "node:path";
import type { NextConfig } from "next";

// Les en-têtes de sécurité sont posés par le proxy (src/proxy.ts), pas ici :
// un bloc `headers()` fait servir les pages prérendues directement par le CDN
// Vercel, qui refuse alors les POST des server actions (405). Voir
// src/lib/security-headers.ts.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
