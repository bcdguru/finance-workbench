import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell, Tile, Tag } from "@carbon/react";
import type { CfdmDataset, DrillTarget, TrialBalanceLine } from "../cfdm/types.ts";
import { fmtMoney, fmtPct } from "../cfdm/client.ts";
import { buildFpaModel, REVIEW_THRESHOLD_PCT } from "./fpa-model.ts";

export function FpaWorkbench({ data, onDrill }: { data: CfdmDataset; onDrill: (d: DrillTarget) => void }) {
  const { current, prior, curTB, flux, toReview, kpis, nameOf } = buildFpaModel(data);

  const drillTB = (line: TrialBalanceLine, label: string): DrillTarget => ({
    title: `${nameOf(line.account_id)} · ${line.period}`,
    subtitle: label,
    provenance: line.provenance,
  });

  return (
    <main className="fw-main">
      <h1>FP&amp;A workbench</h1>
      <div className="sub">
        {data.tenant} · ledger 0L · period {current} · sourced from {data.source} · CFDM v{data.cfdmVersion}
      </div>

      <div className="fw-kpis">
        <Kpi label="Total assets" value={fmtMoney(kpis.totalAssets)} note={`period ${current}`} />
        <Kpi label="Revenue (period)" value={fmtMoney(kpis.revenue)} note="from GL" />
        <Kpi label="Operating expense" value={fmtMoney(kpis.opex)} note="from GL" />
        <Kpi label="Items to review" value={String(toReview)} note={`flux ≥ ${REVIEW_THRESHOLD_PCT}%`} />
      </div>

      <h2>Flux review — {prior} → {current} (click a row to trace to source)</h2>
      <Table size="lg" useZebraStyles>
        <TableHead>
          <TableRow>
            <TableHeader>Account</TableHeader>
            <TableHeader>Prior</TableHeader>
            <TableHeader>Current</TableHeader>
            <TableHeader>Δ</TableHeader>
            <TableHeader>Δ %</TableHeader>
            <TableHeader>Status</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {flux.map((f) => (
            <TableRow key={f.line.account_id} className="drillable" onClick={() => onDrill(drillTB(f.line, `Flux ${fmtPct(f.deltaPct)} vs ${prior}`))}>
              <TableCell>{f.line.account_id} — {nameOf(f.line.account_id)}</TableCell>
              <TableCell className="num">{fmtMoney(f.prev)}</TableCell>
              <TableCell className="num">{fmtMoney(f.line.balance)}</TableCell>
              <TableCell className={`num ${f.delta >= 0 ? "pos" : "neg"}`}>{fmtMoney(f.delta)}</TableCell>
              <TableCell className="num">{fmtPct(f.deltaPct)}</TableCell>
              <TableCell>
                <Tag type={f.review ? "red" : "green"} size="sm">{f.review ? "Review" : "OK"}</Tag>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <h2>Trial balance — {current}</h2>
      <Table size="lg" useZebraStyles>
        <TableHead>
          <TableRow>
            <TableHeader>Account</TableHeader>
            <TableHeader>Debit</TableHeader>
            <TableHeader>Credit</TableHeader>
            <TableHeader>Balance</TableHeader>
            <TableHeader>Source</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {curTB.map((line) => (
            <TableRow key={line.account_id} className="drillable" onClick={() => onDrill(drillTB(line, "Trial-balance line"))}>
              <TableCell>{line.account_id} — {nameOf(line.account_id)}</TableCell>
              <TableCell className="num">{fmtMoney(line.debit)}</TableCell>
              <TableCell className="num">{fmtMoney(line.credit)}</TableCell>
              <TableCell className={`num ${line.balance >= 0 ? "pos" : "neg"}`}>{fmtMoney(line.balance)}</TableCell>
              <TableCell><Tag type="blue" size="sm">{line.provenance.source_system}</Tag></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <h2>Journal entries</h2>
      <Table size="lg" useZebraStyles>
        <TableHead>
          <TableRow>
            <TableHeader>Document</TableHeader>
            <TableHeader>Posted</TableHeader>
            <TableHeader>Lines</TableHeader>
            <TableHeader>Amount</TableHeader>
            <TableHeader>Source object</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.journals.map((j) => {
            const amount = j.lines.reduce((s, l) => s + l.debit, 0);
            return (
              <TableRow key={j.journal_id} className="drillable" onClick={() => onDrill({ title: `Journal ${j.journal_id}`, subtitle: "Accounting document", provenance: j.provenance })}>
                <TableCell>{j.journal_id}</TableCell>
                <TableCell>{j.posted_at.slice(0, 10)}</TableCell>
                <TableCell className="num">{j.lines.length}</TableCell>
                <TableCell className="num">{fmtMoney(amount)}</TableCell>
                <TableCell>{j.provenance.source_object_id}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </main>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Tile className="fw-kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="note">{note}</div>
    </Tile>
  );
}
