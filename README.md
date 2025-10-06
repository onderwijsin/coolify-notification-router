# Slack Notification Router

A **Cloudflare Worker** that listens for messages in one Slack channel and automatically forwards them to other channels based on configurable keyword rules.

Originally built for routing deployment/status notifications from Coolify, but works with *any* Slack integration or channel workflow.

---

## ✨ Features

* Config-driven routing rules using **regular expressions**.
* Preserves Slack formatting, attachments, and blocks.
* Optional: filter so only messages from a specific bot are forwarded.
* Lightweight, serverless, and runs on Cloudflare’s free tier.

---

## 🔧 Configuration

### Environment Variables

Set these in your Cloudflare Worker dashboard (**Settings → Variables**) or in `wrangler.toml`:

| Variable            | Description                                                                    |
| ------------------- | ------------------------------------------------------------------------------ |
| `SLACK_BOT_TOKEN`   | Slack Bot User OAuth Token (`xoxb-...`)                                        |
| `SOURCE_CHANNEL_ID` | Channel ID of the source channel (where messages are received, e.g., #coolify) |
| `ALLOWED_BOT_ID`    | (Optional) Slack bot ID to filter on (e.g., only forward Coolify’s messages)   |

### Target Channels

Target channels are also set via environment variables.
You can define as many as you need — **names like `DEPLOYMENTS_CHANNEL_ID` and `STATUS_CHANNEL_ID` are only examples**.

In the Worker code, each rule points to an env var:

```js
const CONFIG = [
  { keyword: /deployment/i, targetChannelEnv: "DEPLOYMENTS_CHANNEL_ID" },
  { keyword: /error/i,      targetChannelEnv: "ERRORS_CHANNEL_ID" },
  { keyword: /.*/,          targetChannelEnv: "DEFAULT_CHANNEL_ID" }, // fallback
];
```

Each `targetChannelEnv` must exist as an environment variable containing the Slack channel ID of the target channel.
👉 You can rename/add/remove these rules as needed.

---

### Finding Slack Channel IDs

Right-click a Slack channel → *Copy link* → ID is the last part of the URL (e.g., `D1QR2K4PVN2`)

### 🔍 Finding Your Bot ID

To get your bot’s ID, use your **Bot User OAuth Token** (`xoxb-...`).
Run this command in your terminal:

```bash
curl -s -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer xoxb-your-bot-token"
```

The response includes `"bot_id": "BXXXXXXXXXX"`.
That is the value you should set as `ALLOWED_BOT_ID` in your Cloudflare Worker environment.

You can also find this using Slack’s [API Tester](https://api.slack.com/methods/auth.test/test) by selecting your bot token and clicking **Test Method**.

---

## 🚀 Setup Guide

### 1. Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps).
2. Create a new app (from scratch).
3. Enable **Event Subscriptions**:

   * Request URL → your Worker URL (e.g., `https://slack-notification-router.YOURDOMAIN.workers.dev/`).
   * Subscribe to `message.channels`.
4. Add OAuth scopes:

   * `channels:history` (read messages)
   * `chat:write` (post messages)
   * `channels:read` (check bot’s channel membership)
5. Install the app into your workspace.
6. Copy the Bot User OAuth Token (`xoxb-...`) into `SLACK_BOT_TOKEN`.
7. Invite the bot into all relevant channels:

   ```
   /invite @YourBot
   ```

---

### 2. Deploy to Cloudflare

1. Clone this repo.
2. Install Wrangler:

   ```bash
   npm install -g wrangler
   ```

   Or with pnpm:

   ```bash
   pnpm add -D wrangler
   ```
3. Publish:

   ```bash
   wrangler publish
   ```

---

### 3. Debugging

Stream Worker logs:

```bash
wrangler tail
```

You’ll see:

* Incoming Slack events
* Which config rule matched
* Slack API response (`ok: true` or error messages)

Common issues:

* `not_in_channel` → Invite the bot into the target channel.
* `missing_scope` → Add missing Slack OAuth scopes and reinstall the app.

---

## 📝 Example Workflow

Config (`index.js`):

```js
const CONFIG = [
  { keyword: /deployment/i, targetChannelEnv: "DEPLOYMENTS_CHANNEL_ID" },
  { keyword: /error/i,      targetChannelEnv: "ERRORS_CHANNEL_ID" },
  { keyword: /.*/,          targetChannelEnv: "DEFAULT_CHANNEL_ID" },
];
```

* Message in `#coolify`:

  ```
  New deployment finished
  ```

  → forwarded to channel set in `DEPLOYMENTS_CHANNEL_ID`.

* Message in `#coolify`:

  ```
  Server returned error 500
  ```

  → forwarded to channel set in `ERRORS_CHANNEL_ID`.

* Any other message → forwarded to channel set in `DEFAULT_CHANNEL_ID`.

---

## 📜 License

MIT — free to use, modify, and share.

