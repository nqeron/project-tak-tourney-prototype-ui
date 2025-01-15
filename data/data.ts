type KnownTournamentRecord = {
  infoPath: string;
  playersCsvUrl: string | null;
  gamesApiUrl: string | null;
};

const INTERMEDIATE_TOURNAMENT_NOV_2024: KnownTournamentRecord = {
  infoPath: "./data/2024-11-16-intermediate-tournament.tournamentInfo.json",
  playersCsvUrl:
    "https://raw.githubusercontent.com/devp/project-tak-tourney-adhoc/refs/heads/main/data/2024-11-16-intermediate-tournament.players.csv",
  gamesApiUrl:
    "https://api.playtak.com/v1/games-history?page=0&limit=100&type=Tournament&mirror=true",
};

const BEGINNER_TOURNAMENT_JAN_2025: KnownTournamentRecord = {
  infoPath: "./data/2025-01-17-beginner-tournament.tournamentInfo.json",
  playersCsvUrl: null,
  gamesApiUrl:
    "https://api.playtak.com/v1/games-history?page=0&limit=100&type=Tournament&mirror=true",
};

export const KNOWN_TOURNAMENTS = {
  INTERMEDIATE_TOURNAMENT_NOV_2024: INTERMEDIATE_TOURNAMENT_NOV_2024,
  BEGINNER_TOURNAMENT_JAN_2025: BEGINNER_TOURNAMENT_JAN_2025,
};
