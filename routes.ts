import { Router } from "jsr:@oak/oak/router";
import type {  RouterContext } from "jsr:@oak/oak/router";

export const router = new Router();

router.get("/", (ctx: RouterContext) => {
  ctx.response.body = `<!DOCTYPE html>
    <html>
      <head><title>Hello oak!</title><head>
      <body>
        <h1>Hello oak!</h1>
      </body>
    </html>
  `;
});
