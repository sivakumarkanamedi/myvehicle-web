"use client";

import { useEffect, useState } from "react";

export type SavedParkingLocation = {
  latitude: number;
  longitude: number;
  savedAt: string;
  placeName?: string;
  level?: string;
  spot?: string;
  note?: string;
};

const PARKING_STORAGE_KEY = "myVehicleParking";
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function formatParkingTime(savedAt: string): string {
  const savedTime = new Date(savedAt).getTime();

  if (Number.isNaN(savedTime)) {
    return "Recently saved";
  }

  const difference = Date.now() - savedTime;
  const minutes = Math.floor(difference / (60 * 1000));

  if (minutes < 1) {
    return "Saved just now";
  }

  if (minutes < 60) {
    return `Saved ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `Saved ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return new Date(savedAt).toLocaleString();
}

function isValidParkingLocation(
  value: unknown
): value is SavedParkingLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const parking = value as Partial<SavedParkingLocation>;

  return (
    typeof parking.latitude === "number" &&
    Number.isFinite(parking.latitude) &&
    typeof parking.longitude === "number" &&
    Number.isFinite(parking.longitude) &&
    typeof parking.savedAt === "string"
  );
}

export default function SmartParkingCard() {
  const [parking, setParking] =
    useState<SavedParkingLocation | null>(null);

  useEffect(() => {
    loadSavedParking();

    function handleParkingUpdated() {
      loadSavedParking();
    }

    window.addEventListener(
      "myVehicleParkingUpdated",
      handleParkingUpdated
    );

    window.addEventListener("storage", handleParkingUpdated);

    return () => {
      window.removeEventListener(
        "myVehicleParkingUpdated",
        handleParkingUpdated
      );

      window.removeEventListener(
        "storage",
        handleParkingUpdated
      );
    };
  }, []);

  function loadSavedParking() {
    try {
      const savedParking = localStorage.getItem(
        PARKING_STORAGE_KEY
      );

      if (!savedParking) {
        setParking(null);
        return;
      }

      const parsedParking: unknown = JSON.parse(savedParking);

      if (!isValidParkingLocation(parsedParking)) {
        localStorage.removeItem(PARKING_STORAGE_KEY);
        setParking(null);
        return;
      }

      const savedTime = new Date(
        parsedParking.savedAt
      ).getTime();

      const isExpired =
        Number.isNaN(savedTime) ||
        Date.now() - savedTime > TWENTY_FOUR_HOURS;

      if (isExpired) {
        localStorage.removeItem(PARKING_STORAGE_KEY);
        setParking(null);
        return;
      }

      setParking(parsedParking);
    } catch {
      localStorage.removeItem(PARKING_STORAGE_KEY);
      setParking(null);
    }
  }

  function navigateBackToVehicle() {
    if (!parking) return;

    const destination =
      `${parking.latitude},${parking.longitude}`;

    const navigationUrl =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${encodeURIComponent(destination)}`;

    window.open(
      navigationUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function viewParkingLocation() {
    if (!parking) return;

    const locationUrl =
      `https://www.google.com/maps/search/?api=1` +
      `&query=${parking.latitude},${parking.longitude}`;

    window.open(
      locationUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function clearParkingLocation() {
    const confirmed = window.confirm(
      "Remove your saved parking location?"
    );

    if (!confirmed) return;

    localStorage.removeItem(PARKING_STORAGE_KEY);
    setParking(null);

    window.dispatchEvent(
      new Event("myVehicleParkingUpdated")
    );
  }

  if (!parking) {
    return null;
  }

  return (
    <article
      style={{
        padding: "20px",
        borderRadius: "18px",
        border: "1px solid #0e7490",
        background:
          "linear-gradient(135deg, #083344, #172554)",
        color: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "14px",
        }}
      >
        <div
          style={{
            width: "46px",
            height: "46px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "14px",
            background: "#155e75",
            fontSize: "22px",
          }}
        >
          📍
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                }}
              >
                Smart Parking
              </h2>

              <p
                style={{
                  marginTop: "5px",
                  marginBottom: 0,
                  color: "#a5f3fc",
                  fontSize: "14px",
                }}
              >
                {formatParkingTime(parking.savedAt)}
              </p>
            </div>

            <button
              type="button"
              onClick={clearParkingLocation}
              aria-label="Remove saved parking location"
              title="Remove saved parking location"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border:
                  "1px solid rgba(255, 255, 255, 0.2)",
                background:
                  "rgba(255, 255, 255, 0.08)",
                color: "white",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              marginTop: "16px",
              display: "grid",
              gap: "8px",
              color: "#e2e8f0",
              lineHeight: 1.5,
            }}
          >
            <div>
              <strong>Location: </strong>
              {parking.placeName ||
                `${parking.latitude.toFixed(
                  5
                )}, ${parking.longitude.toFixed(5)}`}
            </div>

            {parking.level && (
              <div>
                <strong>Level: </strong>
                {parking.level}
              </div>
            )}

            {parking.spot && (
              <div>
                <strong>Parking spot: </strong>
                {parking.spot}
              </div>
            )}

            {parking.note && (
              <div>
                <strong>Note: </strong>
                {parking.note}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "18px",
            }}
          >
            <button
              type="button"
              onClick={navigateBackToVehicle}
              style={{
                padding: "11px 16px",
                border: "none",
                borderRadius: "12px",
                background: "#0891b2",
                color: "white",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              🧭 Navigate Back
            </button>

            <button
              type="button"
              onClick={viewParkingLocation}
              style={{
                padding: "11px 16px",
                borderRadius: "12px",
                border: "1px solid #22d3ee",
                background: "transparent",
                color: "#cffafe",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              View Location
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}