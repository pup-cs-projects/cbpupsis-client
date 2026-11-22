import type { Session } from "@cbpupsis/shared/auth";
import type { AdminFeeApi, FeeStructureInput } from "@cbpupsis/shared/fees";
import { feeApi, session } from "../../lib/auth";

/** The fee structure calls, each run with the signed-in admin's token. */
export function createFeeStructureDataSource(api: AdminFeeApi, auth: Pick<Session, "authorized">) {
  return {
    get: (termId: string, signal?: AbortSignal) =>
      auth.authorized((token) => api.get(token, termId, signal)),
    save: (termId: string, input: FeeStructureInput) =>
      auth.authorized((token) => api.save(token, termId, input)),
  };
}

export type FeeStructureDataSource = ReturnType<typeof createFeeStructureDataSource>;

export const feeStructureDataSource = createFeeStructureDataSource(feeApi, session);
