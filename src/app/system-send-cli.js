const crypto = require("crypto");
const fs = require("fs");

const { resolveSelectedAccount } = require("../adapters/channel/weixin/account-store");
const { loadPersistedContextTokens } = require("../adapters/channel/weixin/context-token-store");
const { SystemMessageQueueStore } = require("../core/system-message-queue-store");

async function runSystemSendCommand(config) {
  const options = parseSystemSendArgs(process.argv.slice(4));
  if (options.help) {
    printSystemSendHelp();
    return;
  }

  const senderId = options.user || resolveDefaultUser(config);
  const text = options.text;
  const workspaceRoot = normalizeWorkspacePath(options.workspace || config.workspaceRoot || "");
  if (!senderId || !text || !workspaceRoot) {
    printSystemSendHelp();
    throw new Error("system send 缺少必要参数");
  }

  let workspaceStats = null;
  try {
    workspaceStats = fs.statSync(workspaceRoot);
  } catch {
    throw new Error(`workspace 不存在: ${workspaceRoot}`);
  }
  if (!workspaceStats.isDirectory()) {
    throw new Error(`workspace 不是目录: ${workspaceRoot}`);
  }

  const account = resolveSelectedAccount(config);
  const contextTokens = loadPersistedContextTokens(config, account.accountId);
  if (!contextTokens[senderId]) {
    throw new Error(`找不到用户 ${senderId} 的 context token，先让这个用户和 bot 聊过一次`);
  }
  const queue = new SystemMessageQueueStore({ filePath: config.systemMessageQueueFile });
  const queued = queue.enqueue({
    id: crypto.randomUUID(),
    accountId: account.accountId,
    senderId,
    workspaceRoot,
    text,
    createdAt: new Date().toISOString(),
  });

  console.log(`system message queued: ${queued.id}`);
  console.log(`user: ${queued.senderId}`);
  console.log(`workspace: ${queued.workspaceRoot}`);
}

function parseSystemSendArgs(args) {
  const options = {
    help: false,
    user: "",
    text: "",
    workspace: "",
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = String(args[index] || "").trim();
    if (!token) {
      continue;
    }

    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }

    if (!token.startsWith("--")) {
      throw new Error(`未知参数: ${token}`);
    }

    const key = token.slice(2);
    const value = String(args[index + 1] || "");
    if (!value || value.startsWith("--")) {
      throw new Error(`参数缺少值: ${token}`);
    }

    if (key === "user") {
      options.user = value.trim();
    } else if (key === "text") {
      options.text = value.trim();
    } else if (key === "workspace") {
      options.workspace = value.trim();
    } else {
      throw new Error(`未知参数: ${token}`);
    }

    index += 1;
  }

  return options;
}

function printSystemSendHelp() {
  console.log(`
用法: npm run system:send -- --text "<message>" [--user <wechat_user_id>] [--workspace /绝对路径]

示例:
  npm run system:send -- --text "提醒她今天早点睡" --workspace "$(pwd)"
`);
}

function normalizeWorkspacePath(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveDefaultUser(config) {
  if (Array.isArray(config.allowedUserIds) && config.allowedUserIds.length) {
    return String(config.allowedUserIds[0] || "").trim();
  }
  return "";
}

module.exports = { runSystemSendCommand };
