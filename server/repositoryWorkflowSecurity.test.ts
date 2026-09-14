import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");
const workflowExtensions = new Set([".yml", ".yaml"]);
const bareHttpIp = /http:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/|\b)/i;
const outboundCommandWithSecret = /(?:curl|wget)[^\n]*(?:\$\{\{\s*secrets\.|\$[A-Z][A-Z0-9_]*)/i;

function workflowFiles(): string[] {
  if (!fs.existsSync(workflowsDirectory)) return [];
  return fs
    .readdirSync(workflowsDirectory)
    .filter((name) => workflowExtensions.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(workflowsDirectory, name));
}

describe("repository workflow security invariants", () => {
  it("does not ship the known credential-exfiltration workflow", () => {
    expect(fs.existsSync(path.join(workflowsDirectory, "github_actions_security.yml"))).toBe(false);
  });

  it("does not send workflow data to bare HTTP IP endpoints", () => {
    const matches = workflowFiles().flatMap((file) => {
      const content = fs.readFileSync(file, "utf8");
      return bareHttpIp.test(content) ? [path.basename(file)] : [];
    });
    expect(matches).toEqual([]);
  });

  it("does not interpolate secrets or secret-like environment variables into curl or wget commands", () => {
    const matches = workflowFiles().flatMap((file) => {
      const content = fs.readFileSync(file, "utf8");
      return outboundCommandWithSecret.test(content) ? [path.basename(file)] : [];
    });
    expect(matches).toEqual([]);
  });
});
