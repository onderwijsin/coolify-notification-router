
/**
 * Extract text from Slack event including Block Kit content
 * @param {Object} event - Slack event object
 * @returns {string} Combined text from event.text and event.blocks
 */
export function extractText(event) {
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

/**
 * Maximum number of retries for transient errors
 */
const MAX_RETRIES = 3;

/**
 * Sends a fetch request to Slack with retry logic and exponential backoff.
 * @param {Request} request - Prepared Slack API fetch request.
 * @param {number} [retries=MAX_RETRIES] - Number of retry attempts.
 * @returns {Promise<Response>} The final fetch response if successful.
 */
export async function sendWithRetry(request, retries = MAX_RETRIES) {
  const baseDelay = 500;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(request);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, baseDelay * 2 ** i));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, baseDelay * 2 ** i));
    }
  }
  throw new Error('Slack API failed after maximum retries.');
}

/**
 * Determines whether an incoming Slack event should be processed.
 * @param {object} event - The Slack event object.
 * @param {string} sourceChannelId - Allowed source channel ID from environment.
 * @returns {boolean} True if event should be processed, false otherwise.
 */
function shouldProcessEvent(event, sourceChannelId) {
  if (!event || !event.channel || event.type !== "message") return false;
  return event.channel === sourceChannelId;
}

/**
 * Forwards a Slack message event to a target channel using the Slack API.
 * 
 * This function takes a Slack event object and reposts it to a specified target channel,
 * preserving the original message content including text, attachments, and Block Kit blocks.
 * Uses retry logic for resilient API calls.
 * 
 * @async
 * @function forwardMessage
 * @param {Object} event - The Slack event object containing the message to forward
 * @param {string} event.text - The plain text content of the message (optional)
 * @param {Array} [event.attachments] - Array of Slack message attachments (optional)
 * @param {Array} [event.blocks] - Array of Block Kit blocks for rich formatting (optional)
 * @param {string} targetChannel - The Slack channel ID where the message should be forwarded
 * @param {Object} env - Environment variables object containing configuration
 * @param {string} env.SLACK_BOT_TOKEN - The Slack bot token for API authentication
 * @returns {Promise<void>} Resolves when the message is successfully posted or logs error if failed
 * 
 * @throws {Error} Throws if the Slack API call fails after all retry attempts
 * 
 * @example
 * // Forward a simple text message
 * const event = { text: "Hello world!", channel: "C1234567890" };
 * await forwardMessage(event, "C0987654321", env);
 * 
 * @example
 * // Forward a message with Block Kit content
 * const event = {
 *   text: "Deployment status",
 *   blocks: [
 *     {
 *       type: "section",
 *       text: { type: "mrkdwn", text: "*Status:* Success" }
 *     }
 *   ]
 * };
 * await forwardMessage(event, "C0987654321", env);
 */
export async function forwardMessage(event, targetChannel, env) {
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

  const res = await sendWithRetry("https://slack.com/api/chat.postMessage", {
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