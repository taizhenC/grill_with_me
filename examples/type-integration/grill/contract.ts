// Stable agreement api.rank.response; owner Backend.
export interface RankResponse { trails: { id: string; shadeScore: number }[] }
export const Paths = { rank: "/api/rank" } as const;
