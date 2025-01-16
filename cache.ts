import { Cache } from "jsr:@lambdalisue/ttl-cache";

const API_RESPONSE_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export const ApiResponseCache = new Cache<string, object>(API_RESPONSE_CACHE_TTL_MS);