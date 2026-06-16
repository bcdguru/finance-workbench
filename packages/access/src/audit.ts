/**
 * Append-only audit log (architecture FR-5: SOC 2-ready audit logging of every
 * read and write). Browser-safe; ids are sequential so no Node crypto needed.
 * In production this is persisted per-tenant; here it backs an in-memory trail.
 */
export interface AuditEvent {
  id: string;
  actor: string;
  /** e.g. "open_workbench", "read", "drill_to_source", "run_session". */
  action: string;
  resource: string;
  scope?: string;
  allowed: boolean;
  /** Denial reasons, when allowed is false. */
  reasons?: string[];
  at: string;
}

export class AuditLog {
  private events: AuditEvent[] = [];
  private seq = 0;

  record(e: Omit<AuditEvent, "id" | "at">): AuditEvent {
    const event: AuditEvent = { ...e, id: `evt_${++this.seq}`, at: new Date().toISOString() };
    this.events.push(event);
    return event;
  }

  list(): AuditEvent[] {
    return [...this.events];
  }

  /** Denied attempts — the access-control exceptions an auditor looks for first. */
  denied(): AuditEvent[] {
    return this.events.filter((e) => !e.allowed);
  }

  get size(): number {
    return this.events.length;
  }
}
