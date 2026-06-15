/**
 * Thin OData transport for the SAP FI adapter. The adapter speaks to SAP through
 * this interface so it can run against (a) a live S/4 OData service, (b) an ECC
 * extractor gateway, or (c) a deterministic fixture for tests — without the
 * mapping/adapter logic knowing the difference.
 */
export interface ODataPage {
  value: any[];
  /** Server-driven paging cursor, if the source returned more rows. */
  nextSkip?: number;
}

export interface ODataQuery {
  /** Delta token / changed-since filter for incremental (CDC) pulls. */
  since?: string;
  top?: number;
  skip?: number;
}

export interface ODataClient {
  list(entitySet: string, query?: ODataQuery): Promise<ODataPage>;
  ping(): Promise<boolean>;
}

/**
 * Live S/4 OData client (REST/JSON). Credentials come from the tenant's vault in
 * production — never from the harness. Entity-set names are configurable because
 * they differ across S/4 releases and ECC extractor gateways.
 */
export interface HttpODataConfig {
  baseUrl: string;
  /** Bearer token resolved from the vault by the adapter worker. */
  token?: string;
  fetchImpl?: typeof fetch;
}

export class HttpODataClient implements ODataClient {
  private fetchImpl: typeof fetch;
  constructor(private config: HttpODataConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async list(entitySet: string, query: ODataQuery = {}): Promise<ODataPage> {
    const params = new URLSearchParams({ $format: "json" });
    if (query.top != null) params.set("$top", String(query.top));
    if (query.skip != null) params.set("$skip", String(query.skip));
    if (query.since) params.set("$filter", `LastChangeDateTime gt ${query.since}`);

    const url = `${this.config.baseUrl.replace(/\/$/, "")}/${entitySet}?${params}`;
    const res = await this.fetchImpl(url, {
      headers: { accept: "application/json", ...(this.config.token ? { authorization: `Bearer ${this.config.token}` } : {}) },
    });
    if (!res.ok) throw new Error(`SAP OData ${entitySet} HTTP ${res.status}: ${await res.text()}`);
    const body: any = await res.json();
    // S/4 wraps rows in { d: { results: [...] } } (v2) or { value: [...] } (v4).
    const value: any[] = body?.value ?? body?.d?.results ?? [];
    const more = value.length === (query.top ?? value.length) && value.length > 0;
    return { value, nextSkip: more ? (query.skip ?? 0) + value.length : undefined };
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.config.baseUrl.replace(/\/$/, "")}/$metadata`, {
        headers: this.config.token ? { authorization: `Bearer ${this.config.token}` } : {},
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Deterministic in-memory OData client backed by fixture rows. Lets the adapter
 * be exercised end-to-end (and certified) with no live SAP system. Supports
 * paging and a naive `since` filter so incremental behavior is testable.
 */
export class FixtureODataClient implements ODataClient {
  constructor(private data: Record<string, any[]>, private healthy = true) {}

  async list(entitySet: string, query: ODataQuery = {}): Promise<ODataPage> {
    let rows = this.data[entitySet] ?? [];
    if (query.since) rows = rows.filter((r) => String(r.LastChangeDateTime ?? "") > query.since!);
    const skip = query.skip ?? 0;
    const top = query.top ?? rows.length;
    const slice = rows.slice(skip, skip + top);
    const nextSkip = skip + slice.length < rows.length ? skip + slice.length : undefined;
    return { value: slice, nextSkip };
  }

  async ping(): Promise<boolean> {
    return this.healthy;
  }
}
