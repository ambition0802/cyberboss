const { spawn } = require("child_process");
const {
  listenUrl,
  ensureSharedAppServer,
  resolveBoundThread,
} = require("./shared-common");

async function main() {
  const workspaceRoot = process.env.CYBERBOSS_WORKSPACE_ROOT || process.cwd();
  await ensureSharedAppServer();
  const { threadId, workspaceRoot: resolvedWorkspaceRoot } = resolveBoundThread(workspaceRoot);
  const child = spawn(process.env.CYBERBOSS_CODEX_COMMAND || "codex", [
    "resume",
    threadId,
    "--remote",
    listenUrl,
    "-C",
    resolvedWorkspaceRoot,
    ...process.argv.slice(2),
  ], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
