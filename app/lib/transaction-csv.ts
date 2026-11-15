export type ImportedTransaction = {
  transactionDate: string;
  description: string;
  amount: number;
  transactionType: "Expense" | "Income";
  category: string;
};

export type CsvTable = { headers: string[]; rows: string[][] };

function delimiterFor(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const options = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const option of options) {
    let quoted = false;
    let count = 0;
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '"') {
        if (quoted && firstLine[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && firstLine[i] === option) count++;
    }
    if (count > bestCount) { best = option; bestCount = count; }
  }
  return best;
}

export function parseCsv(text: string): CsvTable {
  const source = text.replace(/^\uFEFF/, "");
  const delimiter = delimiterFor(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell.trim()); cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted value.");
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one transaction row.");

  const headers = rows[0].map((value, index) => value || `Column ${index + 1}`);
  const width = headers.length;
  return { headers, rows: rows.slice(1).map((values) => Array.from({ length: width }, (_, index) => values[index] || "")) };
}

export function suggestColumn(headers: string[], kinds: string[]): string {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  const index = normalized.findIndex((header) => kinds.some((kind) => header === kind || header.includes(kind)));
  return index >= 0 ? String(index) : "";
}

export function parseImportDate(raw: string, format: "dmy" | "mdy" | "ymd"): string | null {
  const value = raw.trim();
  if (!value) return null;
  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  let year: number, month: number, day: number;
  if (iso) {
    [, year, month, day] = iso.map(Number) as [number, number, number, number];
  } else {
    const parts = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (!parts) return null;
    const a = Number(parts[1]), b = Number(parts[2]);
    year = Number(parts[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (format === "dmy") { day = a; month = b; }
    else if (format === "mdy") { month = a; day = b; }
    else { year = a < 100 ? a + 2000 : a; month = b; day = Number(parts[3]); }
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function parseImportAmount(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const negativeByBrackets = /^\(.*\)$/.test(value);
  const cleaned = value.replace(/[₹$€£,\s]/g, "").replace(/[()]/g, "").replace(/^(INR|Rs\.?)/i, "");
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return null;
  return Math.abs(negativeByBrackets ? -amount : amount);
}

export function importType(raw: string, fallback: "Expense" | "Income"): "Expense" | "Income" {
  const value = raw.trim().toLowerCase();
  if (/income|credit|deposit|salary|refund|received|\bcr\b|crdt/.test(value)) return "Income";
  if (/expense|debit|withdraw|purchase|paid|payment|\bdr\b|dbt/.test(value)) return "Expense";
  return fallback;
}
