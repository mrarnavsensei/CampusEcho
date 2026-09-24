import { writeFileSync } from "node:fs";
import { readDeployment, validateDeployment } from "./deployment-config.mjs";

try {
  const environment = process.argv[2];
  if (!["staging", "production"].includes(environment)) throw new Error("Usage: node scripts/create-deployment.mjs staging|production (see docs/LAUNCH-TOOLING.md for environment variables)");
  const config = readDeployment("deployment.example.jsonc");
  Object.assign(config, { name: process.env.DEPLOY_WORKER_NAME });
  Object.assign(config.vars, { APP_ENV: environment, APP_URL: process.env.DEPLOY_APP_URL, EMAIL_FROM: process.env.DEPLOY_EMAIL_FROM });
  for (const key of Object.keys(config.vars).filter(key => key.startsWith("POLICY_"))) {
    const supplied = process.env[`DEPLOY_${key}`];
    if (supplied !== undefined) config.vars[key] = supplied;
  }
  Object.assign(config.d1_databases[0], { database_name: process.env.DEPLOY_DB_NAME, database_id: process.env.DEPLOY_DB_ID });
  const file = `deployment.${environment}.local.jsonc`;
  validateDeployment(config, { file, artifacts: false });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`Created ${file}. No credentials stored and no infrastructure changed.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
