import { Router } from "jsr:@oak/oak/router";
import type { RouterContext } from "jsr:@oak/oak/router";
import { ApiResponseCache, GeneratedTournamentStatusCache } from "./cache.ts";
import { API_URL, apiUrlForId, KNOWN_TOURNAMENTS } from "../data/data.ts";
import { adminRouter } from "./routes/admin.ts";
import { makeRenderer } from "./util/renderer.ts";
import {
  additionalGameIdsToFetch,
  analyzeTournamentProgress,
  GameResultConstants,
  PlaytakApiTypeGuards,
  TournamentStatusTypeGuards,
} from "@tak-tourney-adhoc";

import type {
  PlaytakApiTypes,
  TournamentStatusTypes,
} from "@tak-tourney-adhoc";
import { Tournament } from "./models/tournament.ts";
type GameResult = PlaytakApiTypes.GameResult;
type TournamentStatus = TournamentStatusTypes.TournamentStatus;
type TournamentPlayer = TournamentStatusTypes.TournamentPlayer;

// Aliases for nested modules
const { isGameResult, isGameListResponse } = PlaytakApiTypeGuards;
const { isTournamentStatus } = TournamentStatusTypeGuards;
const { WINS_FOR_WHITE, WINS_FOR_BLACK, TIES } = GameResultConstants;

export const router = new Router();

// Admin routes
router.use("/admin", adminRouter.routes());
router.use("/admin", adminRouter.allowedMethods());

router.get("/", (ctx: RouterContext<string>) => {
  ctx.response.redirect("/tournaments");
});

router.get("/tournaments", (ctx: RouterContext<string>) => {
  return (makeRenderer("./tournaments", {
    title: "Tournament List",
    tournaments: Object.keys(KNOWN_TOURNAMENTS),
  }))(ctx);
});

async function fetchGamesResponse(url: string) {
  const cachedResponse = ApiResponseCache.get(url);
  if (cachedResponse) {
    if (isGameListResponse(cachedResponse)) {
      return cachedResponse;
    } else {
      console.info("Cache response failed isGameListResponse check");
    }
  }
  const response = await (await fetch(url)).json();
  if (!isGameListResponse(response)) {
    console.error("API response failed isGameListResponse check");
    return null;
  }
  ApiResponseCache.set(url, response);
  return response;
}

async function fetchGameById(id: number): Promise<GameResult | null> {
  const url = apiUrlForId(id);
  const cachedResponse = ApiResponseCache.get(url);
  if (cachedResponse) {
    return cachedResponse as GameResult;
  }
  const response = await (await fetch(url)).json();
  if (!isGameResult(response)) {
    console.error("API response failed isGameResult check");
    return null;
  }
  ApiResponseCache.set(url, response);
  return response;
}

async function getTournamentData(id: string, kv: Deno.Kv) {
  const tournament = await Tournament.load(id, kv);
  if (!tournament.info) {
    return { error: 400 };
  }
  const tournamentInfo = tournament.info;

  let status: TournamentStatus | undefined;
  const cachedStatus = GeneratedTournamentStatusCache.get(id);
  if (cachedStatus && isTournamentStatus(cachedStatus)) {
    status = cachedStatus;
  } else {
    const gamesResponse = await fetchGamesResponse(API_URL);
    if (gamesResponse === null) {
      return { error: 400 };
    }
    const games = gamesResponse.items;

    const additionalGameIds = additionalGameIdsToFetch(tournamentInfo);
    if (additionalGameIds.length > 0) {
      const additionalGames = (await Promise.all(additionalGameIds.map(
        (id) => fetchGameById(id),
      ))).filter((g) => g !== null);
      if (additionalGames.length > 0) {
        games.push(...additionalGames);
      }
    }

    status = analyzeTournamentProgress({
      tournamentInfo,
      games,
    });

    GeneratedTournamentStatusCache.set(id, status);
  }

  return { tournamentInfo, status, error: null };
}

router.get("/tournaments/:id", async (ctx: RouterContext<string>) => {
  const id = ctx.params.id;
  const kv = await Deno.openKv();
  const { tournamentInfo, status, error } = await getTournamentData(id, kv);
  if (!tournamentInfo) {
    return ctx.response.status = 404;
  }
  if (error) {
    return ctx.response.status = error;
  }

  const groupStatus = (status?.tournamentType === "groupStage")
    ? {
      groups: status.groups.map((group) => ({
        name: group.name,
      })),
    }
    : null;

  return (makeRenderer("./tournament", {
    title: tournamentInfo.name,
    tournament: {
      id,
      name: tournamentInfo.name,
      infoUrl: tournamentInfo.infoUrl,
    },
    groupStatus,
  }))(ctx);
});

