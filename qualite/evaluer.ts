import type { Attentes } from "./cas";

export type Ligne = {
  data: Record<string, string | number | boolean | null>;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

export type Verification = { nom: string; ok: boolean; detail: string };

export type Evaluation = {
  /** Part des vérifications réussies, de 0 à 1. */
  note: number;
  verifications: Verification[];
  lignes: number;
  /** Part des lignes qui citent une source (page, base, carte) plutôt que les seules connaissances du modèle. */
  sourcees: number;
  /** Sources utilisées et nombre de lignes de chacune. */
  sources: Record<string, number>;
};

const plier = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const vide = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const hote = (url: string | null) => {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
};
const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Compare les lignes obtenues aux attentes d'une question de l'examen. */
export function evaluer(lignes: Ligne[], attentes: Attentes): Evaluation {
  const v: Verification[] = [];

  v.push({
    nom: "lignes",
    ok: lignes.length >= attentes.minLignes,
    detail: `${lignes.length} ligne(s), ${attentes.minLignes} attendue(s) au moins`,
  });

  if (attentes.source) {
    const attendue = plier(attentes.source);
    const n = lignes.filter((l) => plier(l.sourceTitle).includes(attendue) || plier(l.sourceUrl).includes(attendue)).length;
    v.push({ nom: "source", ok: n > 0, detail: `${n} ligne(s) venant de ${attentes.source}` });
  }

  for (const [colonne, min] of Object.entries(attentes.remplies ?? {})) {
    const part = lignes.length ? lignes.filter((l) => !vide(l.data[colonne])).length / lignes.length : 0;
    v.push({ nom: `colonne ${colonne}`, ok: lignes.length > 0 && part >= min, detail: `remplie à ${pct(part)}, ${pct(min)} attendu` });
  }

  const textes = lignes.map((l) => plier(Object.values(l.data).join(" · ")));
  for (const entree of attentes.contient ?? []) {
    const choix = entree.split("|").map(plier);
    const trouve = textes.some((t) => choix.some((c) => t.includes(c)));
    v.push({ nom: `contient « ${entree} »`, ok: trouve, detail: trouve ? "trouvé" : "absent" });
  }

  const sources: Record<string, number> = {};
  for (const l of lignes) {
    const s = l.sourceTitle?.split(" + ")[0]?.trim() || hote(l.sourceUrl) || "connaissances du modèle";
    sources[s] = (sources[s] ?? 0) + 1;
  }

  return {
    note: v.filter((x) => x.ok).length / v.length,
    verifications: v,
    lignes: lignes.length,
    sourcees: lignes.length ? lignes.filter((l) => l.sourceUrl).length / lignes.length : 0,
    sources,
  };
}
