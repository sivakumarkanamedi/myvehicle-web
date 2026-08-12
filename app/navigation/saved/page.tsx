"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type SavedPlace = {
  id: number;
  user_id: string;
  label: string;
  category: string;
  address: string | null;
  coordinates: Coordinates;
  place_id: string | null;
  notes: string | null;
  is_favourite: boolean;
  visit_count: number;
  last_visited_at: string | null;
  created_at: string;
  updated_at: string;
};

type SavedPlaceForm = {
  label: string;
  category: string;
  address: string;
  latitude: string;
  longitude: string;
  placeId: string;
  notes: string;
  isFavourite: boolean;
};

const initialForm: SavedPlaceForm = {
  label: "",
  category: "other",
  address: "",
  latitude: "",
  longitude: "",
  placeId: "",
  notes: "",
  isFavourite: false,
};

const categoryOptions: Array<[string, string]> = [
  ["home", "Home"],
  ["office", "Office"],
  ["workshop", "Workshop"],
  ["fuel", "Fuel Station"],
  ["charging", "EV Charging"],
  ["parking", "Parking"],
  ["restaurant", "Restaurant"],
  ["hotel", "Hotel"],
  ["hospital", "Hospital"],
  ["police", "Police"],
  ["family", "Family"],
  ["other", "Other"],
];

