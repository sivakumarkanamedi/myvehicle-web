"use client";

import { FormEvent, useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

type SavedParkingLocation = {
  latitude: number;
  longitude: number;
  savedAt: string;
  placeName?: string;
  level?: string;
  spot?: string;
  note?: string;
};

const STORAGE_KEY = "myVehicleParking";

export default function SaveParkingDialog({
  open,
  onClose,
}: Props) {
  const [placeName, setPlaceName] = useState("");
  const [level, setLevel] = useState("");
  const [spot, setSpot] = useState("");
  const [note, setNote] = useState("");

  const [latitude, setLatitude] = useState<number | null>(
    null
  );
  const [longitude, setLongitude] = useState<number | null>(
    null
  );

  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasSavedParking, setHasSavedParking] =
    useState(false);

  useEffect(() => {
    if (!open) return;

    setStatus("");

    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        resetParkingForm();
        return;
      }

      const parking = JSON.parse(
        stored
      ) as Partial<SavedParkingLocation>;

      if (
        typeof parking.latitude !== "number" ||
        typeof parking.longitude !== "number"
      ) {
        resetParkingForm();
        return;
      }

      setHasSavedParking(true);
      setLatitude(parking.latitude);
      setLongitude(parking.longitude);
      setPlaceName(parking.placeName || "");
      setLevel(parking.level || "");
      setSpot(parking.spot || "");
      setNote(parking.note || "");
    } catch {
      resetParkingForm();
    }
  }, [open]);

  function resetParkingForm() {
    setHasSavedParking(false);
    setLatitude(null);
    setLongitude(null);
    setPlaceName("");
    setLevel("");
    setSpot("");
    setNote("");
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setStatus(
        "Location services are not supported by this browser."
      );
      return;
    }

    setLocating(true);
    setStatus("Getting your current GPS location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);

        setStatus(
          "Current location captured successfully."
        );

        setLocating(false);
      },
      (error) => {
        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
          setStatus(
            "Location permission was denied. Allow location access in your browser and try again."
          );
          return;
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          setStatus(
            "Your current location is unavailable. Check that GPS is enabled."
          );
          return;
        }

        if (error.code === error.TIMEOUT) {
          setStatus(
            "Location request timed out. Please try again."
          );
          return;
        }

        setStatus(
          "Could not get your current location."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  function saveParking(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (latitude === null || longitude === null) {
      setStatus(
        "Capture your current location before saving."
      );
      return;
    }

    setSaving(true);

    const parking: SavedParkingLocation = {
      latitude,
      longitude,
      savedAt: new Date().toISOString(),
      placeName: placeName.trim() || undefined,
      level: level.trim() || undefined,
      spot: spot.trim() || undefined,
      note: note.trim() || undefined,
    };

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(parking)
      );

      window.dispatchEvent(
        new Event("myVehicleParkingUpdated")
      );

      setHasSavedParking(true);
      setStatus(
        "Parking location saved successfully."
      );

      window.setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      setStatus(
        "Parking location could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  function removeParking() {
    const confirmed = window.confirm(
      "Remove your saved parking location?"
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);

    window.dispatchEvent(
      new Event("myVehicleParkingUpdated")
    );

    resetParkingForm();

    setStatus(
      "Saved parking location removed."
    );
  }

  function openMap(
    mode: "view" | "navigate"
  ) {
    if (latitude === null || longitude === null) {
      return;
    }

    const coordinates = `${latitude},${longitude}`;

    const url =
      mode === "navigate"
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            coordinates
          )}`
        : `https://www.google.com/maps/search/?api=1&query=${coordinates}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (!open) {
    return null;
  }

  return (
    <div
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "rgba(2, 6, 23, 0.82)",
        backdropFilter: "blur(8px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="parking-dialog-title"
        style={{
          width: "100%",
          maxWidth: "620px",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: "22px",
          border: "1px solid #155e75",
          background: "#0f172a",
          color: "white",
          boxShadow:
            "0 28px 80px rgba(0, 0, 0, 0.45)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            padding: "22px",
            borderBottom:
              "1px solid #1e293b",
            background:
              "linear-gradient(135deg, #083344, #172554)",
          }}
        >
          <div>
            <h2
              id="parking-dialog-title"
              style={{
                margin: 0,
                fontSize: "22px",
              }}
            >
              📍 Parked Location
            </h2>

            <p
              style={{
                margin: "8px 0 0",
                color: "#a5f3fc",
                lineHeight: 1.5,
              }}
            >
              Save your vehicle location and
              navigate back later.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close parking dialog"
            style={{
              width: "36px",
              height: "36px",
              flexShrink: 0,
              borderRadius: "50%",
              border:
                "1px solid rgba(255,255,255,0.18)",
              background:
                "rgba(255,255,255,0.08)",
              color: "white",
              cursor: "pointer",
              fontSize: "20px",
            }}
          >
            ×
          </button>
        </header>

        <form
          onSubmit={saveParking}
          style={{
            display: "grid",
            gap: "16px",
            padding: "22px",
          }}
        >
          <button
            type="button"
            onClick={captureLocation}
            disabled={locating}
            style={{
              padding: "14px 18px",
              borderRadius: "14px",
              border: "none",
              background: "#0891b2",
              color: "white",
              cursor: locating
                ? "not-allowed"
                : "pointer",
              opacity: locating ? 0.65 : 1,
              fontWeight: 800,
              fontSize: "15px",
            }}
          >
            {locating
              ? "Getting Current Location..."
              : "📡 Capture Current Location"}
          </button>

          {latitude !== null &&
            longitude !== null && (
              <div
                style={{
                  padding: "13px 15px",
                  borderRadius: "13px",
                  border:
                    "1px solid #164e63",
                  background: "#083344",
                  color: "#cffafe",
                  lineHeight: 1.5,
                }}
              >
                GPS captured:{" "}
                {latitude.toFixed(5)},{" "}
                {longitude.toFixed(5)}
              </div>
            )}

          <label
            style={{
              display: "grid",
              gap: "7px",
            }}
          >
            <span
              style={{
                fontWeight: 700,
              }}
            >
              Place name
            </span>

            <input
              value={placeName}
              onChange={(event) =>
                setPlaceName(
                  event.target.value
                )
              }
              placeholder="Example: Phoenix Mall"
              style={inputStyle}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
            }}
          >
            <label
              style={{
                display: "grid",
                gap: "7px",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                }}
              >
                Level
              </span>

              <input
                value={level}
                onChange={(event) =>
                  setLevel(
                    event.target.value
                  )
                }
                placeholder="Example: B2"
                style={inputStyle}
              />
            </label>

            <label
              style={{
                display: "grid",
                gap: "7px",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                }}
              >
                Parking spot
              </span>

              <input
                value={spot}
                onChange={(event) =>
                  setSpot(
                    event.target.value
                  )
                }
                placeholder="Example: C18"
                style={inputStyle}
              />
            </label>
          </div>

          <label
            style={{
              display: "grid",
              gap: "7px",
            }}
          >
            <span
              style={{
                fontWeight: 700,
              }}
            >
              Note (optional)
            </span>

            <textarea
              value={note}
              onChange={(event) =>
                setNote(
                  event.target.value
                )
              }
              placeholder="Example: Near lift number 3"
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </label>

          {status && (
            <div
              style={{
                padding: "13px 15px",
                borderRadius: "13px",
                border:
                  "1px solid #1d4ed8",
                background: "#172554",
                color: "#bfdbfe",
                lineHeight: 1.5,
              }}
            >
              {status}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              paddingTop: "4px",
            }}
          >
            <button
              type="submit"
              disabled={
                saving ||
                latitude === null ||
                longitude === null
              }
              style={{
                flex: "1 1 190px",
                padding: "13px 18px",
                borderRadius: "13px",
                border: "none",
                background: "#2563eb",
                color: "white",
                cursor:
                  saving ||
                  latitude === null ||
                  longitude === null
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  saving ||
                  latitude === null ||
                  longitude === null
                    ? 0.55
                    : 1,
                fontWeight: 800,
              }}
            >
              {saving
                ? "Saving..."
                : hasSavedParking
                  ? "Update Parking"
                  : "Save Current Parking"}
            </button>

            {hasSavedParking && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    openMap("navigate")
                  }
                  style={secondaryButtonStyle}
                >
                  🧭 Navigate Back
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openMap("view")
                  }
                  style={secondaryButtonStyle}
                >
                  View Location
                </button>

                <button
                  type="button"
                  onClick={removeParking}
                  style={{
                    ...secondaryButtonStyle,
                    border:
                      "1px solid #ef4444",
                    color: "#fecaca",
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
  outline: "none",
  fontSize: "15px",
};

const secondaryButtonStyle = {
  flex: "1 1 150px",
  padding: "13px 16px",
  borderRadius: "13px",
  border: "1px solid #22d3ee",
  background: "transparent",
  color: "#cffafe",
  cursor: "pointer",
  fontWeight: 700,
};