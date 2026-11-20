/** Lecture de fichiers tableur dans le navigateur (CSV, Excel .xlsx) : une ligne de titres, puis les données. */

export type Sheet = { fileName: string; headers: string[]; rows: string[][] };

/** Lecture d'un CSV : séparateur deviné (; , ou tabulation), guillemets et retours à la ligne dans les cellules. */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const firstLine = text.split("\n", 1)[0];
  const sep = [";", ",", "\t"].map((s) => [s, firstLine.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && !cell) quoted = true;
    else if (ch === sep) endCell();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endCell();
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) {
    endCell();
    rows.push(row);
  }
  return rows;
}

/** JSON : une liste d'objets (ou { "data": [...] }), les clés deviennent les colonnes. */
function jsonToGrid(text: string): string[][] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier JSON est illisible.");
  }
  if (data && !Array.isArray(data) && typeof data === "object") data = Object.values(data).find(Array.isArray);
  if (!Array.isArray(data) || !data.every((r) => r && typeof r === "object" && !Array.isArray(r)))
    throw new Error("Le JSON doit contenir une liste d'objets, par exemple [{\"nom\": \"…\", \"telephone\": \"…\"}].");
  const keys = [...new Set(data.slice(0, 200).flatMap((r) => Object.keys(r as object)))];
  const cell = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return [keys, ...data.map((r) => keys.map((k) => cell((r as Record<string, unknown>)[k])))];
}

export async function readFile(file: File): Promise<Sheet> {
  let grid: string[][];
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    grid = data.map((r) => r.map((v) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v))));
  } else if (/\.(csv|txt)$/i.test(file.name)) {
    grid = parseCsv(await file.text());
  } else if (/\.json$/i.test(file.name)) {
    grid = jsonToGrid(await file.text());
  } else if (/\.(xls|ods|numbers)$/i.test(file.name)) {
    throw new Error("Ce format de tableur n'est pas lu directement : enregistre le fichier en Excel (.xlsx) ou en CSV, puis réessaie.");
  } else {
    throw new Error("Format non pris en charge : utilise un fichier Excel (.xlsx), CSV ou JSON.");
  }
  grid = grid.map((r) => r.map((v) => v.trim())).filter((r) => r.some(Boolean));
  if (grid.length < 2) throw new Error("Le fichier doit contenir une ligne de titres et au moins une ligne de données.");
  const width = Math.max(...grid.slice(0, 50).map((r) => r.length));
  // Colonnes sans titre ni valeur : ignorées
  const keep = Array.from({ length: width }, (_, i) => i).filter((i) => grid.some((r) => r[i]));
  const headers = keep.map((i, j) => grid[0][i] || `Colonne ${j + 1}`);
  const rows = grid.slice(1).map((r) => keep.map((i) => r[i] ?? ""));
  return { fileName: file.name, headers, rows };
}
