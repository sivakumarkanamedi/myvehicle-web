import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ensureEnvironment() {
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function adminClient() {
  ensureEnvironment();

  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function authenticatedUser(request: NextRequest) {
  ensureEnvironment();

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(accessToken);

  if (error || !user) return null;
  return user;
}

function durationToMilliseconds(duration: string) {
  if (duration === "5-minutes") return 5 * 60 * 1000;
  if (duration === "30-minutes") return 30 * 60 * 1000;
  if (duration === "1-hour") return 60 * 60 * 1000;
  if (duration === "24-hours") return 24 * 60 * 60 * 1000;

  throw new Error("Unsupported share duration.");
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      documentId?: number;
      duration?: string;
      permissionLevel?: "view" | "download";
    };

    const documentId = Number(body.documentId);
    const duration = body.duration || "30-minutes";
    const permissionLevel =
      body.permissionLevel === "download" ? "download" : "view";

    if (!Number.isInteger(documentId) || documentId <= 0) {
      return NextResponse.json(
        { error: "A valid document ID is required." },
        { status: 400 }
      );
    }

    const admin = adminClient();

    const { data: document, error: documentError } = await admin
      .from("vehicle_documents")
      .select("id, user_id")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      );
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + durationToMilliseconds(duration)
    ).toISOString();

    const { data: shareLink, error: createError } = await admin
      .from("document_secure_share_links")
      .insert({
        user_id: user.id,
        document_id: documentId,
        token_hash: tokenHash,
        permission_level: permissionLevel,
        expires_at: expiresAt,
      })
      .select(
        "id, document_id, permission_level, expires_at, revoked_at, scan_count, last_scanned_at, created_at"
      )
      .single();

    if (createError || !shareLink) {
      throw new Error(
        createError?.message || "Unable to create secure share link."
      );
    }

    await admin.from("document_activity_logs").insert({
      user_id: user.id,
      document_id: documentId,
      action_type: "qr_created",
      action_label: "Secure QR share created",
      details: {
        permission_level: permissionLevel,
        expires_at: expiresAt,
      },
    });

    const origin = request.nextUrl.origin;
    const shareUrl = `${origin}/shared-document/${token}`;

    return NextResponse.json({
      shareLink,
      shareUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create secure share link.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "Share token is required." },
        { status: 400 }
      );
    }

    const admin = adminClient();
    const tokenHash = hashToken(token);

    const { data: shareLink, error: linkError } = await admin
      .from("document_secure_share_links")
      .select(
        "id, user_id, document_id, permission_level, expires_at, revoked_at, scan_count"
      )
      .eq("token_hash", tokenHash)
      .single();

    if (linkError || !shareLink) {
      return NextResponse.json(
        { error: "This secure link is invalid." },
        { status: 404 }
      );
    }

    if (shareLink.revoked_at) {
      return NextResponse.json(
        { error: "This secure link has been revoked." },
        { status: 410 }
      );
    }

    if (new Date(shareLink.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "This secure link has expired." },
        { status: 410 }
      );
    }

    const { data: document, error: documentError } = await admin
      .from("vehicle_documents")
      .select(
        "id, document_type, document_name, document_number, vehicle_id, file_path, file_url, verified, expiry_date"
      )
      .eq("id", shareLink.document_id)
      .eq("user_id", shareLink.user_id)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "The shared document is no longer available." },
        { status: 404 }
      );
    }

    let secureFileUrl = document.file_url as string | null;

    if (document.file_path) {
      const { data: signedData, error: signedError } = await admin.storage
        .from("vehicle-documents")
        .createSignedUrl(document.file_path, 300);

      if (signedError || !signedData?.signedUrl) {
        throw new Error(
          signedError?.message || "Unable to open the shared document."
        );
      }

      secureFileUrl = signedData.signedUrl;
    }

    const scannedAt = new Date().toISOString();

    await admin
      .from("document_secure_share_links")
      .update({
        scan_count: Number(shareLink.scan_count || 0) + 1,
        last_scanned_at: scannedAt,
      })
      .eq("id", shareLink.id);

    await admin.from("document_activity_logs").insert({
      user_id: shareLink.user_id,
      document_id: shareLink.document_id,
      action_type: "qr_scanned",
      action_label: "Secure QR share scanned",
      details: {
        permission_level: shareLink.permission_level,
        scanned_at: scannedAt,
      },
    });

    return NextResponse.json({
      document: {
        id: document.id,
        documentType:
          document.document_type ||
          document.document_name ||
          "Vehicle Document",
        documentNumber: document.document_number,
        verified: Boolean(document.verified),
        expiryDate: document.expiry_date,
      },
      permissionLevel: shareLink.permission_level,
      expiresAt: shareLink.expires_at,
      secureFileUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to open the secure document.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      shareLinkId?: number;
    };

    const shareLinkId = Number(body.shareLinkId);

    if (!Number.isInteger(shareLinkId) || shareLinkId <= 0) {
      return NextResponse.json(
        { error: "A valid share-link ID is required." },
        { status: 400 }
      );
    }

    const admin = adminClient();

    const { data: shareLink, error: findError } = await admin
      .from("document_secure_share_links")
      .select("id, document_id, revoked_at")
      .eq("id", shareLinkId)
      .eq("user_id", user.id)
      .single();

    if (findError || !shareLink) {
      return NextResponse.json(
        { error: "Secure share link not found." },
        { status: 404 }
      );
    }

    if (!shareLink.revoked_at) {
      const revokedAt = new Date().toISOString();

      const { error: revokeError } = await admin
        .from("document_secure_share_links")
        .update({ revoked_at: revokedAt })
        .eq("id", shareLink.id)
        .eq("user_id", user.id);

      if (revokeError) throw revokeError;

      await admin.from("document_activity_logs").insert({
        user_id: user.id,
        document_id: shareLink.document_id,
        action_type: "qr_revoked",
        action_label: "Secure QR share revoked",
        details: {
          revoked_at: revokedAt,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to revoke secure share link.",
      },
      { status: 500 }
    );
  }
}