const { CodexRpcClient } = require("./rpc-client");
const { SessionStore } = require("./session-store");

function createCodexRuntimeAdapter(config) {
  const sessionStore = new SessionStore({ filePath: config.sessionsFile });

  return {
    describe() {
      return {
        id: "codex",
        kind: "runtime",
        endpoint: config.codexEndpoint || "(spawn)",
        sessionsFile: config.sessionsFile,
      };
    },
    createClient() {
      return new CodexRpcClient({
        endpoint: config.codexEndpoint,
        codexCommand: config.codexCommand,
        env: process.env,
      });
    },
    getSessionStore() {
      return sessionStore;
    },
  };
}

module.exports = { createCodexRuntimeAdapter };
