import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET_NAME = "vehicle-generated-images";

function cleanRegistrationNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function createNumberPlateSvg(registrationNumber: string) {
  const escaped = registrationNumber.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] || character
  );

  return Buffer.from(`
    <svg width="470" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="3"
        y="3"
        width="464"
        height="114"
        rx="14"
        fill="#ffffff"
        stroke="#111827"
        stroke-width="6"
      />
      <rect
        x="18"
        y="18"
        width="434"
        height="84"
        rx="8"
        fill="#f8fafc"
        stroke="#cbd5e1"
        stroke-width="2"
      />
      <text
        x="235"
        y="77"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="48"
        font-weight="800"
        letter-spacing="4"
        fill="#111827"
      >${escaped}</text>
    </svg>
  `);
}

export async function POST(request: NextRequest) {
  try {
    const openAIApiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!openAIApiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing in .env.local." },
        { status: 500 }
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
        },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const accessToken = authorization.slice("Bearer ".length).trim();

    const adminSupabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid or has expired." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      vehicleId?: number;
    };

    const vehicleId = Number(body.vehicleId);

    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return NextResponse.json(
        { error: "A valid vehicleId is required." },
        { status: 400 }
      );
    }

    const { data: vehicle, error: vehicleError } =
      await adminSupabase
        .from("vehicles")
        .select(
          "id, user_id, vehicle_number, vehicle_type, brand, model, colour, manufacturing_year"
        )
        .eq("id", vehicleId)
        .eq("user_id", user.id)
        .single();

    if (vehicleError || !vehicle) {
      return NextResponse.json(
        { error: "Vehicle not found." },
        { status: 404 }
      );
    }

    const brand = String(vehicle.brand || "").trim();
    const model = String(vehicle.model || "").trim();
    const colour = String(
      vehicle.colour || ""
    ).trim();
    const registrationNumber = cleanRegistrationNumber(
      String(vehicle.vehicle_number || "")
    );
    const vehicleType = String(
      vehicle.vehicle_type || "car"
    ).trim();
    const year = String(
      vehicle.manufacturing_year || ""
    ).trim();

    const missingFields = [
      !brand ? "brand" : "",
      !model ? "model" : "",
      !colour ? "colour" : "",
      !registrationNumber ? "vehicle number" : "",
    ].filter(Boolean);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Complete these vehicle details first: ${missingFields.join(
            ", "
          )}.`,
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: openAIApiKey,
    });

    const prompt = `
Create a premium automotive dashboard render of a ${colour} ${year} ${brand}
${model}, vehicle type ${vehicleType}.

Composition:
- realistic manufacturer-correct body shape and design
- front three-quarter view
- entire vehicle visible and centred
- wheels straight
- clean dark navy studio background
- subtle blue rim lighting
- soft floor reflection
- no people
- no showroom text
- no logos floating in the background
- no extra vehicles
- no writing anywhere in the image
- leave the front registration plate area plain white and unobstructed
- premium high-end automotive advertising photography
- suitable for a dark mobile-app dashboard
`.trim();

    const imageResult = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      quality: "high",
    });

    const base64Image = imageResult.data?.[0]?.b64_json;

    if (!base64Image) {
      return NextResponse.json(
        { error: "The image generator returned no image." },
        { status: 502 }
      );
    }

    const generatedBuffer = Buffer.from(base64Image, "base64");

    const metadata = await sharp(generatedBuffer).metadata();
    const outputWidth = metadata.width || 1536;
    const outputHeight = metadata.height || 1024;

    const plateWidth = Math.min(
      470,
      Math.round(outputWidth * 0.31)
    );
    const plateHeight = Math.round(plateWidth * (120 / 470));

    const plateSvg = await sharp(
      createNumberPlateSvg(registrationNumber)
    )
      .resize(plateWidth, plateHeight)
      .png()
      .toBuffer();

    // The plate is placed in the lower-centre region. Adjust top if your
    // preferred generated composition places the front bumper elsewhere.
    const left = Math.round(
      (outputWidth - plateWidth) / 2
    );
    const top = Math.round(outputHeight * 0.70);

    const finalImage = await sharp(generatedBuffer)
      .composite([
        {
          input: plateSvg,
          left,
          top,
        },
      ])
      .png()
      .toBuffer();

    const fileName = `${safeFilePart(
      registrationNumber
    )}-${Date.now()}.png`;

    const storagePath = `${user.id}/${vehicleId}/${fileName}`;

    const { error: uploadError } =
      await adminSupabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, finalImage, {
          contentType: "image/png",
          cacheControl: "31536000",
          upsert: false,
        });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: publicUrlData,
    } = adminSupabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const generatedImageUrl =
      publicUrlData.publicUrl;

    const { error: updateError } =
      await adminSupabase
        .from("vehicles")
        .update({
          generated_image_url: generatedImageUrl,
        })
        .eq("id", vehicleId)
        .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      generatedImageUrl,
    });
  } catch (error) {
    console.error("Vehicle image generation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the vehicle image.",
      },
      { status: 500 }
    );
  }
}