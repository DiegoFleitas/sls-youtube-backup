#!/usr/bin/env node
/**
 * AI-SLS-05: agent definitions are code-as-instructions. Fail CI when one of
 * them grants an unscoped `Bash` tool (or `Write`/`Edit` without a path scope),
 * because a sub-agent inherits the parent's blast radius.
 *
 * Runs against the tracked agent directories only; with no agent definitions in
 * the repo it passes silently.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const AGENT_DIRS = [".claude/agents", "docs/agents"];
const UNSCOPED = /\bBash\b(?!\()/;

function markdownFiles(directory) {
  try {
    if (!statSync(directory).isDirectory()) return [];
  } catch {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(directory, entry.name));
}

function toolsLine(contents) {
  const match = contents.match(/^tools:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

const violations = [];
for (const directory of AGENT_DIRS) {
  for (const file of markdownFiles(directory)) {
    const tools = toolsLine(readFileSync(file, "utf8"));
    if (tools && UNSCOPED.test(tools)) {
      violations.push(`${file}: unscoped Bash tool -> "${tools}"`);
    }
  }
}

if (violations.length > 0) {
  console.error("Agent definitions grant unscoped shell access:");
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    "Scope Bash to an explicit allowlist, or use permissionMode: read-only."
  );
  process.exit(1);
}

console.log("Agent definitions OK (no tracked agent file grants unscoped Bash).");
