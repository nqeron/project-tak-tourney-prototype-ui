import { Cache } from "jsr:@lambdalisue/ttl-cache";

const FIVE_MINUTES_MS = 1000 * 60 * 5;

const API_RESPONSE_CACHE_TTL_MS = FIVE_MINUTES_MS;

const GENERATED_TOURNAMENT_STATUS_CACHE_TTL_MS = FIVE_MINUTES_MS;

export const ApiResponseCache = new Cache<string, object>(
  API_RESPONSE_CACHE_TTL_MS,
);

export const GeneratedTournamentStatusCache = new Cache<
  string,
  object
>(GENERATED_TOURNAMENT_STATUS_CACHE_TTL_MS);
