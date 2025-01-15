import { Router } from "jsr:@oak/oak/router";
import type { RouterContext } from "jsr:@oak/oak/router";
import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
import { analyzeTournamentProgress } from "https://raw.githubusercontent.com/devp/project-tak-tourney-adhoc/refs/heads/main/src/tournament-analyzer.ts";

export const router = new Router();

const eta = new Eta({ views: "./templates" });

function makeRenderer(templateName: string, templateOptions = {}) {
  return (ctx: RouterContext<string>) => {
    ctx.response.body = eta.render(templateName, templateOptions);
  };
}

router.get("/", makeRenderer("./simple", { name: "devp" }));

router.get("/tournament", (ctx: RouterContext<string>) => {
  const status = analyzeTournamentProgress({
    tournamentInfo: {
      players: [],
      dateRange: {
        start: new Date(),
        end: new Date(),
      },
    },
    games: [],
  });
  console.log(status);
  return (makeRenderer("./tournament", {
    status,
  }))(ctx);
});
