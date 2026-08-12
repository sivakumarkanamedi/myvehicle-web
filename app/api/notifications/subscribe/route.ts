import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type SubscriptionBody = {
  subscription?: {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  userAgent?: string | null;
};

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

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authorization token is required." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as SubscriptionBody;
    const subscription = body.subscription;

    if (
      !subscription?.endpoint ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return NextResponse.json(
        { error: "A valid push subscription is required." },
        { status: 400 }
      );
    }

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

    const { data, error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          expiration_time: subscription.expirationTime
            ? new Date(subscription.expirationTime).toISOString()
            : null,
          user_agent:
            typeof body.userAgent === "string"
              ? body.userAgent.slice(0, 500)
              : null,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,endpoint",
        }
      )
      .select("id, endpoint, is_active, created_at, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      subscription: data,
      message: "Push notifications are enabled on this device.",
    });
  } catch (error: unknown) {
    console.error("Push subscription error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the push subscription.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authorization token is required." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      endpoint?: string;
    };

    if (!body.endpoint) {
      return NextResponse.json(
        { error: "Subscription endpoint is required." },
        { status: 400 }
      );
    }

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

    const { error } = await supabase
      .from("push_subscriptions")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("endpoint", body.endpoint);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Push notifications are disabled on this device.",
    });
  } catch (error: unknown) {
    console.error("Push unsubscribe error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to disable push notifications.",
      },
      { status: 500 }
    );
  }
}