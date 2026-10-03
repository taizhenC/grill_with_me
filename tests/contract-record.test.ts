import { describe, expect, it } from "vitest";
import { agreementHashes, hashText, parseProposal, recordId } from "../cli/contract-record.mjs";

const block = "### [agreement:api.rank.response]\nReturn a shadeScore number.\n";
const proposal = {
  schemaVersion: 1, kind: "merge", parentRevision: null, summary: "Initial agreement",
  changedAgreementIds: ["api.rank.response"], approval: "agreed", agreedBy: ["Backend"],
  pendingRoles: [], types: "none", amendmentResolution: [],
};

describe("deterministic contract record format", () => {
  it("normalizes Git line endings while retaining meaningful content and metadata", () => {
    expect(hashText("hello\r\n")).toBe("5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03");
    expect(recordId({ parent: null, number: 1 })).toBe(recordId({ number: 1, parent: null }));
    expect(recordId({ number: 2, parent: null })).not.toBe(recordId({ number: 1, parent: null }));
  });

  it("ignores agreement markers hidden in comments and both code fence types", () => {
    const literals = `${block}\n\`\`\`html\n<!-- literal\n### [agreement:fake.one]\n\`\`\`\n~~~md\n### [agreement:fake.two]\n~~~\n<!--\n### [agreement:fake.three]\n-->\n`;
    expect(Object.keys(agreementHashes(literals))).toEqual(["api.rank.response"]);
    expect(agreementHashes(block.replace(/\n/g, "\r\n"))).toEqual(agreementHashes(block));
  });

  it.each(["", "### [agreement:empty]\n", `${block}\n${block}`, "### [agreement:api..rank]\nInvalid.\n"])("rejects missing/empty/duplicate/invalid agreement blocks", (text) => {
    expect(() => agreementHashes(text)).toThrow();
  });

  it("defaults only optional pending-resolution metadata", () => {
    expect(parseProposal(JSON.stringify(proposal))).toMatchObject({ ...proposal, resolvesPending: [] });
  });

  it.each([
    { schemaVersion: 2 }, { force: true }, { kind: "overwrite" }, { parentRevision: "fake" },
    { summary: " " }, { summary: "a".repeat(501) }, { summary: "one\ntwo" },
    { approval: "pending" }, { pendingRoles: ["backend"] }, { agreedBy: [] },
    { changedAgreementIds: ["api.rank.response", "api.rank.response"] }, { changedAgreementIds: ["../unsafe"] },
    { types: "delete" }, { amendmentResolution: [{ revision: "0".repeat(64), decision: "force", note: "discard" }] },
    { resolvesPending: ["fake"] }, { legacyHistoryHash: "fake" },
  ])("rejects malformed or ambiguous proposal metadata: %j", (changes) => {
    expect(() => parseProposal(JSON.stringify({ ...proposal, ...changes }))).toThrow();
  });
});
