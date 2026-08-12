"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type GarageService = {
  id: number;
  service_code: string | null;
  service_name: string;
  service_category: string;
  description: string | null;
  estimated_duration_minutes: number | null;
  starting_price: number | null;
  is_available: boolean;
};

type GarageInsurer = {
  insurer_name: string;
  insurer_code: string | null;
  network_type: string;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
};

export type CashlessGarage = {
  id: number;
  name: string;
  legal_name: string | null;
  garage_code: string | null;

  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  website_url: string | null;

  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;

  latitude: number | null;
  longitude: number | null;

  rating: number | null;
  review_count: number;

  is_verified: boolean;
  is_cashless: boolean;
  is_24x7: boolean;
  pickup_drop_available: boolean;
  towing_available: boolean;
  emergency_support_available: boolean;

  opening_time: string | null;
  closing_time: string | null;
  weekly_off_days: string[];

  specializations: string[];
  supported_vehicle_types: string[];
  supported_brands: string[];

  estimated_wait_minutes: number | null;
  average_repair_days: number | null;

  cashless_garage_insurers?: GarageInsurer[];
  cashless_garage_services?: GarageService[];

  distance_km: number | null;
  is_open_now: boolean | null;
  insurer_cashless_match: boolean;
  mira_score: number;
  recommendation_reasons: string[];
};

type PolicySummary = {
  id: number;
  vehicle_id: number;
  insurance_company: string;
  policy_number: string;
  vehicles?: {
    vehicle_number?: string | null;
    brand?: string | null;
    model?: string | null;
    vehicle_type?: string | null;
  } | null;
};

type Props = {
  policy: PolicySummary;
  claimId?: number | null;
  onSelectGarage?: (garage: CashlessGarage) => void;
  onClose?: () => void;
};

type SearchFilters = {
  city: string;
  state: string;
  radiusKm: string;
  specialization: string;
  serviceCategory: string;
  verifiedOnly: boolean;
  openNowOnly: boolean;
  pickupDropOnly: boolean;
  towingOnly: boolean;
  emergencyOnly: boolean;
};

const initialFilters: SearchFilters = {
  city: "",
  state: "",
  radiusKm: "50",
  specialization: "",
  serviceCategory: "",
  verifiedOnly: false,
  openNowOnly: false,
  pickupDropOnly: false,
  towingOnly: false,
  emergencyOnly: false,
};

