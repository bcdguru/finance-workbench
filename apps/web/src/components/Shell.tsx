import type { ReactNode } from "react";
import type { Grant, PersonaId } from "@fw/access";
import { BUILT, personaAccess } from "../access/access-model.ts";

export type Persona = "fpa" | "cfo";

const PERSONAS: { id: PersonaId; label: string; phase?: string }[] = [
  { id: "cfo", label: "CFO" },
  { id: "fpa", label: "FP&A" },
  { id: "controller", label: "Controller", phase: "P2" },
  { id: "treasury", label: "Treasury", phase: "P3" },
  { id: "tax", label: "Tax", phase: "P3" },
];

const SOURCES = [
  { name: "SAP FI/CO", phase: "live" },
  { name: "Oracle Fusion", phase: "P2" },
  { name: "OneStream", phase: "P2" },
  { name: "Ariba", phase: "P3" },
];

export interface ShellProps {
  children: ReactNode;
  persona: Persona;
  onPersona: (p: Persona) => void;
  source: string;
  grant: Grant;
  roles: Grant[];
  roleIndex: number;
  onRole: (i: number) => void;
  auditCount: number;
}

export function Shell({ children, persona, onPersona, source, grant, roles, roleIndex, onRole, auditCount }: ShellProps) {
  return (
    <div className="fw-app">
      <header className="fw-header">
        <div className="mark">FW</div>
        <span className="title">Finance Workbench</span>
        <span className="crumb">/ {persona === "cfo" ? "CFO" : "FP&A"}</span>
        <div className="right">
          <span>{source}</span>
          <span className="audit" title="SOC 2-style audit log">{auditCount} audited</span>
          <select className="role" value={roleIndex} onChange={(e) => onRole(Number(e.target.value))} title={grant.subject}>
            {roles.map((r, i) => <option key={i} value={i}>{r.role}</option>)}
          </select>
          <button className="oh" onClick={() => window.open("http://localhost:4173", "_blank")}>Office Hours</button>
        </div>
      </header>
      <div className="fw-body">
        <nav className="fw-nav">
          <div className="group">Personas</div>
          {PERSONAS.map((p) => {
            const built = BUILT.includes(p.id);
            const access = personaAccess(grant, p.id);
            const locked = built && !access.allowed;
            const active = built && access.allowed && persona === (p.id as Persona);
            const clickable = built && access.allowed && !active;
            const cls = active ? "active" : clickable ? "clickable" : "disabled";
            return (
              <div
                key={p.id}
                className={`item ${cls}`}
                title={locked ? access.reasons.join("; ") : undefined}
                onClick={clickable ? () => onPersona(p.id as Persona) : undefined}
              >
                {p.label}
                {locked ? <span className="phase lock">locked</span> : p.phase ? <span className="phase">{p.phase}</span> : null}
              </div>
            );
          })}
          <div className="group">Sources</div>
          {SOURCES.map((s) => (
            <div key={s.name} className={`item ${s.phase === "live" ? "" : "disabled"}`}>
              {s.name}
              <span className="phase">{s.phase}</span>
            </div>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
