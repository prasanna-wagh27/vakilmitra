import type { CourtCase } from "@vakilmitra/shared";

/** The shapes live in @vakilmitra/shared, so the apps show exactly what the worker stores. */
export type { CourtCase, CourtHearing, CourtOrder } from "@vakilmitra/shared";

/** Reads a case from a court-data service. */
export interface CourtProvider {
  /** Short name, kept with each reading, e.g. "ecourtsindia". */
  readonly name: string;
  /** The current record for a CNR, or null when the courts have no case with that CNR. */
  fetchCase(cnr: string, opts?: { signal?: AbortSignal }): Promise<CourtCase | null>;
}

/**
 * A reading failed. `retryable` is true for the service being busy or down (try again later),
 * false for problems that waiting will not fix (wrong key, no credits, an answer we cannot read).
 */
export class CourtProviderError extends Error {
  override name = "CourtProviderError";
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class CourtsConfigError extends Error {
  override name = "CourtsConfigError";
}
