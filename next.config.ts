import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serveur autonome pour l'image Docker (infra/)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    instantInsights: {
      // La validation automatique de chaque page, en développement, rechargeait en boucle les pages
      // qui lisent la session (connexion, accueil, collectes). Seules les pages qui exportent
      // `instant` sont validées. Aucun effet en production.
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
