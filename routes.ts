import { Router } from "jsr:@oak/oak/router";
import type { RouterContext } from "jsr:@oak/oak/router";
import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
import { ApiResponseCache, GeneratedTournamentStatusCache } from "./cache.ts";
import { API_URL, KNOWN_TOURNAMENTS } from "./data/data.ts";
import {
  analyzeTournamentProgress,
  GameResultConstants,
  PlaytakApiTypeGuards,
  TournamentStatusTypeGuards,
} from "@tak-tourney-adhoc";

import type {
  PlaytakApiTypes,
  TournamentStatusTypes,
} from "@tak-tourney-adhoc";
type GameListResponse = PlaytakApiTypes.GameListResponse;
type GameResult = PlaytakApiTypes.GameResult;
type TournamentStatus = TournamentStatusTypes.TournamentStatus;
type TournamentInfo = TournamentStatusTypes.TournamentInfo;
type TournamentPlayer = TournamentStatusTypes.TournamentPlayer;

// Aliases for nested modules
const { isGameListResponse } = PlaytakApiTypeGuards;
const { isTournamentStatus, isTournamentInfoFromJson } =
  TournamentStatusTypeGuards;
const { WINS_FOR_WHITE, WINS_FOR_BLACK, TIES } = GameResultConstants;

export const router = new Router();

const eta = new Eta({ views: "./templates" });

function makeRenderer(templateName: string, templateOptions = {}) {
  return (ctx: RouterContext<string>) => {
    ctx.response.body = eta.render(templateName, templateOptions);
  };
}

router.get("/", (ctx: RouterContext<string>) => {
  ctx.response.redirect("/tournaments");
});

router.get("/tournaments", (ctx: RouterContext<string>) => {
  return (makeRenderer("./tournaments", {
    title: "Tournament List",
    tournaments: Object.keys(KNOWN_TOURNAMENTS),
  }))(ctx);
});

function parsePlayersCsv(playersCsv: string) {
  const rows: [string, string][] = playersCsv.trim().split("\n").map(
    (line) => line.trim().split(","),
  ).filter(Boolean).map(
    (parts) => [parts[0].trim(), parts[1].trim()] as [string, string],
  );
  return rows.map(([username, group]) => ({ username, group }));
}

async function fetchGamesResponse(url: string) {
  const cachedResponse = ApiResponseCache.get(url);
  if (cachedResponse && isGameListResponse(cachedResponse)) {
    return cachedResponse;
  }
  const response2 = await (await fetch(url)).json();
  const response = response2 as GameListResponse;
  // FIXME: this check stopped working, meh
  // if (!isGameListResponse(response)) {
  //   return null;
  // }
  ApiResponseCache.set(url, response);
  return response;
}

async function getTournamentData(id: string) {
  const tournamentData =
    KNOWN_TOURNAMENTS[id as keyof typeof KNOWN_TOURNAMENTS] ?? null;
  if (tournamentData === null) {
    return { error: 404 };
  }

  const tournamentInfoFromJson = JSON.parse(
    await Deno.readTextFile(tournamentData.infoPath),
  );
  if (!isTournamentInfoFromJson(tournamentInfoFromJson)) {
    return { error: 400 };
  }

  const tournamentInfo: TournamentInfo = {
    ...tournamentInfoFromJson,
    dateRange: {
      start: new Date(tournamentInfoFromJson.dateRange.start),
      end: new Date(tournamentInfoFromJson.dateRange.end),
    },
  };

  let status: TournamentStatus | undefined;
  if (tournamentData.playersCsvUrl) {
    const cachedStatus = GeneratedTournamentStatusCache.get(id);
    if (cachedStatus && isTournamentStatus(cachedStatus)) {
      status = cachedStatus;
    } else {
      const gamesResponse = await fetchGamesResponse(API_URL);
      if (gamesResponse === null) {
        return { error: 400 };
      }
      const games = gamesResponse.items;

      const playersCsv = await (await fetch(tournamentData.playersCsvUrl))
        .text();
      const players: TournamentPlayer[] = parsePlayersCsv(playersCsv);
      tournamentInfo.players = players;

      status = analyzeTournamentProgress({
        tournamentInfo,
        games,
      });

      GeneratedTournamentStatusCache.set(id, status);
    }
  }

  return { tournamentInfo, status, error: null };
}

router.get("/tournaments/:id", async (ctx: RouterContext<string>) => {
  const id = ctx.params.id;
  const { tournamentInfo, status, error } = await getTournamentData(id);
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
    const id = ctx.params.id;
    const { tournamentInfo, status, error } = await getTournamentData(id);
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
    const id = ctx.params.id;
    const { tournamentInfo, status, error } = await getTournamentData(id);
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
