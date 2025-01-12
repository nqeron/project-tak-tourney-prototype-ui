import { Router } from "jsr:@oak/oak/router";
import type {  RouterContext } from "jsr:@oak/oak/router";
import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";

export const router = new Router();

const eta = new Eta({ views: "./templates" });

router.get("/", (ctx: RouterContext<string>) => {
  ctx.response.body = eta.render("./simple", { name: "devp" });
});
