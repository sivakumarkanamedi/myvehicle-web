"use client";

import { useState } from "react";
import {
  ImageIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../supabase";

type GenerateVehicleImageButtonProps = {
  vehicleId: number;
  hasGeneratedImage?: boolean;
  onGenerated?: (
    generatedImageUrl: string
  ) => void;
};

export default function GenerateVehicleImageButton({
  vehicleId,
  hasGeneratedImage = false,
  onGenerated,
}: GenerateVehicleImageButtonProps) {
  const [generating, setGenerating] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  async function generateImage() {
    if (generating) return;

    setGenerating(true);
    setMessage("");
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Please sign in again."
        );
      }

      const response = await fetch(
        "/api/generate-vehicle-image",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            vehicleId,
          }),
        }
      );

      const result = (await response.json()) as {
        success?: boolean;
        generatedImageUrl?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to generate image."
        );
      }

      if (!result.generatedImageUrl) {
        throw new Error(
          "The generated image URL is missing."
        );
      }

      setMessage(
        "Premium vehicle image generated."
      );

      onGenerated?.(
        result.generatedImageUrl
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to generate image."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void generateImage()
        }
        disabled={generating}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {generating ? (
          <Loader2
            size={18}
            className="animate-spin"
          />
        ) : hasGeneratedImage ? (
          <RefreshCw size={18} />
        ) : (
          <ImageIcon size={18} />
        )}

        {generating
          ? "Generating..."
          : hasGeneratedImage
            ? "Regenerate Vehicle Image"
            : "Generate Vehicle Image"}
      </button>

      {message ? (
        <p className="mt-2 text-sm text-emerald-600">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}