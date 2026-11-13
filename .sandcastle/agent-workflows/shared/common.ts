import * as fs from "node:fs";
import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";

export const outputDir = (): string => process.env.OUTPUT_DIR ?? "/tmp";

export const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
};

export const writeJson = (filename: string, value: unknown): void => {
  fs.mkdirSync(outputDir(), { recursive: true });
  fs.writeFileSync(
    path.join(outputDir(), filename),
    JSON.stringify(value, null, 2)
  );
};

// Codex reads the ChatGPT login cache restored by Actions into CODEX_HOME.
// CODEX_MODEL is a repository variable; credentials never belong in this file.
export const codexAgent = () =>
  sandcastle.codex(required("CODEX_MODEL"), {
    env: {
      CODEX_HOME: required("CODEX_HOME"),
    },
  });
