import { useEffect, useState } from "react";
import { Shell, type Persona } from "./components/Shell.tsx";
import { FpaWorkbench } from "./workbenches/FpaWorkbench.tsx";
import { CfoWorkbench } from "./workbenches/CfoWorkbench.tsx";
import { ProvenancePanel } from "./components/ProvenancePanel.tsx";
import { ArtifactPanel } from "./components/ArtifactPanel.tsx";
import { loadCfdm } from "./cfdm/client.ts";
import type { CfdmDataset, DrillTarget } from "./cfdm/types.ts";
import type { CfoDeal, CfoDealset } from "./cfo/types.ts";

export function App() {
  const [persona, setPersona] = useState<Persona>("cfo");
  const [cfdm, setCfdm] = useState<CfdmDataset | null>(null);
  const [deals, setDeals] = useState<CfoDealset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillTarget | null>(null);
  const [dealDrill, setDealDrill] = useState<CfoDeal | null>(null);

  useEffect(() => {
    loadCfdm().then(setCfdm).catch((e) => setError(String(e)));
    fetch(`${import.meta.env.BASE_URL}cfo-deals.json`).then((r) => r.json()).then(setDeals).catch((e) => setError(String(e)));
  }, []);

  const switchPersona = (p: Persona) => {
    setPersona(p);
    setDrill(null);
    setDealDrill(null);
  };

  const source = persona === "cfo" ? deals?.source ?? "loading…" : cfdm?.source ?? "loading…";
  const loaded = persona === "cfo" ? deals : cfdm;

  return (
    <Shell persona={persona} onPersona={switchPersona} source={source}>
      {error ? (
        <main className="fw-main"><div className="fw-loading">{error}</div></main>
      ) : !loaded ? (
        <main className="fw-main"><div className="fw-loading">Loading…</div></main>
      ) : persona === "cfo" ? (
        <CfoWorkbench data={deals!} onOpen={setDealDrill} />
      ) : (
        <FpaWorkbench data={cfdm!} onDrill={setDrill} />
      )}
      {persona === "cfo" ? <ArtifactPanel deal={dealDrill} onClose={() => setDealDrill(null)} /> : <ProvenancePanel item={drill} onClose={() => setDrill(null)} />}
    </Shell>
  );
}
