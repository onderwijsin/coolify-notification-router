/**
 * Slack Notification Router
 *
 * A Cloudflare Worker that listens for messages in a source Slack channel
 * and forwards them to other channels based on keyword rules.
 *
 * Rules are defined in CONFIG below and target channel IDs are read from env vars.
 */

import CONFIG from "./config.js";
import { extractText, shouldProcessEvent, forwardMessage } from "./utils.js";


export default {
  async fetch(request, env, _ctx) {
    try {
      if (request.method !== "POST") {
        return new Response("Only POST allowed", { status: 405 });
      }

      // 🔒 Verify Slack request authenticity
      const verified = await verifySlackRequest(request, env.SLACK_SIGNING_SECRET);
      if (!verified) {
        return new Response("Unauthorized", { status: 403 });
      }

      const body = await request.json();
      console.log("Incoming body:", JSON.stringify(body));

      // Slack URL verification (challenge during setup)
      if (body.type === "url_verification") {
        return new Response(body.challenge, {
          headers: { "Content-Type": "text/plain" },
        });
      }

      if (body.type === "event_callback") {
        const event = body.event;
        console.log("Processing event:", JSON.stringify(event));

        // Only handle messages from the configured source channel
        if (!shouldProcessEvent(event, env.SOURCE_CHANNEL_ID)) {
          console.log(
            `Ignored event. channel=${event.channel}, expected=${env.SOURCE_CHANNEL_ID}, type=${event.type}`
          );
          return new Response("Ignored", { status: 200 });
        }

        // Optional: filter by specific bot
        if (env.ALLOWED_BOT_ID && event.bot_id !== env.ALLOWED_BOT_ID) {
          console.log(`Ignored by bot filter. bot_id=${event.bot_id}`);
          return new Response("Ignored", { status: 200 });
        }

        const text = extractText(event);
        let targetChannel = null;

        // Match against rules
        for (const rule of CONFIG) {
          if (rule.keyword.test(text)) {
            targetChannel = env[rule.targetChannelEnv];
            console.log(
              `Matched rule ${rule.keyword}, forwarding to ${rule.targetChannelEnv} → ${targetChannel}`
            );
            break;
          }
        }

        if (!targetChannel) {
          console.log("No matching rule found, ignoring");
          return new Response("Ignored", { status: 200 });
        }

        await forwardMessage(event, targetChannel, env);
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("Worker Error:", err);
      return new Response("Internal Error", { status: 500 });
    }
  },
};
