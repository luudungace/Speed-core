import { BacklinkOpportunityRepository } from "../lib/repositories/backlink-opportunity-repository";
import { runBacklinkOpportunityJob } from "../lib/services/backlink-opportunity-runner";
import * as fs from "fs";
import * as path from "path";

// Load env variables manually from .env file
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach(line => {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.substring(0, idx).trim();
        const val = line.substring(idx + 1).trim();
        process.env[key] = val;
      }
    }
  });
}

async function main() {
  const repo = new BacklinkOpportunityRepository();
  
  // 1. Create project
  console.log("Creating test project...");
  const project = await repo.createProject({
    name: "Dự án Test CoinMinutes 2",
    myDomain: "coinminutes.com",
    competitors: ["coinmarketcap.com"]
  });
  console.log("Created project ID:", project.id);

  // 2. Create job with 100 limit to verify the date fix
  console.log("Creating analysis job...");
  const job = await repo.createJob(project.id, {
    source_limit: 100,
    exclude_domains: []
  });
  console.log("Created job ID:", job.id);

  // 3. Run job
  console.log("Running job runner...");
  await runBacklinkOpportunityJob(job.id);
  console.log("Job runner finished successfully!");
}

main().catch(console.error);
