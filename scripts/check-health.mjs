import { probe } from "./probe.mjs";
try { console.log(JSON.stringify(await probe(process.argv[2] || "http://localhost:5173"))); }
catch { console.error("Health/page probe failed; investigate service availability and configuration. No response bodies or credentials logged."); process.exitCode = 1; }