export default function GarageFinder({
  policy,
  claimId,
  onSelectGarage,
  onClose,
}: Props) {
  const [garages, setGarages] = useState<CashlessGarage[]>([]);
  const [filters, setFilters] =
    useState<SearchFilters>(initialFilters);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searched, setSearched] = useState(false);

  const [selectedGarageId, setSelectedGarageId] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedGarage = useMemo(
    () =>
      garages.find((garage) => garage.id === selectedGarageId) ??
      null,
    [garages, selectedGarageId]
  );

  useEffect(() => {
    void searchGarages();
  }, [policy.id]);

  async function useCurrentLocation() {
    setLocating(true);
    setMessage("");
    setErrorMessage("");

    if (!navigator.geolocation) {
      setErrorMessage(
        "Location services are not supported by this browser."
      );
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationLabel("Current location");
        setLocating(false);

        void searchGarages(
          position.coords.latitude,
          position.coords.longitude
        );
      },
      (error) => {
        setErrorMessage(
          error.message ||
            "Unable to access your current location."
        );
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }

  async function searchGarages(
    locationLatitude = latitude,
    locationLongitude = longitude
  ) {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const params = new URLSearchParams();

      params.set("insurer", policy.insurance_company);
      params.set("cashlessOnly", "true");
      params.set("limit", "30");
      params.set("radiusKm", filters.radiusKm || "50");

      if (locationLatitude !== null && locationLongitude !== null) {
        params.set("latitude", String(locationLatitude));
        params.set("longitude", String(locationLongitude));
      }

      if (filters.city.trim()) {
        params.set("city", filters.city.trim());
      }

      if (filters.state.trim()) {
        params.set("state", filters.state.trim());
      }

      if (filters.specialization.trim()) {
        params.set(
          "specialization",
          filters.specialization.trim()
        );
      }

      if (filters.serviceCategory.trim()) {
        params.set(
          "serviceCategory",
          filters.serviceCategory.trim()
        );
      }

      if (policy.vehicles?.brand) {
        params.set("brand", policy.vehicles.brand);
      }

      if (policy.vehicles?.vehicle_type) {
        params.set(
          "vehicleType",
          policy.vehicles.vehicle_type
        );
      }

      if (filters.verifiedOnly) {
        params.set("verifiedOnly", "true");
      }

      if (filters.openNowOnly) {
        params.set("openNowOnly", "true");
      }

      if (filters.pickupDropOnly) {
        params.set("pickupDropOnly", "true");
      }

      if (filters.towingOnly) {
        params.set("towingOnly", "true");
      }

      if (filters.emergencyOnly) {
        params.set("emergencyOnly", "true");
      }

      const response = await fetch(
        `/api/insurance/garages/search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to search cashless garages."
        );
      }

      const rows = (result?.garages ?? []) as CashlessGarage[];

      setGarages(rows);
      setSelectedGarageId(rows[0]?.id ?? null);
      setSearched(true);

      if (rows.length === 0) {
        setMessage(
          "No matching cashless garage was found. Try widening the radius or removing filters."
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to search cashless garages."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setFilters(initialFilters);
    setLatitude(null);
    setLongitude(null);
    setLocationLabel("");
    setMessage("");
    setErrorMessage("");

    setTimeout(() => {
      void searchGarages(null, null);
    }, 0);
  }

  function openNavigation(garage: CashlessGarage) {
    if (
      garage.latitude === null ||
      garage.longitude === null
    ) {
      setErrorMessage(
        "Navigation coordinates are unavailable for this garage."
      );
      return;
    }

    const destination =
      `${garage.latitude},${garage.longitude}`;

    const url =
      `https://www.google.com/maps/dir/?api=1&destination=` +
      encodeURIComponent(destination);

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function chooseGarage(garage: CashlessGarage) {
    setSelectedGarageId(garage.id);

    if (onSelectGarage) {
      onSelectGarage(garage);
    }
  }

  return (
    <section className="finder">
      <div className="header">
        <div>
          <p className="eyebrow">MIRA GARAGE FINDER</p>
          <h2>Cashless Garages</h2>
          <p className="description">
            Find insurer-matched garages ranked by distance,
            verification, rating, waiting time and available support.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close garage finder"
          >
            ×
          </button>
        )}
      </div>

      <div className="policy-strip">
        <Summary
          label="Insurer"
          value={policy.insurance_company}
        />

        <Summary
          label="Policy"
          value={policy.policy_number}
        />

        <Summary
          label="Vehicle"
          value={
            policy.vehicles?.vehicle_number ||
            "Not linked"
          }
          subvalue={[
            policy.vehicles?.brand,
            policy.vehicles?.model,
          ]
            .filter(Boolean)
            .join(" ")}
        />

        <Summary
          label="Claim"
          value={claimId ? `#${claimId}` : "Not linked"}
        />
      </div>

      <div className="search-panel">
        <div className="location-row">
          <div>
            <strong>
              {locationLabel || "Location not selected"}
            </strong>
            <p>
              Use your current location for better distance ranking.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void useCurrentLocation()}
            disabled={locating}
          >
            {locating
              ? "Locating..."
              : "Use Current Location"}
          </button>
        </div>

        <div className="filter-grid">
          <label>
            City
            <input
              value={filters.city}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  city: event.target.value,
                })
              }
              placeholder="Bengaluru"
            />
          </label>

          <label>
            State
            <input
              value={filters.state}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  state: event.target.value,
                })
              }
              placeholder="Karnataka"
            />
          </label>

          <label>
            Radius
            <select
              value={filters.radiusKm}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  radiusKm: event.target.value,
                })
              }
            >
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="100">100 km</option>
              <option value="250">250 km</option>
            </select>
          </label>

          <label>
            Specialization
            <input
              value={filters.specialization}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  specialization: event.target.value,
                })
              }
              placeholder="Body Shop, EV, Painting"
            />
          </label>

          <label>
            Service Category
            <input
              value={filters.serviceCategory}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  serviceCategory: event.target.value,
                })
              }
              placeholder="Inspection, Repair"
            />
          </label>
        </div>

        <div className="toggle-grid">
          <Toggle
            label="Verified only"
            checked={filters.verifiedOnly}
            onChange={(checked) =>
              setFilters({
                ...filters,
                verifiedOnly: checked,
              })
            }
          />

          <Toggle
            label="Open now"
            checked={filters.openNowOnly}
            onChange={(checked) =>
              setFilters({
                ...filters,
                openNowOnly: checked,
              })
            }
          />

          <Toggle
            label="Pickup & drop"
            checked={filters.pickupDropOnly}
            onChange={(checked) =>
              setFilters({
                ...filters,
                pickupDropOnly: checked,
              })
            }
          />

          <Toggle
            label="Towing"
            checked={filters.towingOnly}
            onChange={(checked) =>
              setFilters({
                ...filters,
                towingOnly: checked,
              })
            }
          />

          <Toggle
            label="Emergency support"
            checked={filters.emergencyOnly}
            onChange={(checked) =>
              setFilters({
                ...filters,
                emergencyOnly: checked,
              })
            }
          />
        </div>

        <div className="search-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => void searchGarages()}
            disabled={loading}
          >
            {loading
              ? "Searching..."
              : "Search Cashless Garages"}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {message && (
        <div className="info-message">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          Searching insurer-matched garages...
        </div>
      ) : searched && garages.length === 0 ? (
        <div className="empty-state">
          <strong>No garage found.</strong>
          <p>
            Increase the search radius or remove one or more filters.
          </p>
        </div>
      ) : (
        <div className="results-layout">
          <div className="garage-list">
            {garages.map((garage, index) => (
              <article
                className={`garage-card ${
                  selectedGarageId === garage.id
                    ? "selected"
                    : ""
                }`}
                key={garage.id}
                onClick={() =>
                  setSelectedGarageId(garage.id)
                }
              >
                <div className="garage-card-head">
                  <div>
                    <div className="title-row">
                      <h3>{garage.name}</h3>

                      {index === 0 && (
                        <span className="recommended">
                          Mira Recommended
                        </span>
                      )}
                    </div>

                    <p>
                      {garage.address_line1},{" "}
                      {garage.city}, {garage.state}
                    </p>
                  </div>

                  <div className="score-box">
                    <span>Mira Score</span>
                    <strong>{garage.mira_score}</strong>
                  </div>
                </div>

                <div className="quick-metrics">
                  <Metric
                    label="Distance"
                    value={
                      garage.distance_km === null
                        ? "Not available"
                        : `${garage.distance_km} km`
                    }
                  />

                  <Metric
                    label="Rating"
                    value={
                      garage.rating === null
                        ? "Not rated"
                        : `${garage.rating.toFixed(1)} ★`
                    }
                  />

                  <Metric
                    label="Wait Time"
                    value={
                      garage.estimated_wait_minutes === null
                        ? "Not available"
                        : `${garage.estimated_wait_minutes} min`
                    }
                  />

                  <Metric
                    label="Open Status"
                    value={
                      garage.is_open_now === true
                        ? "Open now"
                        : garage.is_open_now === false
                          ? "Closed"
                          : "Unknown"
                    }
                  />
                </div>

                <div className="badges">
                  {garage.is_verified && (
                    <span>Verified</span>
                  )}

                  {garage.insurer_cashless_match && (
                    <span>Insurer Match</span>
                  )}

                  {garage.pickup_drop_available && (
                    <span>Pickup & Drop</span>
                  )}

                  {garage.towing_available && (
                    <span>Towing</span>
                  )}

                  {garage.is_24x7 && (
                    <span>24×7</span>
                  )}
                </div>

                {garage.recommendation_reasons.length >
                  0 && (
                  <ul className="reason-list">
                    {garage.recommendation_reasons.map(
                      (reason) => (
                        <li key={reason}>
                          {reason}
                        </li>
                      )
                    )}
                  </ul>
                )}

                <div className="garage-actions">
                  {garage.phone && (
                    <a
                      href={`tel:${garage.phone}`}
                      className="secondary-button"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >
                      Call Garage
                    </a>
                  )}

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openNavigation(garage);
                    }}
                  >
                    Navigate
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      chooseGarage(garage);
                    }}
                  >
                    Select Garage
                  </button>
                </div>
              </article>
            ))}
          </div>

          {selectedGarage && (
            <aside className="detail-panel">
              <p className="eyebrow">
                GARAGE DETAILS
              </p>

              <h3>{selectedGarage.name}</h3>

              <p className="address">
                {selectedGarage.address_line1}
                {selectedGarage.address_line2
                  ? `, ${selectedGarage.address_line2}`
                  : ""}
                , {selectedGarage.city},{" "}
                {selectedGarage.state}
              </p>

              <div className="detail-grid">
                <Detail
                  label="Phone"
                  value={
                    selectedGarage.phone ||
                    "Not provided"
                  }
                />

                <Detail
                  label="Average Repair"
                  value={
                    selectedGarage.average_repair_days ===
                    null
                      ? "Not available"
                      : `${selectedGarage.average_repair_days} days`
                  }
                />

                <Detail
                  label="Opening Hours"
                  value={
                    selectedGarage.is_24x7
                      ? "24×7"
                      : formatHours(
                          selectedGarage.opening_time,
                          selectedGarage.closing_time
                        )
                  }
                />

                <Detail
                  label="Reviews"
                  value={String(
                    selectedGarage.review_count
                  )}
                />
              </div>

              <div className="detail-section">
                <strong>Specializations</strong>

                <div className="chip-list">
                  {selectedGarage.specializations.length ===
                  0 ? (
                    <span className="muted">
                      Not provided
                    </span>
                  ) : (
                    selectedGarage.specializations.map(
                      (item) => (
                        <span key={item}>
                          {item}
                        </span>
                      )
                    )
                  )}
                </div>
              </div>

              <div className="detail-section">
                <strong>Available Services</strong>

                <div className="service-list">
                  {selectedGarage
                    .cashless_garage_services?.length ? (
                    selectedGarage.cashless_garage_services.map(
                      (service) => (
                        <div
                          className="service-item"
                          key={service.id}
                        >
                          <div>
                            <strong>
                              {service.service_name}
                            </strong>
                            <p>
                              {service.description ||
                                service.service_category}
                            </p>
                          </div>

                          <span>
                            {service.starting_price === null
                              ? "Price on inspection"
                              : formatCurrency(
                                  service.starting_price
                                )}
                          </span>
                        </div>
                      )
                    )
                  ) : (
                    <span className="muted">
                      Service details unavailable
                    </span>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <strong>Insurer Network</strong>

                <div className="chip-list">
                  {selectedGarage
                    .cashless_garage_insurers?.length ? (
                    selectedGarage.cashless_garage_insurers.map(
                      (network) => (
                        <span
                          key={`${network.insurer_name}-${network.network_type}`}
                        >
                          {network.insurer_name}
                        </span>
                      )
                    )
                  ) : (
                    <span className="muted">
                      Network details unavailable
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="primary-button full-button"
                onClick={() =>
                  chooseGarage(selectedGarage)
                }
              >
                Continue with this Garage
              </button>
            </aside>
          )}
        </div>
      )}

      <div className="advisory-note">
        <span>ℹ</span>
        <p>
          Cashless eligibility must be reconfirmed with the insurer and
          garage before repair begins. Ratings, waiting times and repair
          duration depend on partner-supplied data.
        </p>
      </div>

      <style jsx>{`
        .finder {
          width: 100%;
          box-sizing: border-box;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(37, 99, 235, 0.16),
              transparent 30%
            ),
            #07152a;
          color: #f8fafc;
        }

        .header,
        .location-row,
        .garage-card-head,
        .title-row,
        .garage-actions,
        .search-actions {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .header {
          align-items: flex-start;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #60a5fa;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }

        h2,
        h3 {
          margin: 0;
        }

        .description,
        .location-row p,
        .garage-card p,
        .address {
          color: #94a3b8;
        }

        .description,
        .location-row p,
        .garage-card p {
          margin: 7px 0 0;
        }

        .close-button {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.8);
          color: #e2e8f0;
          font-size: 28px;
          cursor: pointer;
        }

        .policy-strip,
        .quick-metrics,
        .detail-grid {
          display: grid;
          gap: 12px;
        }

        .policy-strip,
        .quick-metrics {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .detail-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 16px;
        }

        .search-panel {
          margin-top: 18px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.34);
        }

        .location-row {
          align-items: center;
          margin-bottom: 18px;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        label {
          display: grid;
          gap: 8px;
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 800;
        }

        input,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.56);
          color: #f8fafc;
          padding: 13px 14px;
          font: inherit;
        }

        .toggle-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }

        .search-actions {
          justify-content: flex-start;
          margin-top: 16px;
        }

        .primary-button,
        .secondary-button {
          min-height: 42px;
          padding: 10px 14px;
          border-radius: 12px;
          font: inherit;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .primary-button {
          border: 0;
          background: linear-gradient(
            135deg,
            #2563eb,
            #3b82f6
          );
          color: white;
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.82);
          color: #dbeafe;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .info-message,
        .error-message {
          margin-top: 15px;
          padding: 13px 15px;
          border-radius: 12px;
        }

        .info-message {
          background: rgba(30, 64, 175, 0.12);
          color: #bfdbfe;
        }

        .error-message {
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        .empty-state {
          margin-top: 18px;
          padding: 32px;
          border-radius: 15px;
          background: rgba(2, 6, 23, 0.3);
          color: #94a3b8;
          text-align: center;
        }

        .empty-state strong {
          color: #f8fafc;
        }

        .empty-state p {
          margin: 7px 0 0;
        }

        .results-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.8fr);
          gap: 18px;
          margin-top: 20px;
          align-items: start;
        }

        .garage-list {
          display: grid;
          gap: 14px;
        }

        .garage-card {
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.34);
          cursor: pointer;
        }

        .garage-card.selected {
          border-color: rgba(96, 165, 250, 0.52);
          box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.15);
        }

        .garage-card-head {
          align-items: flex-start;
        }

        .title-row {
          justify-content: flex-start;
          align-items: center;
          flex-wrap: wrap;
        }

        .recommended {
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(20, 83, 45, 0.2);
          color: #a7f3d0;
          font-size: 11px;
          font-weight: 900;
        }

        .score-box {
          min-width: 90px;
          text-align: right;
        }

        .score-box span {
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .score-box strong {
          display: block;
          margin-top: 4px;
          color: #dbeafe;
          font-size: 22px;
        }

        .quick-metrics {
          margin-top: 15px;
        }

        .badges,
        .chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .badges span,
        .chip-list span {
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.14);
          color: #bfdbfe;
          font-size: 11px;
          font-weight: 800;
        }

        .reason-list {
          margin: 14px 0 0;
          padding-left: 20px;
          color: #cbd5e1;
          line-height: 1.55;
        }

        .garage-actions {
          justify-content: flex-start;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .detail-panel {
          position: sticky;
          top: 20px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.46);
        }

        .address {
          margin: 8px 0 0;
          line-height: 1.5;
        }

        .detail-section {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }

        .service-list {
          display: grid;
          gap: 10px;
          margin-top: 10px;
        }

        .service-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          border-radius: 13px;
          background: rgba(15, 23, 42, 0.55);
        }

        .service-item p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
        }

        .service-item > span {
          color: #dbeafe;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .muted {
          color: #64748b;
        }

        .full-button {
          width: 100%;
          margin-top: 20px;
        }

        .advisory-note {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          padding: 13px 15px;
          border-radius: 13px;
          background: rgba(30, 64, 175, 0.08);
          color: #bfdbfe;
        }

        .advisory-note p {
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 1080px) {
          .filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .results-layout {
            grid-template-columns: 1fr;
          }

          .detail-panel {
            position: static;
          }
        }

        @media (max-width: 720px) {
          .finder {
            padding: 18px;
          }

          .header,
          .location-row,
          .garage-card-head,
          .garage-actions,
          .search-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .policy-strip,
          .quick-metrics,
          .filter-grid,
          .detail-grid {
            grid-template-columns: 1fr;
          }

          .primary-button,
          .secondary-button {
            width: 100%;
          }

          .score-box {
            text-align: left;
          }
        }
      `}</style>
    </section>
  );
}

function Summary({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: 15,
        border: "1px solid rgba(148, 163, 184, 0.12)",
        borderRadius: 15,
        background: "rgba(2, 6, 23, 0.34)",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontSize: 11,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <strong style={{ color: "#e2e8f0" }}>
        {value}
      </strong>

      {subvalue && (
        <small style={{ color: "#94a3b8" }}>
          {subvalue}
        </small>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return <Summary label={label} value={value} />;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return <Summary label={label} value={value} />;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        border: "1px solid rgba(148, 163, 184, 0.12)",
        borderRadius: 12,
        background: "rgba(15, 23, 42, 0.55)",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        style={{
          width: "auto",
          accentColor: "#3b82f6",
        }}
      />

      <span>{label}</span>
    </label>
  );
}

function formatCurrency(value: number | null) {
  if (value === null || value < 0) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(
  openingTime: string | null,
  closingTime: string | null
) {
  if (!openingTime || !closingTime) {
    return "Not provided";
  }

  return `${openingTime.slice(0, 5)} – ${closingTime.slice(
    0,
    5
  )}`;
}