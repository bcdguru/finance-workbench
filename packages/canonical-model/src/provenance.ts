import { z } from "zod";

/**
 * Provenance is mandatory on every CFDM entity instance. No number rendered in
 * any workbench may exist without a traceable origin (architecture FR-3 / FR-6).
 * This is the load-bearing field that makes "drill to source in <= 3 clicks" and
 * the Controller's multi-source reconciliation queue possible.
 */
export const Provenance = z.object({
  /** Adapter/source system the value was extracted from, e.g. "sap-fi", "oracle-fusion". */
  source_system: z.string().min(1),
  /** Stable identifier of the source object, e.g. an SAP FI document number. */
  source_object_id: z.string().min(1),
  /** ISO-8601 timestamp of extraction. */
  extracted_at: z.string().datetime(),
  /** Version of the adapter transform that produced this CFDM shape. */
  transform_version: z.string().min(1),
});
export type Provenance = z.infer<typeof Provenance>;