function getGroup(status: TournamentStatus, groupIndex: number) {
  if (isNaN(groupIndex) || groupIndex < 0) {
    return { error: 400 };
  }
  if (status.tournamentType !== "groupStage") {
    return { error: 404 };
  }
  if (groupIndex >= status.groups.length) {
    return { error: 404 };
  }

  const group = status.groups[groupIndex];
  const groupPlayers = status.players.filter((player) =>
    player.group === group.name
  ).sort((a, b) => {
    // Sort by score, then by games played
    const scoreComparison = (b.score ?? 0) - (a.score ?? 0);
    if (scoreComparison !== 0) return scoreComparison;
    return (b.games_played ?? 0) - (a.games_played ?? 0);
  });

  const ranks: Record<string, number> = {};
  for (const [i, player] of groupPlayers.entries()) {
    if (
      i > 0 &&
      groupPlayers[i - 1].score === player.score
    ) {
      ranks[player.username] = ranks[groupPlayers[i - 1].username];
    } else {
      ranks[player.username] = i + 1;
    }
  }

  return { group, groupPlayers, ranks };
}

router.get(
  "/tournaments/:id/groups/:groupIndex",
  async (ctx: RouterContext<string>) => {
    const kv = await Deno.openKv();
    const id = ctx.params.id;
    const { tournamentInfo, status, error } = await getTournamentData(id, kv);
    if (error) {
      return ctx.response.status = error;
    }
    if (!tournamentInfo) {
      return ctx.response.status = 404;
    }

    if (status?.tournamentType !== "groupStage") {
      return ctx.response.status = 404;
    }

    const groupIndex = parseInt(ctx.params.groupIndex);
    const { group, groupPlayers, ranks, error: error2 } = getGroup(
      status,
      groupIndex,
    );
    if (!group) {
      return ctx.response.status = 404;
    }
    if (error2) {
      return ctx.response.status = error2;
    }

    const winner = (group.winner && !Array.isArray(group.winner))
      ? group.winner
      : null;
    const tiedWinners = (group.winner && Array.isArray(group.winner) &&
        (group.winner.length < groupPlayers.length))
      ? group.winner
      : null;

    return (makeRenderer("./tournament-group", {
      title: `${group.name} - ${tournamentInfo.name}`,
      tournament: {
        id,
        name: tournamentInfo.name,
        infoUrl: tournamentInfo.infoUrl,
      },
      group: {
        index: groupIndex,
        name: group.name,
        players: groupPlayers.map((player) => ({
          ...player,
          rank: ranks?.[player.username],
        })),
        winner,
        tiedWinners,
        winner_method: group.winner_method,
      },
    }))(ctx);
  },
);

router.get(
  "/tournaments/:id/groups/:groupIndex/players/:username",
  async (ctx: RouterContext<string>) => {
    const kv = await Deno.openKv();
    const id = ctx.params.id;
    const { tournamentInfo, status, error } = await getTournamentData(id, kv);
    if (error) {
      return ctx.response.status = error;
    }
    if (!tournamentInfo) {
      return ctx.response.status = 404;
    }

    if (status?.tournamentType !== "groupStage") {
      return ctx.response.status = 404;
    }

    const groupIndex = parseInt(ctx.params.groupIndex);
    const { group, groupPlayers, ranks, error: error2 } = getGroup(
      status,
      groupIndex,
    );
    if (error2) {
      return ctx.response.status = error2;
    }

    const username = ctx.params.username;
    if (!username) {
      return ctx.response.status = 404;
    }

    const player = groupPlayers?.find((player) => player.username === username);
    if (!player) {
      return ctx.response.status = 404;
    }

    const games = status.games?.filter((game) =>
      game.player_white === username || game.player_black === username
    );

    const matchups: Record<
      string,
      { games: GameResult[]; score: number; opponentScore: number }
    > = Object.fromEntries(
      (groupPlayers ?? [])
        .filter((player) => player.username !== username)
        .map((player) => {
          const matchupGames = games?.filter((game) =>
            game.player_white === player.username ||
            game.player_black === player.username
          ) ?? [];
          let score = 0;
          let opponentScore = 0;
          for (const game of matchupGames) {
            if (WINS_FOR_WHITE.includes(game.result)) {
              if (game.player_white === username) {
                score += 2;
              } else {
                opponentScore += 2;
              }
            } else if (WINS_FOR_BLACK.includes(game.result)) {
              if (game.player_black === username) {
                score += 2;
              } else {
                opponentScore += 2;
              }
            } else if (TIES.includes(game.result)) {
              score += 1;
              opponentScore += 1;
            }
          }
          return [player.username, {
            games: matchupGames,
            score,
            opponentScore,
          }];
        }),
    );

    return (makeRenderer("./tournament-group-player", {
      title: `Player ${player.username} - ${tournamentInfo.name}`,
      tournament: {
        id,
        name: tournamentInfo.name,
      },
      group: {
        name: group?.name,
        index: groupIndex,
      },
      player: {
        ...player,
        rank: ranks?.[player.username],
      },
      games,
      matchups,
    }))(ctx);
  },
);
