import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import webpush from "web-push";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  return authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function createUserClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function configureWebPush() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required."
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authorization token is required." },
        { status: 401 }
      );
    }

    configureWebPush();

    const supabase = createUserClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    const { data: subscriptions, error: subscriptionError } =
      await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_key")
        .eq("user_id", user.id)
        .eq("is_active", true);

    if (subscriptionError) throw subscriptionError;

    if (!subscriptions?.length) {
      return NextResponse.json(
        {
          error:
            "No active push subscription exists. Enable notifications first.",
        },
        { status: 404 }
      );
    }

    const payload = JSON.stringify({
      title: "My Vehicle",
      body: "Test notification received successfully.",
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      tag: "my-vehicle-test",
      url: "/notifications",
      category: "mira",
      priority: "normal",
    });

    let delivered = 0;
    let removed = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth_key,
              },
            },
            payload,
            {
              TTL: 60,
              urgency: "normal",
            }
          );

          delivered += 1;
        } catch (error: any) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            removed += 1;

            await supabase
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("id", subscription.id)
              .eq("user_id", user.id);

            return;
          }

          throw error;
        }
      })
    );

    return NextResponse.json({
      success: true,
      delivered,
      expired_subscriptions_disabled: removed,
      message:
        delivered > 0
          ? "Test notification sent."
          : "No active device accepted the notification.",
    });
  } catch (error: unknown) {
    console.error("Test push error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send the test notification.",
      },
      { status: 500 }
    );
  }
}