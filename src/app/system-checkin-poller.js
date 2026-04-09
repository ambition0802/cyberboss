const crypto = require("crypto");

const { resolveSelectedAccount } = require("../adapters/channel/weixin/account-store");
const { SessionStore } = require("../adapters/runtime/codex/session-store");
const { resolvePreferredSenderId, resolvePreferredWorkspaceRoot } = require("../core/default-targets");
const { SystemMessageQueueStore } = require("../core/system-message-queue-store");

const DEFAULT_MIN_INTERVAL_MS = 3 * 60_000;
const DEFAULT_MAX_INTERVAL_MS = 60 * 60_000;
const INTERNAL_CHECKIN_TRIGGER_TEMPLATE = "Decide whether to reach out to %USER% now. You may stay silent, send one short WeChat message, update diary/timeline, or take another useful action. If no user-visible message should be sent, output exactly SILENT. If you do send a message, output only the message text.";

async function runSystemCheckinPoller(config) {
  const account = resolveSelectedAccount(config);
  const queue = new SystemMessageQueueStore({ filePath: config.systemMessageQueueFile });
  const sessionStore = new SessionStore({ filePath: config.sessionsFile });
  const target = resolvePollerTarget({ config, account, sessionStore });
  const minIntervalMs = readIntervalMs(process.env.CYBERBOSS_CHECKIN_MIN_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS);
  const maxIntervalMs = Math.max(
    minIntervalMs,
    readIntervalMs(process.env.CYBERBOSS_CHECKIN_MAX_INTERVAL_MS, DEFAULT_MAX_INTERVAL_MS)
  );

  console.log(`[cyberboss] checkin poller ready user=${target.senderId} workspace=${target.workspaceRoot}`);
  console.log(`[cyberboss] checkin interval range ${Math.round(minIntervalMs / 60000)}m-${Math.round(maxIntervalMs / 60000)}m`);

  while (true) {
    const delayMs = pickRandomDelayMs(minIntervalMs, maxIntervalMs);
    const wakeAt = new Date(Date.now() + delayMs);
    console.log(`[cyberboss] next checkin in ${Math.round(delayMs / 60000)}m at ${formatLocalTime(wakeAt)}`);
    await sleep(delayMs);

    if (queue.hasPendingForAccount(account.accountId)) {
      console.log("[cyberboss] checkin skipped: pending system message still in queue");
      continue;
    }

    const queued = queue.enqueue({
      id: crypto.randomUUID(),
      accountId: account.accountId,
      senderId: target.senderId,
      workspaceRoot: target.workspaceRoot,
      text: buildCheckinTrigger(config),
      createdAt: new Date().toISOString(),
    });
    console.log(`[cyberboss] checkin queued id=${queued.id}`);
  }
}

function resolvePollerTarget({ config, account, sessionStore }) {
  const senderId = resolvePreferredSenderId({
    config,
    accountId: account.accountId,
    explicitUser: process.env.CYBERBOSS_CHECKIN_USER_ID || "",
    sessionStore,
  });
  const workspaceRoot = resolvePreferredWorkspaceRoot({
    config,
    accountId: account.accountId,
    senderId,
    explicitWorkspace: process.env.CYBERBOSS_CHECKIN_WORKSPACE || "",
    sessionStore,
  });

  if (!senderId) {
    throw new Error("无法确定 checkin poller 的微信用户，先配置 CYBERBOSS_CHECKIN_USER_ID 或让唯一活跃用户先和 bot 聊过一次");
  }
  if (!workspaceRoot) {
    throw new Error("无法确定 checkin poller 的 workspace，先设置 CYBERBOSS_WORKSPACE_ROOT");
  }

  return { senderId, workspaceRoot };
}

function readIntervalMs(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pickRandomDelayMs(minIntervalMs, maxIntervalMs) {
  if (maxIntervalMs <= minIntervalMs) {
    return minIntervalMs;
  }
  return minIntervalMs + Math.floor(Math.random() * (maxIntervalMs - minIntervalMs + 1));
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatLocalTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffsetMinutes / 60)).padStart(2, "0");
  const offsetRemainderMinutes = String(absoluteOffsetMinutes % 60).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} ${offsetSign}${offsetHours}:${offsetRemainderMinutes}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCheckinTrigger(config) {
  const userName = normalizeText(config?.userName) || "用户";
  return INTERNAL_CHECKIN_TRIGGER_TEMPLATE.replace("%USER%", userName);
}

module.exports = { runSystemCheckinPoller };
