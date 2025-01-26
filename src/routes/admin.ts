import { Router } from "jsr:@oak/oak/router";
import { Status } from "jsr:@oak/oak";
import type { RouterContext } from "jsr:@oak/oak/router";
import { makeRenderer } from "../util/renderer.ts";

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
adminRouter.get("/", (ctx: RouterContext<string>) => {
  return (makeRenderer("./admin/index.eta", {
    title: "Admin Dashboard",
  }))(ctx);
});
