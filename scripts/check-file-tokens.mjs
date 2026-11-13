import { execFileSync } from "node:child_process";

// Deliberately approximate: four bytes per token, with no tokenizer dependency.
const bytesPerToken = 4;
const maxTokens = 5_000;
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

try {
  const files = git(
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMRT",
    "-z"
  )
    .split("\0")
    .filter(Boolean);
  let failed = false;

  for (const file of files) {
    // Gitlinks (submodules) refer to commits, not file contents.
    if (git("cat-file", "-t", `:${file}`).trim() !== "blob") continue;
    const bytes = Number(git("cat-file", "-s", `:${file}`).trim());
    const tokens = Math.ceil(bytes / bytesPerToken);
    if (tokens <= maxTokens) continue;
    console.error(
      `${JSON.stringify(file)}: approximately ${tokens.toLocaleString("en-US")} tokens (${bytes} bytes); maximum is ${maxTokens} tokens / ${maxTokens * bytesPerToken} bytes. Split the file before committing.`
    );
    failed = true;
  }

  if (failed) process.exitCode = 1;
} catch (error) {
  console.error("Unable to check staged file sizes:", error.message);
  process.exitCode = 1;
}
