import { useEffect, useState } from "react";
import { Shell } from "./components/Shell.tsx";
import { FpaWorkbench } from "./workbenches/FpaWorkbench.tsx";
import { ProvenancePanel } from "./components/ProvenancePanel.tsx";
import { loadCfdm } from "./cfdm/client.ts";
import type { CfdmDataset, DrillTarget } from "./cfdm/types.ts";

export function App() {
  const [data, setData] = useState<CfdmDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillTarget | null>(null);

  useEffect(() => {
    loadCfdm().then(setData).catch((e) => setError(String(e)));
  }, []);

  return (
    <Shell source={data ? data.source : "loading…"}>
      {error ? (
        <main className="fw-main"><div className="fw-loading">{error}</div></main>
      ) : data ? (
        <FpaWorkbench data={data} onDrill={setDrill} />
      ) : (
        <main className="fw-main"><div className="fw-loading">Loading CFDM from SAP FI…</div></main>
      )}
      <ProvenancePanel item={drill} onClose={() => setDrill(null)} />
    </Shell>
  );
}
