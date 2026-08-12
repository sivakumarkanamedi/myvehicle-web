"use client";

type MicrophoneButtonProps = {
  isListening: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  size?: number;
};

export default function MicrophoneButton({
  isListening,
  disabled = false,
  onStart,
  onStop,
  size = 52,
}: MicrophoneButtonProps) {
  function handleClick() {
    if (disabled) return;
    isListening ? onStop() : onStart();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={isListening ? "Stop voice input" : "Start voice input"}
      title={isListening ? "Stop listening" : "Speak to Mira"}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        borderRadius: "16px",
        border: isListening ? "1px solid #f87171" : "1px solid #164e63",
        background: disabled
          ? "#1e293b"
          : isListening
            ? "linear-gradient(135deg, #dc2626, #991b1b)"
            : "linear-gradient(135deg, #06b6d4, #2563eb)",
        color: "white",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxShadow: isListening
          ? "0 0 0 6px rgba(239,68,68,0.12), 0 0 28px rgba(239,68,68,0.35)"
          : "0 10px 24px rgba(6,182,212,0.2)",
        transition: "transform 160ms ease, box-shadow 160ms ease",
      }}
      onMouseEnter={(event) => {
        if (!disabled) event.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {isListening && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "-7px",
            borderRadius: "20px",
            border: "2px solid rgba(248,113,113,0.45)",
            animation: "miraMicrophonePulse 1.2s ease-out infinite",
          }}
        />
      )}

      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isListening ? (
          <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
        ) : (
          <>
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <path d="M12 17v5" />
            <path d="M8 22h8" />
          </>
        )}
      </svg>

      <style jsx>{`
        @keyframes miraMicrophonePulse {
          0% {
            transform: scale(0.92);
            opacity: 0.9;
          }
          70%,
          100% {
            transform: scale(1.12);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  );
}