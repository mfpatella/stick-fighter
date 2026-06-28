import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "qa-output", "gameplay-build");
mkdirSync(outputDir, { recursive: true });

execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "typescript", "bin", "tsc"),
    "src/game/combatSimulation.ts",
    "src/game/fighterCatalog.ts",
    "--outDir",
    outputDir,
    "--target",
    "ES2022",
    "--module",
    "ES2022",
    "--moduleResolution",
    "Bundler",
    "--skipLibCheck",
    "--strict",
    "--noEmit",
    "false",
    "--allowImportingTsExtensions",
    "false",
    "--noUnusedLocals",
    "false",
    "--noUnusedParameters",
    "false"
  ],
  { cwd: root, stdio: "inherit" }
);

const compiledSimulationPath = path.join(outputDir, "combatSimulation.js");
writeFileSync(
  compiledSimulationPath,
  readFileSync(compiledSimulationPath, "utf8").replace('from "./fighterCatalog";', 'from "./fighterCatalog.js";')
);

const runnerPath = path.join(root, "scripts", "audit-gameplay-runner.mjs");
const result = spawnSync(process.execPath, [runnerPath], {
  cwd: root,
  stdio: "inherit"
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
