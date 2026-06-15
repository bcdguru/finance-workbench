import type { ReactNode } from "react";

export type Persona = "fpa" | "cfo";

const PERSONAS: { id: Persona | string; label: string; active: boolean; phase?: string }[] = [
  { id: "cfo", label: "CFO", active: true },
  { id: "fpa", label: "FP&A", active: true },
  { id: "controller", label: "Controller", active: false, phase: "P2" },
  { id: "treasury", label: "Treasury", active: false, phase: "P3" },
  { id: "tax", label: "Tax", active: false, phase: "P3" },
];

const SOURCES = [
  { name: "SAP FI/CO", phase: "live" },
  { name: "Oracle Fusion", phase: "P2" },
  { name: "OneStream", phase: "P2" },
  { name: "Ariba", phase: "P3" },
];

export function Shell({ children, persona, onPersona, source }: { children: ReactNode; persona: Persona; onPersona: (p: Persona) => void; source: string }) {
  return (
    <div className="fw-app">
      <header className="fw-header">
        <div className="mark">FW</div>
        <span className="title">Finance Workbench</span>
        <span className="crumb">/ {persona === "cfo" ? "CFO" : "FP&A"}</span>
        <div className="right">
          <span>{source}</span>
          <button className="oh" onClick={() => window.open("http://localhost:4173", "_blank")}>Office Hours</button>
        </div>
      </header>
      <div className="fw-body">
        <nav className="fw-nav">
          <div className="group">Personas</div>
          {PERSONAS.map((p) => (
            <div
              key={p.id}
              className={`item ${!p.active ? "disabled" : persona === p.id ? "active" : "clickable"}`}
              onClick={p.active ? () => onPersona(p.id as Persona) : undefined}
            >
              {p.label}
              {p.phase && <span className="phase">{p.phase}</span>}
            </div>
          ))}
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