export default function SavedPlacesPage() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [form, setForm] = useState<SavedPlaceForm>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [miraQuestion, setMiraQuestion] = useState("");
  const [miraReply, setMiraReply] = useState(
    "I can help find your Home, Office, favourite places, recent destinations and offline-ready locations."
  );
  const [offlinePlaceIds, setOfflinePlaceIds] = useState<number[]>([]);

  useEffect(() => {
    void loadPlaces();
  }, []);

  async function loadPlaces() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const { data, error: placesError } = await supabase
        .from("navigation_saved_places")
        .select("*")
        .eq("user_id", user.id)
        .order("is_favourite", { ascending: false })
        .order("created_at", { ascending: false });

      if (placesError) throw placesError;

      setPlaces((data ?? []) as SavedPlace[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load saved places."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredPlaces = useMemo(() => {
    const term = search.trim().toLowerCase();

    return places.filter((place) => {
      const matchesCategory =
        categoryFilter === "all" ||
        place.category === categoryFilter;

      const haystack = [
        place.label,
        place.category,
        place.address,
        place.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || haystack.includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [places, search, categoryFilter]);

  const favouritePlaces = useMemo(
    () =>
      places.filter(
        (place) => place.is_favourite
      ),
    [places]
  );

  const recentPlaces = useMemo(
    () =>
      [...places]
        .filter(
          (place) =>
            place.last_visited_at
        )
        .sort(
          (first, second) =>
            new Date(
              second.last_visited_at ?? 0
            ).getTime() -
            new Date(
              first.last_visited_at ?? 0
            ).getTime()
        )
        .slice(0, 5),
    [places]
  );

  const homePlace = useMemo(
    () =>
      places.find(
        (place) =>
          place.category === "home"
      ) ?? null,
    [places]
  );

  const officePlace = useMemo(
    () =>
      places.find(
        (place) =>
          place.category === "office"
      ) ?? null,
    [places]
  );

  async function detectCurrentLocation() {
    setLocating(true);
    setError("");
    setMessage("");

    try {
      if (!navigator.geolocation) {
        throw new Error(
          "Geolocation is not supported by this browser."
        );
      }

      const position =
        await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 5000,
              }
            );
          }
        );

      setForm((current) => ({
        ...current,
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
      }));

      setMessage("Current location added.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to detect current location."
      );
    } finally {
      setLocating(false);
    }
  }

  async function savePlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (
      !form.label.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError(
        "Enter a place name and valid latitude and longitude."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const payload = {
        user_id: user.id,
        label: form.label.trim(),
        category: form.category,
        address: form.address.trim() || null,
        coordinates: {
          latitude,
          longitude,
        },
        place_id: form.placeId.trim() || null,
        notes: form.notes.trim() || null,
        is_favourite: form.isFavourite,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from("navigation_saved_places")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", user.id)
          .select("*")
          .single();

        if (updateError) throw updateError;

        setPlaces((current) =>
          current.map((place) =>
            place.id === editingId
              ? (data as SavedPlace)
              : place
          )
        );

        setMessage("Saved place updated.");
      } else {
        const { data, error: insertError } = await supabase
          .from("navigation_saved_places")
          .insert({
            ...payload,
            visit_count: 0,
            created_at: new Date().toISOString(),
          })
          .select("*")
          .single();

        if (insertError) throw insertError;

        setPlaces((current) => [
          data as SavedPlace,
          ...current,
        ]);

        setMessage("Place saved successfully.");
      }

      setForm(initialForm);
      setEditingId(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save place."
      );
    } finally {
      setSaving(false);
    }
  }

  function editPlace(place: SavedPlace) {
    setEditingId(place.id);

    setForm({
      label: place.label,
      category: place.category,
      address: place.address ?? "",
      latitude: String(place.coordinates.latitude),
      longitude: String(place.coordinates.longitude),
      placeId: place.place_id ?? "",
      notes: place.notes ?? "",
      isFavourite: place.is_favourite,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deletePlace(placeId: number) {
    const confirmed = window.confirm(
      "Delete this saved place?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in again.");

      const { error: deleteError } = await supabase
        .from("navigation_saved_places")
        .delete()
        .eq("id", placeId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      setPlaces((current) =>
        current.filter((place) => place.id !== placeId)
      );

      if (editingId === placeId) {
        setEditingId(null);
        setForm(initialForm);
      }

      setMessage("Saved place deleted.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete place."
      );
    }
  }

  async function toggleFavourite(place: SavedPlace) {
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in again.");

      const { data, error: updateError } = await supabase
        .from("navigation_saved_places")
        .update({
          is_favourite: !place.is_favourite,
          updated_at: new Date().toISOString(),
        })
        .eq("id", place.id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      setPlaces((current) =>
        current.map((entry) =>
          entry.id === place.id
            ? (data as SavedPlace)
            : entry
        )
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update favourite."
      );
    }
  }

  async function startNavigation(place: SavedPlace) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const now = new Date().toISOString();

        await supabase
          .from("navigation_saved_places")
          .update({
            visit_count: place.visit_count + 1,
            last_visited_at: now,
            updated_at: now,
          })
          .eq("id", place.id)
          .eq("user_id", user.id);
      }
    } finally {
      const destination =
        `${place.coordinates.latitude},` +
        `${place.coordinates.longitude}`;

      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          destination
        )}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  }

  async function sharePlace(
    place: SavedPlace
  ) {
    const text =
      `${place.label}: ${place.address ?? "Saved location"} ` +
      `https://www.google.com/maps?q=${place.coordinates.latitude},${place.coordinates.longitude}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: place.label,
          text,
        });

        setMessage(
          "Saved place shared successfully."
        );
        return;
      }

      await navigator.clipboard.writeText(
        text
      );

      setMessage(
        "Saved-place link copied to the clipboard."
      );
    } catch {
      setMessage(
        "Sharing was cancelled."
      );
    }
  }

  function toggleOfflinePlace(
    placeId: number
  ) {
    setOfflinePlaceIds(
      (current) =>
        current.includes(placeId)
          ? current.filter(
              (id) => id !== placeId
            )
          : [...current, placeId]
    );

    setMessage(
      offlinePlaceIds.includes(placeId)
        ? "Offline marker removed."
        : "Place marked for offline availability in preview mode."
    );
  }

  function askMira(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const question =
      miraQuestion
        .trim()
        .toLowerCase();

    if (!question) {
      return;
    }

    if (
      question.includes("home")
    ) {
      setMiraReply(
        homePlace
          ? `Your saved Home is ${homePlace.label}${
              homePlace.address
                ? ` at ${homePlace.address}`
                : ""
            }.`
          : "You have not saved a Home location yet."
      );
    } else if (
      question.includes("office") ||
      question.includes("work")
    ) {
      setMiraReply(
        officePlace
          ? `Your saved Office is ${officePlace.label}${
              officePlace.address
                ? ` at ${officePlace.address}`
                : ""
            }.`
          : "You have not saved an Office location yet."
      );
    } else if (
      question.includes("favourite")
    ) {
      setMiraReply(
        favouritePlaces.length
          ? `You have ${favouritePlaces.length} favourite place${
              favouritePlaces.length === 1
                ? ""
                : "s"
            }.`
          : "You do not have any favourite saved places yet."
      );
    } else if (
      question.includes("recent")
    ) {
      setMiraReply(
        recentPlaces.length
          ? `Your most recent saved destination is ${recentPlaces[0].label}.`
          : "No recently visited saved place is available."
      );
    } else if (
      question.includes("offline")
    ) {
      setMiraReply(
        `${offlinePlaceIds.length} saved place${
          offlinePlaceIds.length === 1
            ? " is"
            : "s are"
        } marked for offline availability in this preview.`
      );
    } else {
      setMiraReply(
        `You currently have ${places.length} saved place${
          places.length === 1
            ? ""
            : "s"
        }, including ${favouritePlaces.length} favourite${
          favouritePlaces.length === 1
            ? ""
            : "s"
        }.`
      );
    }

    setMiraQuestion("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
          <p className="mt-4 text-sm text-slate-400">
            Loading Saved Places...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Saved Places
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Save Home, Office, favourite workshops, parking spots and other destinations for faster navigation.
          </p>
        </header>

        {error ? <Alert tone="error" text={error} /> : null}
        {message ? <Alert tone="success" text={message} /> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Saved Places"
            value={String(places.length)}
          />

          <Metric
            label="Favourites"
            value={String(
              favouritePlaces.length
            )}
          />

          <Metric
            label="Recent Destinations"
            value={String(
              recentPlaces.length
            )}
          />

          <Metric
            label="Offline Ready"
            value={String(
              offlinePlaceIds.length
            )}
          />

          <Metric
            label="Home & Office"
            value={`${homePlace ? 1 : 0}/${
              officePlace ? 1 : 0
            }`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <form
            onSubmit={savePlace}
            className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6"
          >
            <div>
              <h2 className="text-xl font-bold">
                {editingId ? "Edit place" : "Add saved place"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Save a name, category and map coordinates.
              </p>
            </div>

            <Field
              label="Place name"
              value={form.label}
              placeholder="For example Home"
              required
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  label: value,
                }))
              }
            />

            <SelectField
              label="Category"
              value={form.category}
              options={categoryOptions}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  category: value,
                }))
              }
            />

            <Field
              label="Address"
              value={form.address}
              placeholder="Optional"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  address: value,
                }))
              }
            />

            <button
              type="button"
              onClick={() => void detectCurrentLocation()}
              disabled={locating}
              className="w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-50"
            >
              {locating
                ? "Detecting..."
                : "Use current location"}
            </button>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Latitude"
                value={form.latitude}
                placeholder="12.9716"
                required
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    latitude: value,
                  }))
                }
              />

              <Field
                label="Longitude"
                value={form.longitude}
                placeholder="77.5946"
                required
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    longitude: value,
                  }))
                }
              />
            </div>

            <Field
              label="Google Place ID"
              value={form.placeId}
              placeholder="Optional"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  placeId: value,
                }))
              }
            />

            <TextAreaField
              label="Notes"
              value={form.notes}
              placeholder="Add useful details."
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  notes: value,
                }))
              }
            />

            <ToggleField
              label="Mark as favourite"
              checked={form.isFavourite}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  isFavourite: value,
                }))
              }
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update place"
                    : "Save place"}
              </button>

              {editingId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                value={search}
                placeholder="Search saved places..."
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
              />

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
              >
                <option value="all">
                  All categories
                </option>

                {categoryOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 space-y-4">
              {filteredPlaces.length ? (
                filteredPlaces.map((place) => (
                  <SavedPlaceCard
                    key={place.id}
                    place={place}
                    onNavigate={() =>
                      void startNavigation(place)
                    }
                    onFavourite={() =>
                      void toggleFavourite(place)
                    }
                    onEdit={() => editPlace(place)}
                    onDelete={() =>
                      void deletePlace(place.id)
                    }
                    onShare={() =>
                      void sharePlace(place)
                    }
                    onOffline={() =>
                      toggleOfflinePlace(
                        place.id
                      )
                    }
                    offlineReady={offlinePlaceIds.includes(
                      place.id
                    )}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                  No saved places found.
                </div>
              )}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-xl font-bold">
              Recent Destinations
            </h2>

            <div className="mt-5 space-y-3">
              {recentPlaces.length ? (
                recentPlaces.map(
                  (place) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() =>
                        void startNavigation(
                          place
                        )
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left transition hover:border-cyan-400/30"
                    >
                      <p className="font-semibold">
                        {place.label}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {place.last_visited_at
                          ? formatDateTime(
                              place.last_visited_at
                            )
                          : "Not visited"}
                      </p>
                    </button>
                  )
                )
              ) : (
                <p className="text-sm text-slate-500">
                  No recent destinations available.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
              Ask Mira Saved Places
            </p>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fuchsia-50/90">
              {miraReply}
            </p>

            <form
              onSubmit={askMira}
              className="mt-4 flex flex-col gap-3 sm:flex-row"
            >
              <input
                value={miraQuestion}
                onChange={(event) =>
                  setMiraQuestion(
                    event.target.value
                  )
                }
                placeholder="Ask about Home, Office, favourites, recent or offline places..."
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none"
              />

              <button
                type="submit"
                disabled={
                  !miraQuestion.trim()
                }
                className="rounded-2xl bg-fuchsia-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                Ask Mira
              </button>
            </form>
          </article>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Integration status:</strong> saved places are connected
          to Supabase. Offline-place selection is currently a UI preview
          until the offline map provider supports stored destination data.
        </section>

        <Link
          href="/navigation"
          className="inline-block pb-4 text-sm font-semibold text-cyan-300 hover:underline"
        >
          ← Back to Navigation
        </Link>
      </div>
    </main>
  );
}

function SavedPlaceCard(props: {
  place: SavedPlace;
  onNavigate: () => void;
  onFavourite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onOffline: () => void;
  offlineReady: boolean;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">
              {props.place.label}
            </h3>

            {props.place.is_favourite ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                Favourite
              </span>
            ) : null}

            {props.offlineReady ? (
              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2.5 py-1 text-xs font-semibold text-blue-200">
                Offline Ready
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {formatLabel(props.place.category)}
          </p>
        </div>

        <button
          type="button"
          onClick={props.onFavourite}
          className="text-xl"
          aria-label="Toggle favourite"
        >
          {props.place.is_favourite ? "★" : "☆"}
        </button>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        {props.place.address || "Address not available"}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Detail
          label="Visits"
          value={String(props.place.visit_count)}
        />

        <Detail
          label="Last visited"
          value={
            props.place.last_visited_at
              ? formatDateTime(
                  props.place.last_visited_at
                )
              : "Never"
          }
        />

        <Detail
          label="Coordinates"
          value={`${props.place.coordinates.latitude.toFixed(
            4
          )}, ${props.place.coordinates.longitude.toFixed(4)}`}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={props.onNavigate}
          className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950"
        >
          Navigate
        </button>

        <button
          type="button"
          onClick={props.onShare}
          className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-3 text-sm font-semibold text-fuchsia-100"
        >
          Share
        </button>

        <button
          type="button"
          onClick={props.onOffline}
          className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-sm font-semibold text-blue-100"
        >
          {props.offlineReady
            ? "Remove Offline"
            : "Save Offline"}
        </button>

        <button
          type="button"
          onClick={props.onEdit}
          className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={props.onDelete}
          className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function Field(props: {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
        {props.required ? " *" : ""}
      </span>

      <input
        type="text"
        value={props.value}
        required={props.required}
        placeholder={props.placeholder}
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-600"
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </span>

      <select
        value={props.value}
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField(props: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </span>

      <textarea
        value={props.value}
        rows={4}
        placeholder={props.placeholder}
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-600"
      />
    </label>
  );
}

function ToggleField(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-300">
        {props.label}
      </span>

      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) =>
          props.onChange(event.target.checked)
        }
        className="h-5 w-5"
      />
    </label>
  );
}

function Metric(props: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-2 text-xl font-bold">
        {props.value}
      </p>
    </article>
  );
}

function Detail(props: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-300">
        {props.value}
      </p>
    </div>
  );
}

function Alert(props: {
  tone: "error" | "success";
  text: string;
}) {
  const classes =
    props.tone === "error"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}
    >
      {props.text}
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}