const { RegistrationRepository } = require("../lib/repositories/registration-repository");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.startsWith("#")) continue;
      const firstEqual = cleanLine.indexOf("=");
      if (firstEqual > 0) {
        const key = cleanLine.substring(0, firstEqual).trim();
        let value = cleanLine.substring(firstEqual + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    }
  }
}
loadEnv();

async function run() {
  console.log("Initializing repository...");
  const repo = new RegistrationRepository();
  try {
    console.log("Calling pullNextJobForWorker(false)...");
    const result = await repo.pullNextJobForWorker(false);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Caught error:", error);
  }
}

run();
