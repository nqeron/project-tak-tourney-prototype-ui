import { Cache } from "jsr:@lambdalisue/ttl-cache";

const FIVE_MINUTES_MS = 1000 * 60 * 5;

export const ApiResponseCache = new Cache<string, object>(
  FIVE_MINUTES_MS,
);

export const GeneratedTournamentStatusCache = new Cache<
  string,
  object
>(FIVE_MINUTES_MS);

const TournamentIdsCache = new Cache<string, string[]>(FIVE_MINUTES_MS);
export const getTournamentIdCache = () =>
  TournamentIdsCache.get("tournament-ids");
export const setTournamentIdCache = (ids: string[]) =>
  TournamentIdsCache.set("tournament-ids", ids);
