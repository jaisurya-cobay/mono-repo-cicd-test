// Images currently live per environment (last successful deploy of each server app), for the nightly
// re-scan: new CVEs are found in what actually runs, without rebuilding anything.
// Env: LIVE_DEPLOYS, GITHUB_REPOSITORY. Output: images (JSON list of {app, stage, image}).
import { deployables, lastSuccess, recordEnv, output, summary } from "./lib.mjs";

const images = [];
for (const app of deployables().filter((a) => a.kind === "server")) {
  for (const stage of ["qa", "staging", "production"]) {
    const last = lastSuccess(recordEnv(app.slug, stage), app.slug);
    const hash = last?.payload?.hash;
    if (hash) images.push({ app: app.slug, stage, image: `ghcr.io/${process.env.GITHUB_REPOSITORY}/${app.slug}:${hash}` });
  }
}
output("images", JSON.stringify(images));
summary(`### Live images: ${images.length}\n${images.map((i) => `- ${i.stage}: \`${i.image}\``).join("\n")}`);
