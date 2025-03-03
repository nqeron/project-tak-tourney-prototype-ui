import { Router } from "jsr:@oak/oak/router";
import { Status } from "jsr:@oak/oak";
import type { RouterContext } from "jsr:@oak/oak/router";
import { makeRenderer } from "../util/renderer.ts";
import { Tournament } from "../models/tournament.ts";
import { GeneratedTournamentStatusCache } from "../cache.ts";

const ADMIN_USERNAME = "admin";
// Load this variable from local env for local development.
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? null;

export const adminRouter = new Router();

// Basic auth middleware
async function basicAuthMiddleware(
  ctx: RouterContext<string>,
  next: () => Promise<unknown>,
) {
  if (!ADMIN_PASSWORD) {
    console.error("ADMIN_PASSWORD is not set");
    ctx.response.status = Status.NotImplemented;
    return;
  }

  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader) {
    ctx.response.status = Status.Unauthorized;
    ctx.response.headers.set("WWW-Authenticate", 'Basic realm="Admin Area"');
    return;
  }

  const match = authHeader.match(/^Basic\s+(.*)$/);
  if (!match) {
    ctx.response.status = Status.Unauthorized;
    return;
  }

  const [username, password] = atob(match[1]).split(":");

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    await next();
  } else {
    ctx.response.status = Status.Unauthorized;
    ctx.response.headers.set("WWW-Authenticate", 'Basic realm="Admin Area"');
  }
}

// Apply auth middleware to all admin routes
adminRouter.use(basicAuthMiddleware);

// Example admin route
adminRouter.get("/", async (ctx: RouterContext<string>) => {
  const kv = await Deno.openKv();
  const tournamentIds = await Tournament.listAllIds(kv);
  const tournaments = tournamentIds.map((id) => ({ id }));
  return (makeRenderer("./admin/index.eta", {
    title: "Admin Dashboard",
    tournaments,
  }))(ctx);
});

adminRouter.get("/tournament/:id", async (ctx: RouterContext<string>) => {
  const kv = await Deno.openKv();
  const id = ctx.params.id;
  const tournament = await Tournament.load(id, kv);
  return (makeRenderer("./admin/tournament.eta", {
    title: "Admin Dashboard",
    tournament,
  }))(ctx);
});

adminRouter.post("/tournament/:id", async (ctx: RouterContext<string>) => {
  const kv = await Deno.openKv();
  const id = ctx.params.id;
  const info = (await ctx.request.body.formData()).get("info");
  if (!info) {
    console.error("No data provided");
    ctx.response.status = Status.BadRequest;
    return;
  }
  let tournamentInfo: unknown;
  try {
    tournamentInfo = JSON.parse(info as string);
  } catch (e) {
    console.error("Invalid JSON", e);
    ctx.response.status = Status.BadRequest;
    ctx.response.body = "Invalid JSON";
    return;
  }
  // Validation happens on save.
  if (!(await Tournament.save(id, tournamentInfo, kv))) {
    console.error("Failed to save tournament info");
    ctx.response.status = Status.InternalServerError;
    return;
  }
  GeneratedTournamentStatusCache.clear();
  ctx.response.redirect("/admin");
});

// Add new endpoint to copy tournament
adminRouter.post("/tournament/:id/copy", async (ctx: RouterContext<string>) => {
  const kv = await Deno.openKv();
  const sourceId = ctx.params.id;
  const formData = await ctx.request.body.formData();
  const newId = formData.get("newId");

  if (!newId || typeof newId !== "string") {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = "New tournament ID is required";
    return;
  }

  // Load source tournament
  const sourceTournament = await Tournament.load(sourceId, kv);
  if (!sourceTournament) {
    ctx.response.status = Status.NotFound;
    ctx.response.body = "Source tournament not found";
    return;
  }

  // Save as new tournament
  if (!(await Tournament.save(newId, sourceTournament.info, kv))) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = "Failed to save new tournament";
    return;
  }

  GeneratedTournamentStatusCache.clear();
  ctx.response.redirect(`/admin/tournament/${newId}`);
});
