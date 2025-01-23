import { Application } from "jsr:@oak/oak/application";
import { analyzeTournamentProgress } from "https://raw.githubusercontent.com/devp/project-tak-tourney-adhoc/refs/tags/v0.1.0/src/tournament-analyzer.ts";

import { router } from "./routes.ts";

function main() {
  const app = new Application();
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.listen({ port: 3000 });
}

if (import.meta.main) {
  console.log(
    "analyzeTournamentProgress defined:",
    !!analyzeTournamentProgress,
  );
  main();
}
