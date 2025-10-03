/**
 * Slack Notification Router
 *
 * A Cloudflare Worker that listens for messages in a source Slack channel
 * and forwards them to other channels based on keyword rules.
 *
 * Rules are defined in CONFIG below and target channel IDs are read from env vars.
 */

import CONFIG from "./config.js";

/**
 * Extract text from Slack event including Block Kit content
 * @param {Object} event - Slack event object
 * @returns {string} Combined text from event.text and event.blocks
 */
function extractText(event) {
  let text = event.text || "";
  
  // Extract text from Block Kit blocks
  if (event.blocks && Array.isArray(event.blocks)) {
    for (const block of event.blocks) {
      if (block.type === "header" && block.text?.text) {
        text += "\n" + block.text.text;
      }
      if (block.type === "section" && block.text?.text) {
        text += "\n" + block.text.text;
      }
    }
  }
  
  return text;
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method !== "POST") {
        return new Response("Only POST allowed", { status: 405 });
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
        if (event.channel !== env.SOURCE_CHANNEL_ID || event.type !== "message") {
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

async function forwardMessage(event, targetChannel, env) {
  const slackToken = env.SLACK_BOT_TOKEN;

  const payload = {
    channel: targetChannel,
    text: event.text || "[no text]",
  };

  if (event.attachments) {
    payload.attachments = event.attachments;
  }
  if (event.blocks) {
    payload.blocks = event.blocks;
  }

  console.log("➡️ Forwarding payload:", JSON.stringify(payload));

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${slackToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json();
  if (!result.ok) {
    console.error(`❌ Slack API error: ${result.error}`, JSON.stringify(result));
  } else {
    console.log(`✅ Message posted to ${targetChannel}, ts=${result.ts}`);
  }
}