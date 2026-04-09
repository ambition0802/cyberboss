const {
  loadPersistedContextTokens,
  savePersistedContextTokens,
} = require("./context-token-store");
const {
  loadSyncBuffer,
  saveSyncBuffer,
} = require("./sync-buffer-store");
const { SessionStore } = require("../../runtime/codex/session-store");
const { SystemMessageQueueStore } = require("../../../core/system-message-queue-store");
const { TimelineScreenshotQueueStore } = require("../../../core/timeline-screenshot-queue-store");
const { ReminderQueueStore } = require("./reminder-queue-store");
const { normalizeAccountId } = require("./account-store");

function migrateWeixinAccountState(config, { fromAccountIds = [], toAccountId = "" } = {}) {
  const normalizedToAccountId = normalizeAccountId(toAccountId);
  const normalizedFromAccountIds = Array.from(new Set(
    (Array.isArray(fromAccountIds) ? fromAccountIds : [])
      .map((accountId) => normalizeAccountId(accountId))
      .filter((accountId) => accountId && accountId !== normalizedToAccountId)
  ));
  if (!normalizedToAccountId || !normalizedFromAccountIds.length) {
    return createEmptyResult();
  }

  const result = createEmptyResult();
  const mergedContextTokens = { ...loadPersistedContextTokens(config, normalizedToAccountId) };
  let mergedContextTokenCount = 0;
  let syncBufferMigrated = false;
  let targetSyncBuffer = loadSyncBuffer(config, normalizedToAccountId);

  const sessionStore = new SessionStore({ filePath: config.sessionsFile });
  const systemMessageQueue = new SystemMessageQueueStore({ filePath: config.systemMessageQueueFile });
  const timelineScreenshotQueue = new TimelineScreenshotQueueStore({ filePath: config.timelineScreenshotQueueFile });
  const reminderQueue = new ReminderQueueStore({ filePath: config.reminderQueueFile });

  for (const fromAccountId of normalizedFromAccountIds) {
    result.migratedAccountIds.push(fromAccountId);
    const staleContextTokens = loadPersistedContextTokens(config, fromAccountId);
    for (const [userId, contextToken] of Object.entries(staleContextTokens)) {
      if (!mergedContextTokens[userId]) {
        mergedContextTokens[userId] = contextToken;
        mergedContextTokenCount += 1;
      }
    }

    if (!targetSyncBuffer) {
      const staleSyncBuffer = loadSyncBuffer(config, fromAccountId);
      if (staleSyncBuffer) {
        targetSyncBuffer = staleSyncBuffer;
        syncBufferMigrated = true;
      }
    }

    result.sessionBindings += sessionStore.migrateAccountId(fromAccountId, normalizedToAccountId);
    result.systemMessages += systemMessageQueue.migrateAccountId(fromAccountId, normalizedToAccountId);
    result.timelineScreenshotJobs += timelineScreenshotQueue.migrateAccountId(fromAccountId, normalizedToAccountId);
    result.reminders += reminderQueue.migrateAccountId(fromAccountId, normalizedToAccountId);
  }

  if (mergedContextTokenCount > 0) {
    savePersistedContextTokens(config, normalizedToAccountId, mergedContextTokens);
    result.contextTokens = mergedContextTokenCount;
  }

  if (syncBufferMigrated) {
    saveSyncBuffer(config, normalizedToAccountId, targetSyncBuffer);
    result.syncBuffer = 1;
  }

  return result;
}

function createEmptyResult() {
  return {
    migratedAccountIds: [],
    sessionBindings: 0,
    systemMessages: 0,
    timelineScreenshotJobs: 0,
    reminders: 0,
    contextTokens: 0,
    syncBuffer: 0,
  };
}

module.exports = {
  migrateWeixinAccountState,
};
