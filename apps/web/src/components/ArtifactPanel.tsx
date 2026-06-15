import { Tag } from "@carbon/react";
import type { CfoDeal } from "../cfo/types.ts";
import { verdictTone, type Tone } from "../workbenches/cfo-model.ts";

const TAG_TYPE: Record<Tone, "green" | "teal" | "magenta" | "red" | "gray"> = {
  good: "green", caution: "teal", reframe: "magenta", bad: "red", neutral: "gray",
};
export const VerdictTag = ({ verdict }: { verdict: string }) => (
  <Tag type={TAG_TYPE[verdictTone(verdict)]} size="sm">{verdict.replace(/_/g, " ")}</Tag>
);

const SKILL_LABEL: Record<string, string> = {
  "cfo-office-hours": "Office hours — thesis",
  "cfo-strategic-review": "Strategic review",
  "cfo-forensic-audit": "Forensic audit",
};

/** Per-deal chain timeline — the audit trail the harness produced for a decision. */
export function ArtifactPanel({ deal, onClose }: { deal: CfoDeal | null; onClose: () => void }) {
  if (!deal) return null;
  return (
    <aside className="fw-drill">
      <div className="head">
        <div>
          <div className="t">{deal.title}</div>
          <div className="s">{deal.sponsor} · {deal.decisionType}</div>
        </div>
        <button className="x" aria-label="Close" onClick={onClose}>×</button>
      </div>
      <div className="body">
        <p className="trace">Decision chain — each skill is gated by the one before it. {deal.artifacts.length} artifact(s) produced.</p>
        {deal.artifacts.map((a, i) => (
          <div className="art" key={i}>
            <div className="art-head">
              <span className="art-skill">{SKILL_LABEL[a.skill] ?? a.skill}</span>
              <VerdictTag verdict={a.verdict} />
            </div>
            <div className="art-meta">{a.modelId} · {new Date(a.createdAt).toISOString().slice(0, 10)}</div>
            <ArtifactSummary body={a.body} />
          </div>
        ))}
      </div>
    </aside>
  );
}

function ArtifactSummary({ body }: { body: any }) {
  const line = body?.value_thesis?.one_sentence ?? body?.recommended_next_step ?? body?.portfolio_recommendation;
  return (
    <div className="art-body">
      {line && <p className="art-line">{line}</p>}
      <details>
        <summary>Artifact JSON</summary>
        <pre>{JSON.stringify(body, null, 2)}</pre>
      </details>
    </div>
  );
}
