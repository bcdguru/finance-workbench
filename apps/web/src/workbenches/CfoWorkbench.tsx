import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell, Tile, Tag } from "@carbon/react";
import type { CfoDealset, CfoDeal } from "../cfo/types.ts";
import { fmtMoney } from "../cfdm/client.ts";
import { summarize, verdictFor } from "./cfo-model.ts";
import { VerdictTag } from "../components/ArtifactPanel.tsx";

export function CfoWorkbench({ data, onOpen }: { data: CfoDealset; onOpen: (d: CfoDeal) => void }) {
  const s = summarize(data);
  const cell = (deal: CfoDeal, skill: string) => {
    const v = verdictFor(deal, skill);
    return v ? <VerdictTag verdict={v} /> : <span className="muted">—</span>;
  };

  return (
    <main className="fw-main">
      <h1>CFO workbench</h1>
      <div className="sub">{data.tenant} · decision pipeline · sourced from {data.source}</div>

      <div className="fw-kpis">
        <Kpi label="Deals in pipeline" value={String(s.total)} note="active decisions" />
        <Kpi label="Cleared to model" value={String(s.clearedToModel)} note="audit PROCEED" />
        <Kpi label="Reframe / rework" value={String(s.reframeOrRework)} note="ORANGE or REWORK" />
        <Kpi
          label="Harsh-verdict rate"
          value={`${Math.round(s.harshVerdictRate * 100)}%`}
          note={s.harshRateHealthy ? "within 25–50% band ✓" : "outside healthy band"}
          tone={s.harshRateHealthy ? "ok" : "warn"}
        />
      </div>

      <h2>Decision pipeline (click a deal to open its chain)</h2>
      <Table size="lg" useZebraStyles>
        <TableHead>
          <TableRow>
            <TableHeader>Deal</TableHeader>
            <TableHeader>Sponsor</TableHeader>
            <TableHeader>Amount</TableHeader>
            <TableHeader>Thesis</TableHeader>
            <TableHeader>Review</TableHeader>
            <TableHeader>Audit</TableHeader>
            <TableHeader>Status</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.deals.map((deal) => (
            <TableRow key={deal.id} className="drillable" onClick={() => onOpen(deal)}>
              <TableCell>{deal.title}<div className="muted">{deal.decisionType}</div></TableCell>
              <TableCell>{deal.sponsor}</TableCell>
              <TableCell className="num">{fmtMoney(deal.amount)}</TableCell>
              <TableCell>{cell(deal, "cfo-office-hours")}</TableCell>
              <TableCell>{cell(deal, "cfo-strategic-review")}</TableCell>
              <TableCell>{cell(deal, "cfo-forensic-audit")}</TableCell>
              <TableCell>{deal.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="fw-foot">Harsh-verdict rate is a health metric: a chain that only ever returns the green verdict is broken. The 25–50% band signals genuine adversarial review.</p>
    </main>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "ok" | "warn" }) {
  return (
    <Tile className="fw-kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className={`note ${tone === "warn" ? "neg" : tone === "ok" ? "pos" : ""}`}>{note}</div>
    </Tile>
  );
}
