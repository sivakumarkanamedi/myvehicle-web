import { createClient } from "@supabase/supabase-js";

type RateLimitOptions = {
  userId: string;
  key: string;
  windowSeconds: number;
  maxRequests: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
};

export async function consumeRateLimit({
  userId,
  key,
  windowSeconds,
  maxRequests,
}: RateLimitOptions): Promise<RateLimitResult> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase server configuration is missing for rate limiting."
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data, error } = await supabase.rpc(
    "consume_api_rate_limit",
    {
      p_user_id: userId,
      p_limit_key: key,
      p_window_seconds: windowSeconds,
      p_max_requests: maxRequests,
    }
  );

  if (error) {
    throw new Error(
      `Rate limit check failed: ${error.message}`
    );
  }

  const result =
    Array.isArray(data) ? data[0] : data;

  if (!result) {
    throw new Error(
      "Rate limit check returned no result."
    );
  }

  return {
    allowed: Boolean(result.allowed),
    remaining: Number(
      result.remaining ?? 0
    ),
    resetAt: String(
      result.reset_at
    ),
  };
}