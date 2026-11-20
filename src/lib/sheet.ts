/** Lecture de fichiers tableur dans le navigateur (CSV, Excel .xlsx) : une ligne de titres, puis les données. */

export type Sheet = {
  fileName: string;
  headers: string[];
  rows: string[][];
  /** Classeur Excel : onglet lu, onglets lisibles et fichier (pour relire un autre onglet). */
  sheet?: string;
  sheets?: string[];
  file?: File;
};

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

/**
 * Le tableau d'une grille : la ligne de titres est la première ligne bien remplie (un titre ou une légende
 * au-dessus du tableau est ignoré), puis les données. Les colonnes entièrement vides sont retirées.
 */
function tableFrom(raw: string[][]): { headers: string[]; rows: string[][] } | null {
  const grid = raw.map((r) => r.map((v) => v.trim())).filter((r) => r.some(Boolean));
  if (grid.length < 2) return null;
  const filled = (r: string[]) => r.filter(Boolean).length;
  const widest = Math.max(...grid.slice(0, 50).map(filled));
  const h = grid.slice(0, 20).findIndex((r) => filled(r) >= Math.max(2, Math.ceil(widest * 0.6)));
  const start = h < 0 ? 0 : h;
  const body = grid.slice(start);
  if (body.length < 2) return null;
  const width = Math.max(...body.slice(0, 50).map((r) => r.length));
  const keep = Array.from({ length: width }, (_, i) => i).filter((i) => body.some((r) => r[i]));
  return { headers: keep.map((i, j) => body[0][i] || `Colonne ${j + 1}`), rows: body.slice(1).map((r) => keep.map((i) => r[i] ?? "")) };
}

const cellText = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

/**
 * Lit un fichier. Pour un classeur Excel à plusieurs onglets, l'onglet retenu est celui qui contient le plus
 * de données (un onglet « Légende » ou « Instructions » est donc écarté), sauf si `sheetName` en désigne un.
 */
export async function readFile(file: File, sheetName?: string): Promise<Sheet> {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    const tables = sheets.map((sh) => ({ name: sh.sheet, table: tableFrom(sh.data.map((r) => r.map(cellText))) }));
    const usable = tables.filter((t): t is { name: string; table: NonNullable<typeof t.table> } => t.table !== null);
    if (!usable.length) throw new Error("Aucun onglet ne contient une ligne de titres et des données.");
    const chosen =
      usable.find((t) => t.name === sheetName) ??
      usable.reduce((best, t) => (t.table.rows.length * t.table.headers.length > best.table.rows.length * best.table.headers.length ? t : best));
    return { fileName: file.name, ...chosen.table, sheet: chosen.name, sheets: usable.map((t) => t.name), file };
  }
  let grid: string[][];
  if (/\.(csv|txt)$/i.test(file.name)) grid = parseCsv(await file.text());
  else if (/\.json$/i.test(file.name)) grid = jsonToGrid(await file.text());
  else if (/\.(xls|ods|numbers)$/i.test(file.name))
    throw new Error("Ce format de tableur n'est pas lu directement : enregistre le fichier en Excel (.xlsx) ou en CSV, puis réessaie.");
  else throw new Error("Format non pris en charge : utilise un fichier Excel (.xlsx), CSV ou JSON.");
  const table = tableFrom(grid);
  if (!table) throw new Error("Le fichier doit contenir une ligne de titres et au moins une ligne de données.");
  return { fileName: file.name, ...table };
}
