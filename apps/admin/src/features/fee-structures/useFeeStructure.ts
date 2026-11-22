import type { FeeStructureInput } from "@cbpupsis/shared/fees";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { FeeStructureDataSource } from "./dataSource";

/** One key factory for the feature; the owner keeps one admin's cache from another's. */
export const feeStructureKeys = {
  all: ["fee-structures"] as const,
  options: (owner: string | undefined) => [...feeStructureKeys.all, "options", owner] as const,
  term: (owner: string | undefined, termId: string) =>
    [...feeStructureKeys.all, owner, termId] as const,
};

/** The terms and programs the form picks from. */
export function useFeeStructureOptions(
  source: FeeStructureDataSource,
  owner: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: feeStructureKeys.options(owner),
    queryFn: ({ signal }) => source.options(signal),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useFeeStructure(
  source: FeeStructureDataSource,
  owner: string | undefined,
  termId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: feeStructureKeys.term(owner, termId),
    queryFn: ({ signal }) => source.get(termId, signal),
    enabled: enabled && termId !== "",
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSaveFeeStructure(
  source: FeeStructureDataSource,
  owner: string | undefined,
  termId: string,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: FeeStructureInput) => source.save(termId, input),
    retry: false,
    onSuccess: (saved) => {
      client.setQueryData(feeStructureKeys.term(owner, termId), saved);
      void client.invalidateQueries({ queryKey: feeStructureKeys.options(owner) });
    },
  });
}
