import { readDeployment, validateDeployment, assertSeparate } from "./deployment-config.mjs";
try {
  const [file, productionFile] = process.argv.slice(2);
  if (!file) throw new Error("Usage: node scripts/check-deployment.mjs deployment.staging.local.jsonc [deployment.production.local.jsonc]");
  const deployment = validateDeployment(readDeployment(file), { file });
  if (productionFile) assertSeparate(deployment, validateDeployment(readDeployment(productionFile), { file: productionFile }));
  const policy = deployment.pendingPolicy.length ? ` Provisional policy values still requiring operator input: ${deployment.pendingPolicy.join(", ")}.` : " Policy configuration has no unresolved placeholders.";
  console.log(`Configuration passed for ${deployment.config.name}; no deployment performed.${policy} DNS, secrets, delivery and staging acceptance still need verification.`);
} catch (error) { console.error(`Deployment not ready: ${error.message}`); process.exitCode = 1; }
