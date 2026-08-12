"use client";

type VoiceWaveProps = {
  active: boolean;
  bars?: number;
  color?: string;
  height?: number;
};

export default function VoiceWave({
  active,
  bars = 7,
  color = "#22d3ee",
  height = 28,
}: VoiceWaveProps) {
  return (
    <div
      aria-label={active ? "Voice activity detected" : "Voice inactive"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        height,
      }}
    >
      {Array.from({ length: bars }).map((_, index) => {
        const delay = `${index * 90}ms`;

        return (
          <span
            key={index}
            style={{
              width: "4px",
              height: active
                ? `${10 + ((index * 7) % 18)}px`
                : "6px",
              borderRadius: "999px",
              background: color,
              opacity: active ? 1 : 0.35,
              transformOrigin: "center",
              animation: active
                ? `miraVoiceWave 780ms ease-in-out ${delay} infinite alternate`
                : "none",
              transition:
                "height 180ms ease, opacity 180ms ease",
            }}
          />
        );
      })}

      <style jsx>{`
        @keyframes miraVoiceWave {
          0% {
            transform: scaleY(0.45);
          }

          50% {
            transform: scaleY(1.25);
          }

          100% {
            transform: scaleY(0.7);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          span {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}