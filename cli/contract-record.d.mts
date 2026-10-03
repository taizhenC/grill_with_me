export type ContractProposal = {
  schemaVersion: 1;
  kind: "merge" | "amend" | "adopt";
  parentRevision: string | null;
  summary: string;
  changedAgreementIds: string[];
  approval: "agreed" | "pending";
  agreedBy: string[];
  pendingRoles: string[];
  types: "none" | "preserve" | "replace";
  amendmentResolution: Array<{ revision: string; decision: "preserved" | "reconciled"; note: string }>;
  legacyHistoryHash?: string;
  resolvesPending: string[];
};
export const agreementId: RegExp;
export function hashText(text: string): string;
export function recordId(record: unknown): string;
export function agreementHashes(markdown: string): Record<string, string>;
export function parseProposal(raw: string): ContractProposal;
