/*
 * Fait passer l'examen à Luka : chaque question devient une vraie collecte, dans une base de test jetable,
 * puis ses lignes sont notées. Lancement : npm run qualite (voir qualite/README.md).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // variables déjà dans l'environnement
}
// Garde-fou : jamais sur la base de développement ni de production
if (!process.env.DATABASE_URL?.includes("/luka_qualite")) {
  console.error(
    "La base doit s'appeler luka_qualite : lance l'examen avec npm run qualite.",
  );
  process.exit(1);
}

const { eq, sql } = await import("drizzle-orm");
const { db, schema } = await import("@/db");
const { runCollecte } = await import("@/lib/engine");
const { CAS } = await import("./cas");
const { evaluer } = await import("./evaluer");
type Evaluation = import("./evaluer").Evaluation;

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const seulement = arg("cas")?.split(",");
const forme = arg("forme");
const premium = process.argv.includes("--premium");
const cas = CAS.filter(
  (c) =>
    (!seulement || seulement.includes(c.id)) && (!forme || c.forme === forme),
);
if (!cas.length) {
  console.error("Aucune question ne correspond.");
  process.exit(1);
}

type Resultat = Evaluation & {
  id: string;
  forme: string;
  secteur: string;
  demande: string;
  secondes: number;
  appelsIa: number;
  statut: string;
  /** Avertissements et erreurs du journal de la collecte : expliquent souvent une mauvaise note. */
  alertes: string[];
};

await db
  .insert(schema.user)
  .values({
    id: "examen",
    name: "Examen qualité",
    email: "examen@example.invalid",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never)
  .onConflictDoNothing();

/* --------------------------- Rapport --------------------------- */

const moyenne = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const p = (x: number) => `${Math.round(x * 100)} %`;
const dossier = "qualite/resultats";
mkdirSync(dossier, { recursive: true });
const precedent = readdirSync(dossier)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .pop();
const avant: Record<string, number> = precedent
  ? Object.fromEntries(
      (
        JSON.parse(
          readFileSync(`${dossier}/${precedent}`, "utf8"),
        ) as Resultat[]
      ).map((r) => [r.id, r.note]),
    )
  : {};
const evolution = (r: Resultat) => {
  if (!(r.id in avant)) return "";
  const d = Math.round((r.note - avant[r.id]) * 100);
  return d > 0 ? ` (+${d})` : d < 0 ? ` (${d})` : " (=)";
};

const horodatage = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

/** Écrit le rapport ; appelé après chaque question, pour qu'un examen interrompu garde ses résultats. */
function ecrireRapport() {
  const formes = [...new Set(resultats.map((r) => r.forme))];
  const md = [
    `# Examen qualité de Luka : ${new Date().toLocaleString("fr-FR")}`,
    "",
    `**Note globale : ${p(moyenne(resultats.map((r) => r.note)))}** sur ${resultats.length} question(s)` +
      (resultats.length < cas.length
        ? ` (examen en cours ou interrompu : ${resultats.length}/${cas.length})`
        : "") +
      `, formule ${premium ? "Premium" : "gratuite"}.` +
      (precedent ? ` Comparaison avec ${precedent.replace(".json", "")}.` : ""),
    "",
    "| Forme | Note | Lignes sourcées |",
    "|---|---|---|",
    ...formes.map((f) => {
      const rs = resultats.filter((r) => r.forme === f);
      return `| ${f} | ${p(moyenne(rs.map((r) => r.note)))} | ${p(moyenne(rs.map((r) => r.sourcees)))} |`;
    }),
    "",
    "| Question | Secteur | Note | Lignes | Sources | Durée | Ce qui manque | Alertes |",
    "|---|---|---|---|---|---|---|---|",
    ...resultats.map(
      (r) =>
        `| ${r.id} | ${r.secteur} | ${p(r.note)}${evolution(r)} | ${r.lignes} | ${
          Object.entries(r.sources)
            .map(([s, n]) => `${s} (${n})`)
            .join(", ") || "—"
        } | ${r.secondes} s | ${
          r.verifications
            .filter((v) => !v.ok)
            .map((v) => `${v.nom} : ${v.detail}`)
            .join(" ; ") || "—"
        } | ${r.alertes.join(" ; ").replace(/\|/g, "/") || "—"} |`,
    ),
    "",
  ].join("\n");
  writeFileSync(`${dossier}/${horodatage}.md`, md);
  writeFileSync(
    `${dossier}/${horodatage}.json`,
    JSON.stringify(resultats, null, 2),
  );
  return formes;
}

const resultats: Resultat[] = [];
console.log(
  `Examen : ${cas.length} question(s), formule ${premium ? "Premium" : "gratuite"}.\n`,
);
for (const [i, q] of cas.entries()) {
  const debut = Date.now();
  const [c] = await db
    .insert(schema.collectes)
    .values({
      userId: "examen",
      title: q.demande,
      request: q.demande,
      columns: q.colonnes,
      maxRows: q.maxLignes ?? 10,
      tier: premium ? "premium" : "free",
      status: "running",
      startedAt: new Date(),
    })
    .returning();
  try {
    await runCollecte(c.id);
  } catch (e) {
    console.error(`  erreur : ${(e as Error).message}`);
  }
  const [fini] = await db
    .select()
    .from(schema.collectes)
    .where(eq(schema.collectes.id, c.id));
  const lignes = await db
    .select()
    .from(schema.rows)
    .where(eq(schema.rows.collecteId, c.id))
    .orderBy(schema.rows.position);
  const [{ appels }] = await db
    .select({ appels: sql<number>`count(*)::int` })
    .from(schema.llmUsage)
    .where(eq(schema.llmUsage.collecteId, c.id));
  const e = evaluer(lignes, q.attentes);
  const alertes = fini.log
    .filter((l) => l.level === "warn" || l.level === "error")
    .map((l) => l.message);
  const r: Resultat = {
    ...e,
    id: q.id,
    forme: q.forme,
    secteur: q.secteur,
    demande: q.demande,
    secondes: Math.round((Date.now() - debut) / 1000),
    appelsIa: appels,
    statut: fini.status,
    alertes,
  };
  resultats.push(r);
  const echecs = e.verifications
    .filter((v) => !v.ok)
    .map((v) => `${v.nom} (${v.detail})`);
  console.log(
    `[${i + 1}/${cas.length}] ${Math.round(e.note * 100)
      .toString()
      .padStart(3)} %  ${q.id}  ·  ${e.lignes} ligne(s), ${r.secondes} s` +
      (echecs.length ? `\n         manque : ${echecs.join(" ; ")}` : "") +
      alertes.map((a) => `\n         alerte : ${a}`).join(""),
  );
  ecrireRapport();
  // Fournisseur d'IA saturé : les notes suivantes ne mesureraient que la saturation, pas la qualité
  if (alertes.some((a) => /saturé|429/i.test(a))) {
    console.log("\nFournisseur d'IA saturé (limite de requêtes atteinte) : examen arrêté. Relance plus tard les questions restantes.");
    break;
  }
}

const formes = ecrireRapport();
console.log(`\nNote globale : ${p(moyenne(resultats.map((r) => r.note)))}`);
for (const f of formes)
  console.log(
    `  ${f.padEnd(14)} ${p(moyenne(resultats.filter((r) => r.forme === f).map((r) => r.note)))}`,
  );
console.log(`\nRapport : ${dossier}/${horodatage}.md`);

// Laisse finir le versement des publications dans la base de test
await new Promise((r) => setTimeout(r, 5000));
process.exit(0);
