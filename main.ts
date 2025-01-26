import { Application } from "jsr:@oak/oak/application";

import { router } from "./src/routes.ts";

function main() {
  const app = new Application();
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.listen({ port: 3000 });
}

if (import.meta.main) {
  main();
}
