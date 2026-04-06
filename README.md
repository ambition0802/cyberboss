# Cyberboss

`Cyberboss` 是一个面向个人生活流的 agent bridge。

它的目标不是绑定某一个聊天渠道或某一个模型运行时，而是把这些边界拆开：

- channel adapter
  - 微信、Telegram、WhatsApp 等消息入口
- runtime adapter
  - Codex、Claude Code、Cursor、OpenClaw 等 agent 运行时
- capability integrations
  - timeline、reminder、diary、check-in
- core orchestrator
  - 统一管理会话、任务、状态和能力编排

## 当前阶段

这个仓库现在只包含第一版骨架：

- 一个最小 CLI：`cyberboss`
- 基础配置加载
- channel/runtime/timeline 的适配边界
- 架构文档

后续会逐步把现有项目里的实现迁进来。

## 命令

```bash
npm install
npm run check
node ./bin/cyberboss.js login
node ./bin/cyberboss.js accounts
node ./bin/cyberboss.js help
node ./bin/cyberboss.js start
node ./bin/cyberboss.js doctor
```

## 默认约定

- `CYBERBOSS_STATE_DIR`
  - 默认：`${HOME}/.cyberboss`
- `CYBERBOSS_CHANNEL`
  - 默认：`weixin`
- `CYBERBOSS_RUNTIME`
  - 默认：`codex`
- `CYBERBOSS_TIMELINE_COMMAND`
  - 默认：`timeline-for-agent`
- `CYBERBOSS_WEIXIN_BASE_URL`
  - 默认：`https://ilinkai.weixin.qq.com`
- `CYBERBOSS_ACCOUNT_ID`
  - 多账号时指定当前使用的微信 bot 账号

## 结构

```text
src/
  adapters/
    channel/
    runtime/
  core/
  integrations/
docs/
```

详细拆分计划见：

- [docs/architecture.md](./docs/architecture.md)

## 当前已接入的微信底层能力

- 微信扫码登录
- bot token 本地持久化
- 已保存账号列表
- context token 本地持久化
- 微信 HTTP API 基础访问封装

## 当前已接入的 Codex runtime 底层能力

- Codex app-server / websocket RPC client
- session store
- model catalog 规范化
- runtime adapter 骨架
