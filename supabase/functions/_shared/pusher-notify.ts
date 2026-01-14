// Internal Pusher notification helper for edge functions
// This can be called from other edge functions without auth requirements

interface PusherNotifyOptions {
  channel: string;
  event: string;
  data: Record<string, any>;
}

interface NotificationData {
  title: string;
  body: string;
  type?: string;
  contentId?: string;
  episodeId?: string;
  progress?: number;
  status?: 'started' | 'completed' | 'failed';
}

/**
 * Send a Pusher notification internally (no auth required)
 * Use this from edge functions to send real-time notifications
 */
export async function sendPusherNotification(options: PusherNotifyOptions): Promise<{ success: boolean; error?: string }> {
  const appId = Deno.env.get("PUSHER_APP_ID");
  const key = Deno.env.get("PUSHER_KEY");
  const secret = Deno.env.get("PUSHER_SECRET");
  const cluster = Deno.env.get("PUSHER_CLUSTER") || "us2";

  if (!appId || !key || !secret) {
    console.warn("Pusher credentials not configured - skipping notification");
    return { success: false, error: "Pusher not configured" };
  }

  try {
    const { channel, event, data } = options;

    // Prepare the event payload
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      name: event,
      channel: channel,
      data: JSON.stringify(data),
    });

    // Generate MD5 hash of body
    const bodyMd5 = await crypto.subtle.digest(
      "MD5",
      new TextEncoder().encode(body)
    ).then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );

    // Create signature
    const stringToSign = [
      "POST",
      `/apps/${appId}/events`,
      `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`,
    ].join("\n");

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const signData = encoder.encode(stringToSign);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, signData);
    const authSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Send to Pusher
    const pusherUrl = `https://api-${cluster}.pusher.com/apps/${appId}/events?auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}&auth_signature=${authSignature}`;

    const response = await fetch(pusherUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Pusher error:", errorText);
      return { success: false, error: errorText };
    }

    console.log(`Pusher notification sent to ${channel}:${event}`);
    return { success: true };
  } catch (error) {
    console.error("Pusher notification error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send a subtitle generation notification to a specific user
 */
export async function notifySubtitleProgress(
  userId: string,
  data: NotificationData
): Promise<void> {
  await sendPusherNotification({
    channel: `user-${userId}`,
    event: "subtitle-progress",
    data,
  });
}

/**
 * Send a broadcast notification (public channel)
 */
export async function notifyBroadcast(
  data: NotificationData
): Promise<void> {
  await sendPusherNotification({
    channel: "public-notifications",
    event: "notification",
    data,
  });
}
