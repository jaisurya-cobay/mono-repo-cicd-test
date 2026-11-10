import http from "node:http";
import { API_VERSION, SHIPMENT_STATUSES } from "@lab/shared-contracts";

export function health() {
  return { ok: true, api: API_VERSION, sha: process.env.GIT_SHA ?? "dev", uptime: Math.round(process.uptime()) };
}

export function createServer() {
  return http.createServer((req, res) => {
    const body = req.url === "/health" ? health() : req.url === `/${API_VERSION}/statuses` ? SHIPMENT_STATUSES : null;
    res.writeHead(body ? 200 : 404, { "content-type": "application/json" });
    res.end(JSON.stringify(body ?? { error: "not found" }));
  });
}
