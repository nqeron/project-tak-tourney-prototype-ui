import type { RouterContext } from "jsr:@oak/oak/router";
import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";

const eta = new Eta({ views: "./templates" });

export function makeRenderer(templateName: string, templateOptions = {}) {
  return (ctx: RouterContext<string>) => {
    ctx.response.type = "html";
    ctx.response.body = eta.render(templateName, templateOptions);
  };
}
