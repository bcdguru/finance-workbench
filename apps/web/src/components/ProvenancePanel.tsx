import { Button, Tag } from "@carbon/react";
import type { DrillTarget } from "../cfdm/types.ts";

/**
 * Drill-to-source. Provenance is a first-class UI element (architecture FR-3):
 * every figure in the workbench can be traced to its source system and source
 * object in one click. The "Open in SAP" affordance is where the adapter's
 * deep-link into the system of record lands.
 */
export function ProvenancePanel({ item, onClose }: { item: DrillTarget | null; onClose: () => void }) {
  if (!item) return null;
  const p = item.provenance;
  const extracted = new Date(p.extracted_at);

  return (
    <aside className="fw-drill">
      <div className="head">
        <div>
          <div className="t">Trace to source</div>
          <div className="s">{item.title}</div>
        </div>
        <button className="x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="body">
        {item.subtitle && <p className="trace">{item.subtitle}</p>}
        <div className="prov-row">
          <div className="k">Source system</div>
          <div className="v">
            <Tag type="blue" size="sm">{p.source_system}</Tag>
          </div>
        </div>
        <div className="prov-row">
          <div className="k">Source object</div>
          <div className="v">{p.source_object_id}</div>
        </div>
        <div className="prov-row">
          <div className="k">Extracted at</div>
          <div className="v">{extracted.toISOString().replace("T", " ").slice(0, 19)}Z</div>
        </div>
        <div className="prov-row">
          <div className="k">Transform</div>
          <div className="v">{p.transform_version}</div>
        </div>
        <p className="trace">
          This value was read from {p.source_system.toUpperCase()} and mapped to CFDM. No figure in the workbench exists without this chain.
        </p>
        <Button kind="tertiary" size="sm" onClick={() => alert(`Deep link to ${p.source_system}: document ${p.source_object_id}`)}>
          Open in {p.source_system === "sap-fi" ? "SAP" : p.source_system}
        </Button>
      </div>
    </aside>
  );
}
