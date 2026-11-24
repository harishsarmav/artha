"use client";

import { useMemo, useRef, useState } from "react";
import { importType, parseCsv, parseImportAmount, parseImportDate, suggestColumn } from "../lib/transaction-csv";
import type { CsvTable, ImportedTransaction } from "../lib/transaction-csv";

type Props = { onImport: (rows: ImportedTransaction[]) => Promise<{ inserted: number; duplicates: number }> };
type DateFormat = "dmy" | "mdy" | "ymd";

const LIMIT_BYTES = 5 * 1024 * 1024;
const LIMIT_ROWS = 3000;

export function TransactionCsvImport({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState<CsvTable | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState({ date: "", description: "", amount: "", debit: "", credit: "", category: "", type: "" });
  const [separateAmounts, setSeparateAmounts] = useState(false);
  const [dateFormat, setDateFormat] = useState<DateFormat>("dmy");
  const [fallbackType, setFallbackType] = useState<"Expense" | "Income">("Expense");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setOpen(false); setTable(null); setFileName(""); setError(""); setNotice("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (file?: File) => {
    setError(""); setNotice(""); setTable(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Choose a CSV statement. PDF import is not available yet."); return;
    }
    if (file.size > LIMIT_BYTES) { setError("This CSV is larger than 5 MB. Export a smaller date range and try again."); return; }
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.rows.length > LIMIT_ROWS) { setError(`This file has ${parsed.rows.length.toLocaleString()} rows. Import up to ${LIMIT_ROWS.toLocaleString()} at a time.`); return; }
      setFileName(file.name); setTable(parsed);
      const debit = suggestColumn(parsed.headers, ["debit", "withdrawal", "withdrawals", "outflow"]);
      const credit = suggestColumn(parsed.headers, ["credit", "deposit", "deposits", "inflow"]);
      const split = Boolean(debit || credit);
      setSeparateAmounts(split);
      setMapping({
        date: suggestColumn(parsed.headers, ["date", "transaction date", "txn date", "value date"]),
        description: suggestColumn(parsed.headers, ["description", "narration", "particulars", "merchant", "details", "memo"]),
        amount: suggestColumn(parsed.headers, ["amount", "transaction amount", "value"]),
        debit,
        credit,
        category: suggestColumn(parsed.headers, ["category", "transaction category"]),
        type: suggestColumn(parsed.headers, ["type", "transaction type", "dr cr", "credit debit"]),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this CSV.");
    }
  };

  const { validRows, invalidRows } = useMemo(() => {
    if (!table || !mapping.date || !mapping.description || (!separateAmounts && !mapping.amount) || (separateAmounts && !mapping.debit && !mapping.credit)) return { validRows: [] as ImportedTransaction[], invalidRows: table?.rows.length || 0 };
    const get = (row: string[], key: keyof typeof mapping) => {
      const index = Number(mapping[key]);
      return mapping[key] === "" || !Number.isInteger(index) ? "" : row[index] || "";
    };
    const valid: ImportedTransaction[] = [];
    let invalid = 0;
    for (const row of table.rows) {
      const date = parseImportDate(get(row, "date"), dateFormat);
      const description = get(row, "description").trim().slice(0, 180);
      let amount: number | null;
      let transactionType: "Expense" | "Income";
      if (separateAmounts) {
        const debitRaw = get(row, "debit"), creditRaw = get(row, "credit");
        const debit = parseImportAmount(debitRaw), credit = parseImportAmount(creditRaw);
        if (debitRaw.trim() && (debit === null || debit === 0) || creditRaw.trim() && (credit === null || credit === 0)) { invalid++; continue; }
        if ((debit || 0) > 0 && (credit || 0) > 0) { invalid++; continue; }
        if ((debit || 0) > 0) { amount = debit; transactionType = "Expense"; }
        else if ((credit || 0) > 0) { amount = credit; transactionType = "Income"; }
        else { invalid++; continue; }
      } else {
        const rawAmount = get(row, "amount");
        amount = parseImportAmount(rawAmount);
        transactionType = mapping.type ? importType(get(row, "type"), fallbackType) : (/^-|^\(.*\)$/.test(rawAmount.trim()) ? "Expense" : fallbackType);
      }
      if (!date || !description || amount === null || amount <= 0) { invalid++; continue; }
      const category = get(row, "category").trim().slice(0, 80) || "Other";
      valid.push({ transactionDate: date, description, amount: Math.round(amount * 100) / 100, transactionType, category });
    }
    return { validRows: valid, invalidRows: invalid };
  }, [table, mapping, separateAmounts, dateFormat, fallbackType]);

  const selectColumn = (label: string, value: string, key: keyof typeof mapping, optional = false) => (
    <label className="field"><span>{label}</span><select value={value} onChange={(event) => setMapping((old) => ({ ...old, [key]: event.target.value }))}>
      {optional && <option value="">Not in file</option>}{table?.headers.map((header, index) => <option value={String(index)} key={`${key}-${index}`}>{header}</option>)}
    </select></label>
  );

  const submit = async () => {
    if (!validRows.length || invalidRows > 0) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await onImport(validRows);
      setNotice(`${result.inserted.toLocaleString()} saved${result.duplicates ? ` · ${result.duplicates.toLocaleString()} matching entries skipped` : ""}.`);
      if (result.inserted) reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save these entries. Please try again.");
    } finally { setBusy(false); }
  };

  return <>
    <button className="secondary" type="button" onClick={() => { setOpen(true); setError(""); setNotice(""); }}>↑ Import CSV</button>
    {open && <div className="importBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) reset(); }}>
      <section className="importDialog" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
        <header className="importDialogHead"><div><div className="eyebrow">PRIVATE BY DESIGN</div><h2 id="csv-import-title">Import transactions from CSV</h2></div><button className="iconClose" type="button" onClick={reset} disabled={busy} aria-label="Close import">×</button></header>
        <div className="importDialogBody">
          <p className="importPrivacy">Your file is read in this browser. It is not uploaded or sent to AI. Review the preview before saving entries to your FinBuddy account.</p>
          <label className="importDrop"><strong>Choose a CSV file</strong><span>Bank or card statement · maximum 5 MB and 3,000 rows</span><input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(event) => { const selectedFile = event.target.files?.[0]; event.target.value = ""; void onFile(selectedFile); }}/></label>
          {error && <div className="error" role="alert">{error}</div>}
          {notice && <div className="importNotice" role="status">{notice}</div>}
          {table && <>
            <div className="importFileName">{fileName} · {table.rows.length.toLocaleString()} rows</div>
            <div className="importMapping"><div className="eyebrow">MATCH YOUR COLUMNS</div><div className="formGrid two">
              {selectColumn("Date column", mapping.date, "date")}
              {selectColumn("Description column", mapping.description, "description")}
              <div className="importMode"><span>Amount layout</span><label><input type="radio" checked={!separateAmounts} onChange={() => setSeparateAmounts(false)}/> One amount column</label><label><input type="radio" checked={separateAmounts} onChange={() => setSeparateAmounts(true)}/> Separate debit and credit</label></div>
              {separateAmounts ? (
                <>
                  {selectColumn("Debit / withdrawal column", mapping.debit, "debit", true)}
                  {selectColumn("Credit / deposit column", mapping.credit, "credit", true)}
                </>
              ) : (
                <>
                  {selectColumn("Amount column", mapping.amount, "amount")}
                  {selectColumn("Type column (optional)", mapping.type, "type", true)}
                </>
              )}
              {selectColumn("Category column (optional)", mapping.category, "category", true)}
              <label className="field"><span>Date format</span><select value={dateFormat} onChange={(event) => setDateFormat(event.target.value as DateFormat)}><option value="dmy">DD/MM/YYYY · India</option><option value="mdy">MM/DD/YYYY</option><option value="ymd">YYYY/MM/DD</option></select></label>
              {!separateAmounts && !mapping.type && <label className="field"><span>Default type for unsigned amounts</span><select value={fallbackType} onChange={(event) => setFallbackType(event.target.value as "Expense" | "Income")}><option>Expense</option><option>Income</option></select></label>}
            </div></div>
            <div className="importPreviewHead"><strong>Preview</strong><span>{validRows.length} valid · {invalidRows} skipped</span></div>
            {invalidRows > 0 && <p className="importWarning" role="status">Rows with unreadable dates, descriptions, or amounts will be skipped. Check the column mapping before importing.</p>}
            <div className="importPreview"><table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th>Amount</th></tr></thead><tbody>{validRows.slice(0, 8).map((row, index) => <tr key={`${row.transactionDate}-${index}`}><td>{row.transactionDate}</td><td>{row.description}</td><td>{row.transactionType}</td><td>{row.category}</td><td>₹{row.amount.toLocaleString("en-IN")}</td></tr>)}</tbody></table></div>
          </>}
          <p className="importPdfNote">CSV import is supported now. PDF statements are not parsed yet; export the statement as CSV from your bank or card provider for this first release.</p>
        </div>
        <footer className="importDialogFoot"><button className="secondary" type="button" onClick={reset} disabled={busy}>Cancel</button><button className="primary" type="button" onClick={() => void submit()} disabled={busy || !table || !validRows.length}>{busy ? "Saving entries…" : `Import ${validRows.length.toLocaleString()} entries`}</button></footer>
      </section>
    </div>}
  </>;
}
