type KnownTournamentRecord = {
  infoPath: string;
  playersCsvUrl: string | null;
};

export const API_URL: string =
  "https://api.playtak.com/v1/games-history?page=0&limit=500&type=Tournament&mirror=true";

export const apiUrlForId = (id: number) =>
  `https://api.playtak.com/v1/games-history/${id}`;

const INTERMEDIATE_TOURNAMENT_NOV_2024: KnownTournamentRecord = {
  infoPath: "./data/2024-11-16-intermediate-tournament.tournamentInfo.json",
  playersCsvUrl:
    "https://raw.githubusercontent.com/devp/project-tak-tourney-adhoc/refs/heads/main/data/2024-11-16-intermediate-tournament.players.csv",
};

const BEGINNER_TOURNAMENT_JAN_2025: KnownTournamentRecord = {
  infoPath: "./data/2025-01-17-beginner-tournament.tournamentInfo.json",
  playersCsvUrl:
    "https://gist.githubusercontent.com/devp/6ac3e0a57d3c68c67e7f3750aeb120e8/raw/166cf1e3bb3c80cd52c1ec23a01c88a01fa6377a/gistfile1.txt",
};

export const DEFAULT_KNOWN_TOURNAMENTS = {
  INTERMEDIATE_TOURNAMENT_NOV_2024: INTERMEDIATE_TOURNAMENT_NOV_2024,
  BEGINNER_TOURNAMENT_JAN_2025: BEGINNER_TOURNAMENT_JAN_2025,
};
