import type { RankResponse } from "../grill/contract";

export function rankResponse(): RankResponse {
  return { trails: [{ id: "oak-loop", shadeScore: 75 }] };
}
