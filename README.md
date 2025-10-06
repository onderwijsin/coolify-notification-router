# Slack Notification Router

A **Cloudflare Worker** that listens for messages in one Slack channel and automatically forwards them to other channels based on configurable keyword rules.

Originally built for routing deployment/status notifications from Coolify, but works with *any* Slack integration or channel workflow.

---

## ✨ Features

* Config-driven routing rules using **regular expressions**.
* Preserves Slack formatting, attachments, and blocks.
* Verifies every request from Slack using its **Signing Secret**.
* Automatically retries Slack API calls on transient errors (with exponential backoff).
* Optional: filter so only messages from a specific bot are forwarded.
* Lightweight, serverless, and runs on Cloudflare’s free tier.

---

## 🔒 Request Verification (Security)

All incoming requests from Slack are **authenticated** using [Slack’s signing secret verification](https://docs.slack.dev/authentication/verifying-requests-from-slack/).

Before any event is processed, the Worker:
1. Extracts `x-slack-signature` and `x-slack-request-timestamp` headers.
2. Reconstructs the request signature using your `SLACK_SIGNING_SECRET`.
3. Rejects requests older than 5 minutes or with invalid signatures (`403`).

This ensures that **only legitimate Slack events** are ever processed.

---

## 🔧 Configuration

### Environment Variables

Set these in your Cloudflare Worker dashboard (**Settings → Variables**) or in `wrangler.toml`:

| Variable                | Description                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| `SLACK_BOT_TOKEN`       | Slack Bot User OAuth Token (`xoxb-...`)                                        |
| `SLACK_SIGNING_SECRET`  | Signing Secret used to verify requests from Slack                              |
| `SOURCE_CHANNEL_ID`     | Channel ID of the source channel (where messages are received, e.g., #coolify) |
| `ALLOWED_BOT_ID`        | (Optional) Slack bot ID to filter on (e.g., only forward Coolify’s messages)   |

### Target Channels

Target channels are also set via environment variables.
You can define as many as you need — **names like `DEPLOYMENTS_CHANNEL_ID` and `STATUS_CHANNEL_ID` are only examples**.

In the Worker code, each rule points to an env var:

```js
const CONFIG = [
  { keyword: /\bdeploy\w*\b/i, targetChannelEnv: "DEPLOYMENTS_CHANNEL_ID" },
  { keyword: /error/i,         targetChannelEnv: "ERRORS_CHANNEL_ID" },
  { keyword: /.*/,             targetChannelEnv: "DEFAULT_CHANNEL_ID" }, // fallback
];
````

Each `targetChannelEnv` must exist as an environment variable containing the Slack channel ID of the target channel.
👉 You can rename/add/remove these rules as needed.

---

### Finding Slack Channel IDs

Right-click a Slack channel → *Copy link* → ID is the last part of the URL (e.g., `C01QR2K4PVN2`)

### 🔍 Finding Your Bot ID

To get your bot’s ID, use your **Bot User OAuth Token** (`xoxb-...`):

```bash
curl -s -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer xoxb-your-bot-token"
```

The response includes `"bot_id": "BXXXXXXXXXX"`.
Use that value for `ALLOWED_BOT_ID` (optional).

You can also use Slack’s [API Tester](https://api.slack.com/methods/auth.test/test).

---

## 🚀 Setup Guide

### 1. Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps).
2. Create a new app (from scratch).
3. Enable **Event Subscriptions**:

   * Request URL → your Worker URL (e.g., `https://slack-notification-router.YOURDOMAIN.workers.dev/`)
   * Subscribe to `message.channels`
4. Add OAuth scopes:

   * `channels:history` (read messages)
   * `chat:write` (post messages)
   * `channels:read` (check bot’s channel membership)
5. Install the app into your workspace.
6. Copy the **Bot User OAuth Token** (`xoxb-...`) into `SLACK_BOT_TOKEN`.
7. Copy the **Signing Secret** from your app’s *Basic Information → App Credentials* page into `SLACK_SIGNING_SECRET`.
8. Invite the bot into all relevant channels:

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
* Whether the signature verification passed
* Which config rule matched
* Slack API response (`ok: true` or error messages)

Common issues:

* `not_in_channel` → Invite the bot into the target channel.
* `missing_scope` → Add missing Slack OAuth scopes and reinstall the app.
* `Unauthorized` → Check that `SLACK_SIGNING_SECRET` matches the one in your Slack app.

---

## 🧩 Implementation Notes

* The Worker uses the **Web Crypto API** (`crypto.subtle`) for HMAC signing.
* A `timingSafeEqual` helper prevents signature timing leaks.
* Retries up to `MAX_RETRIES = 3` on Slack API 429 or 5xx errors.
* Only processes events from `SOURCE_CHANNEL_ID`; everything else is ignored.

If you’re running locally or self-hosting, ensure the **crypto flag** is enabled so HMAC operations work correctly.

---

## 📝 Example Workflow

Config (`config.js`):

```js
export default [
  { keyword: /\bdeploy\w*\b/i, targetChannelEnv: "DEPLOYMENTS_CHANNEL_ID" },
  { keyword: /error/i,         targetChannelEnv: "ERRORS_CHANNEL_ID" },
  { keyword: /.*/,             targetChannelEnv: "DEFAULT_CHANNEL_ID" },
];
```

**Message in `#coolify`:**

```
New version successfully deployed 🚀
```

→ forwarded to the channel in `DEPLOYMENTS_CHANNEL_ID`.

**Message in `#coolify`:**

```
Server returned error 500
```

→ forwarded to the channel in `ERRORS_CHANNEL_ID`.

Any other message → goes to `DEFAULT_CHANNEL_ID`.

---

## 📜 License

MIT — free to use, modify, and share.