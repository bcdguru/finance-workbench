import type { ReactNode } from "react";

const PERSONAS = [
  { name: "FP&A", active: true },
  { name: "CFO", active: false, phase: "soon" },
  { name: "Controller", active: false, phase: "P2" },
  { name: "Treasury", active: false, phase: "P3" },
  { name: "Tax", active: false, phase: "P3" },
];

const SOURCES = [
  { name: "SAP FI/CO", phase: "live" },
  { name: "Oracle Fusion", phase: "P2" },
  { name: "OneStream", phase: "P2" },
  { name: "Ariba", phase: "P3" },
];

export function Shell({ children, source }: { children: ReactNode; source: string }) {
  return (
    <div className="fw-app">
      <header className="fw-header">
        <div className="mark">FW</div>
        <span className="title">Finance Workbench</span>
        <span className="crumb">/ FP&amp;A</span>
        <div className="right">
          <span>{source}</span>
          <button className="oh" onClick={() => window.open("http://localhost:4173", "_blank")}>
            Office Hours
          </button>
        </div>
      </header>
      <div className="fw-body">
        <nav className="fw-nav">
          <div className="group">Personas</div>
          {PERSONAS.map((p) => (
            <div key={p.name} className={`item ${p.active ? "active" : "disabled"}`}>
              {p.name}
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
