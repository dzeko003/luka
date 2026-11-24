import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serveur autonome pour l'image Docker (deploy/)
  output: "standalone",
  cacheComponents: true,
  // Base GeoLite2 lue sur le disque (pays des visiteurs) : paquet chargé tel quel et fichiers de données copiés
  serverExternalPackages: ["geoip-country"],
  outputFileTracingIncludes: {
    "/api/visite": ["./node_modules/geoip-country/data/*.dat"],
    "/api/auth/*": ["./node_modules/geoip-country/data/*.dat"],
  },
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
