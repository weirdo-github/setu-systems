import express from "express";
import next from "next";
import { getFinanceApiApp, prepareFinanceApi } from "./index.js";

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const dev = process.env.NODE_ENV !== "production";

const nextApp = next({ dev, hostname: host, port });
const handle = nextApp.getRequestHandler();

function setProductionHeaders(_request, response, nextMiddleware) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  nextMiddleware();
}

async function startSetuSystemsServer() {
  await nextApp.prepare();
  await prepareFinanceApi();

  const app = express();
  app.disable("x-powered-by");
  app.use(setProductionHeaders);

  app.use((request, response, nextMiddleware) => {
    if (!request.url.startsWith("/api/discover")) {
      nextMiddleware();
      return;
    }

    request.url = request.url.replace(/^\/api\/discover(?=\/|$)/, "/api") || "/api";
    return handle(request, response);
  });

  app.use((request, response, nextMiddleware) => {
    if (!request.url.startsWith("/api/media")) {
      nextMiddleware();
      return;
    }

    return handle(request, response);
  });

  app.use(getFinanceApiApp());
  app.use((request, response) => handle(request, response));

  app.listen(port, host, () => {
    console.log(`Setu Systems listening on http://${host}:${port}`);
  });
}

startSetuSystemsServer().catch((error) => {
  console.error("Failed to start Setu Systems", error);
  process.exit(1);
});
