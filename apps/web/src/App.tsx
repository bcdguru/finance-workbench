import { useEffect, useRef, useState } from "react";
import { AuditLog, type PersonaId } from "@fw/access";
import { Shell, type Persona } from "./components/Shell.tsx";
import { FpaWorkbench } from "./workbenches/FpaWorkbench.tsx";
import { CfoWorkbench } from "./workbenches/CfoWorkbench.tsx";
import { ProvenancePanel } from "./components/ProvenancePanel.tsx";
import { ArtifactPanel } from "./components/ArtifactPanel.tsx";
import { loadCfdm } from "./cfdm/client.ts";
import type { CfdmDataset, DrillTarget } from "./cfdm/types.ts";
import type { CfoDeal, CfoDealset } from "./cfo/types.ts";
import { DEMO_ROLES } from "./access/roles.ts";
import { firstAccessiblePersona, personaAccess } from "./access/access-model.ts";

export function App() {
  const [roleIndex, setRoleIndex] = useState(0);
  const grant = DEMO_ROLES[roleIndex]!;

  const [persona, setPersona] = useState<Persona>(() => (firstAccessiblePersona(DEMO_ROLES[0]!) as Persona) ?? "fpa");
  const [cfdm, setCfdm] = useState<CfdmDataset | null>(null);
  const [deals, setDeals] = useState<CfoDealset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillTarget | null>(null);
  const [dealDrill, setDealDrill] = useState<CfoDeal | null>(null);

  const auditLog = useRef(new AuditLog());
  const [auditCount, setAuditCount] = useState(0);
  const audit = (actor: string, action: string, resource: string, allowed = true, reasons?: string[]) => {
    auditLog.current.record({ actor, action, resource, allowed, reasons });
    setAuditCount(auditLog.current.size);
  };

  useEffect(() => {
    loadCfdm().then(setCfdm).catch((e) => setError(String(e)));
    fetch(`${import.meta.env.BASE_URL}cfo-deals.json`).then((r) => r.json()).then(setDeals).catch((e) => setError(String(e)));
    audit(DEMO_ROLES[0]!.subject, "open_workbench", persona);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchPersona = (p: Persona) => {
    const decision = personaAccess(grant, p as PersonaId);
    audit(grant.subject, "open_workbench", p, decision.allowed, decision.reasons);
    if (!decision.allowed) return; // shell shouldn't offer it, but enforce anyway
    setPersona(p);
    setDrill(null);
    setDealDrill(null);
  };

  const switchRole = (i: number) => {
    const next = DEMO_ROLES[i]!;
    setRoleIndex(i);
    audit(next.subject, "switch_role", next.role);
    // If the current persona is no longer granted, fall back to the first accessible one.
    const stillOk = personaAccess(next, persona as PersonaId).allowed;
    const target = (stillOk ? persona : firstAccessiblePersona(next)) as Persona | null;
    if (target) {
      setPersona(target);
      audit(next.subject, "open_workbench", target);
    }
    setDrill(null);
    setDealDrill(null);
  };

  const onDrill = (d: DrillTarget) => {
    audit(grant.subject, "drill_to_source", d.provenance.source_object_id);
    setDrill(d);
  };
  const onOpenDeal = (d: CfoDeal) => {
    audit(grant.subject, "open_deal_chain", d.id);
    setDealDrill(d);
  };

  const source = persona === "cfo" ? deals?.source ?? "loading…" : cfdm?.source ?? "loading…";
  const loaded = persona === "cfo" ? deals : cfdm;

  return (
    <Shell persona={persona} onPersona={switchPersona} source={source} grant={grant} roles={DEMO_ROLES} roleIndex={roleIndex} onRole={switchRole} auditCount={auditCount}>
      {error ? (
        <main className="fw-main"><div className="fw-loading">{error}</div></main>
      ) : !loaded ? (
        <main className="fw-main"><div className="fw-loading">Loading…</div></main>
      ) : persona === "cfo" ? (
        <CfoWorkbench data={deals!} onOpen={onOpenDeal} />
      ) : (
        <FpaWorkbench data={cfdm!} onDrill={onDrill} />
      )}
      {persona === "cfo" ? <ArtifactPanel deal={dealDrill} onClose={() => setDealDrill(null)} /> : <ProvenancePanel item={drill} onClose={() => setDrill(null)} />}
    </Shell>
  );
}
