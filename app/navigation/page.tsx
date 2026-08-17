"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/supabase";


type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  prediction: any;
};

declare global {
  interface Window {
    google?: any;
    __myVehiclePlacesPromise?: Promise<void>;
    __myVehicleGooglePlacesReady?: () => void;
  }
}

function loadGooglePlaces(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Places can only load in the browser.")
    );
  }

  if (
    window.google?.maps?.importLibrary &&
    window.google?.maps?.places
  ) {
    return Promise.resolve();
  }

  if (window.__myVehiclePlacesPromise) {
    return window.__myVehiclePlacesPromise;
  }

  window.__myVehiclePlacesPromise = new Promise<void>(
    (resolve, reject) => {
      const callbackName = "__myVehicleGooglePlacesReady";

      const finish = () => {
        if (
          window.google?.maps?.importLibrary &&
          window.google?.maps?.places
        ) {
          resolve();
          return;
        }

        reject(
          new Error(
            "Google Maps loaded, but the Places library did not become available."
          )
        );
      };

      window[callbackName] = finish;

      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-my-vehicle-google-places="true"]'
      );

      if (existing) {
        // If the script already finished, verify the API immediately.
        if (
          window.google?.maps?.importLibrary &&
          window.google?.maps?.places
        ) {
          finish();
          return;
        }

        existing.addEventListener(
          "error",
          () => reject(new Error("Google Places failed to load.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.dataset.myVehicleGooglePlaces = "true";

      const params = new URLSearchParams({
        key: apiKey,
        v: "weekly",
        libraries: "places,geometry",
        callback: callbackName,
        language: "en",
        region: "IN",
      });

      script.src =
        `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

      script.onerror = () => {
        window.__myVehiclePlacesPromise = undefined;
        reject(new Error("Google Places failed to load."));
      };

      document.head.appendChild(script);
    }
  );

  return window.__myVehiclePlacesPromise;
}

type Coordinates = {
  latitude: number;
  longitude: number;
};

type RouteOption = {
  route_index: number;
  route_type: "default" | "alternative";
  distance_km: number;
  traffic_duration_minutes: number;
  normal_duration_minutes: number;
  traffic_delay_minutes: number;
  estimated_arrival_time: string;
  encoded_polyline: string | null;
  congestion: {
    normal_segments: number;
    slow_segments: number;
    traffic_jam_segments: number;
    overall_level: "light" | "moderate" | "heavy" | "severe";
  };
  description: string | null;
};

type TrafficPredictionResponse = {
  success?: boolean;
  analysis_time?: string;
  departure_time?: string;
  route_count?: number;
  routes?: RouteOption[];
  recommendation?: {
    should_reroute: boolean;
    urgency: "none" | "suggestion" | "strong";
    recommended_route_index: number;
    current_route_index: number;
    time_saved_minutes: number;
    distance_difference_km: number;
    reason: string;
    mira_message: string;
    actions: Array<
      "take_faster_route" | "show_comparison" | "stay_on_current_route"
    >;
  };
  disclaimer?: string;
  error?: string;
};

type NavigationForm = {
  destinationName: string;
  destinationLatitude: string;
  destinationLongitude: string;
  departureTime: string;
  vehicleType: "car" | "two_wheeler";
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  allowNarrowShortcuts: boolean;
};

const initialForm: NavigationForm = {
  destinationName: "",
  destinationLatitude: "",
  destinationLongitude: "",
  departureTime: "",
  vehicleType: "car",
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: false,
  allowNarrowShortcuts: false,
};

const nearbyServices = [
  {
    title: "Petrol Pumps",
    subtitle: "Find fuel stations near your route",
    query: "petrol pump",
  },
  {
    title: "EV Charging",
    subtitle: "Locate nearby charging stations",
    query: "ev charging station",
  },
  {
    title: "Mechanics",
    subtitle: "Find nearby mechanics and workshops",
    query: "mechanic",
  },
  {
    title: "Parking",
    subtitle: "Find parking near your destination",
    query: "parking",
  },
  {
    title: "Hospitals",
    subtitle: "Locate hospitals on your route",
    query: "hospital",
  },
  {
    title: "Police Stations",
    subtitle: "Find the nearest police station",
    query: "police station",
  },
];


type NavigationStatus = "idle" | "active" | "paused" | "completed";
type VoiceLanguage = {
  code: string;
  label: string;
};

type SosMode = "normal" | "silent";

type SosState =
  | "idle"
  | "countdown"
  | "sending"
  | "sent"
  | "cancelled";

const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi" },
  { code: "kn-IN", label: "Kannada" },
  { code: "te-IN", label: "Telugu" },
  { code: "ta-IN", label: "Tamil" },
];


function distanceBetweenMetres(
  first: Coordinates,
  second: Coordinates
) {
  const earthRadiusMetres = 6371000;
  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const latitudeDelta = toRadians(
    second.latitude - first.latitude
  );
  const longitudeDelta = toRadians(
    second.longitude - first.longitude
  );

  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    earthRadiusMetres *
    2 *
    Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  );
}

function formatRemainingDistance(metres: number | null) {
  if (metres === null) return "Not available";

  if (metres < 1000) {
    return `${Math.max(0, Math.round(metres))} m`;
  }

  return `${(metres / 1000).toFixed(1)} km`;
}

export default function MiraNavigationPage() {
  const [form, setForm] = useState<NavigationForm>(initialForm);
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] =
    useState<TrafficPredictionResponse | null>(null);

  const [placeSuggestions, setPlaceSuggestions] =
    useState<PlaceSuggestion[]>([]);
  const [placesReady, setPlacesReady] = useState(false);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const [locationIssue, setLocationIssue] = useState("");
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  const [activeVehicleLabel, setActiveVehicleLabel] = useState("Auto vehicle");
  const autocompleteSessionRef = useRef<any>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const routePolylinesRef = useRef<any[]>([]);
  const originMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);

  const [selectedRouteIndex, setSelectedRouteIndex] =
    useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const trafficTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);
  const currentLocationRef = useRef<Coordinates | null>(null);
  const destinationRef = useRef<Coordinates | null>(null);
  const stoppedSinceRef = useRef<number | null>(null);

  const [navigationStatus, setNavigationStatus] =
    useState<NavigationStatus>("idle");
  const [currentLocation, setCurrentLocation] =
    useState<Coordinates | null>(null);
  const [speedKph, setSpeedKph] = useState(0);
  const [distanceRemainingMetres, setDistanceRemainingMetres] =
    useState<number | null>(null);
  const [stoppedSince, setStoppedSince] =
    useState<number | null>(null);
  const [lastTrafficRefresh, setLastTrafficRefresh] =
    useState<string | null>(null);
  const [miraNavigationMessage, setMiraNavigationMessage] =
    useState(
      "Choose a route and start navigation. Mira will monitor your journey."
    );
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState("en-IN");
  const [lastSpokenMessage, setLastSpokenMessage] = useState("");
  const lastSpokenAtRef = useRef(0);

  const [sosState, setSosState] = useState<SosState>("idle");
  const [sosMode, setSosMode] = useState<SosMode>("normal");
  const [sosCountdown, setSosCountdown] = useState(5);
  const [sosMessage, setSosMessage] = useState("");
  const sosTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const googleMapsApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";

  const destinationCoordinates = useMemo(() => {
    const latitudeText = form.destinationLatitude.trim();
    const longitudeText = form.destinationLongitude.trim();

    if (!latitudeText || !longitudeText) {
      return null;
    }

    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);

    const valid =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;

    return valid
      ? {
          latitude,
          longitude,
        }
      : null;
  }, [
    form.destinationLatitude,
    form.destinationLongitude,
  ]);

  useEffect(() => {
    destinationRef.current = destinationCoordinates;
  }, [destinationCoordinates]);

  useEffect(() => {
    return () => {
      stopLiveTracking();
      stopVoice();

      if (sosTimerRef.current) {
        clearInterval(sosTimerRef.current);
        sosTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void detectCurrentLocation(true);
    void loadActiveVehicleType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const destinationName =
      params.get("destination")?.trim() ||
      params.get("name")?.trim() ||
      "";
    const latitudeText = params.get("lat")?.trim() || "";
    const longitudeText = params.get("lng")?.trim() || "";

    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);

    const hasValidCoordinates =
      latitudeText.length > 0 &&
      longitudeText.length > 0 &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;

    if (!destinationName && !hasValidCoordinates) return;

    setForm((current) => ({
      ...current,
      destinationName:
        destinationName || current.destinationName || "Destination",
      destinationLatitude: hasValidCoordinates
        ? latitude.toFixed(6)
        : current.destinationLatitude,
      destinationLongitude: hasValidCoordinates
        ? longitude.toFixed(6)
        : current.destinationLongitude,
    }));

    setPlaceSuggestions([]);
    setShowSuggestions(false);
    setResult(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialisePlaces() {
      if (!googleMapsApiKey) {
        setPlacesError(
          "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local to enable destination search."
        );
        return;
      }

      try {
        await loadGooglePlaces(googleMapsApiKey);

        if (cancelled) return;

        if (!window.google?.maps?.importLibrary) {
          throw new Error(
            "Google Maps importLibrary is unavailable after loading."
          );
        }

        const { AutocompleteSessionToken } =
          await window.google.maps.importLibrary("places");

        autocompleteSessionRef.current =
          new AutocompleteSessionToken();

        setPlacesReady(true);
        setPlacesError("");
      } catch (caughtError) {
        if (cancelled) return;

        setPlacesError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to start destination search."
        );
      }
    }

    void initialisePlaces();

    return () => {
      cancelled = true;

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [googleMapsApiKey]);

  async function fetchPlaceSuggestions(value: string) {
    const query = value.trim();

    if (!placesReady || query.length < 2) {
      setPlaceSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearchingPlaces(true);
    setPlacesError("");

    try {
      if (!window.google?.maps?.importLibrary) {
        throw new Error("Google Places search is not ready.");
      }

      const { AutocompleteSuggestion } =
        await window.google.maps.importLibrary("places");

      const request: Record<string, unknown> = {
        input: query,
        sessionToken: autocompleteSessionRef.current,
        includedRegionCodes: ["in"],
        language: "en-IN",
        region: "IN",
      };

      if (origin) {
        request.origin = {
          lat: origin.latitude,
          lng: origin.longitude,
        };

        request.locationBias = {
          center: {
            lat: origin.latitude,
            lng: origin.longitude,
          },
          radius: 50000,
        };
      }

      const { suggestions } =
        await AutocompleteSuggestion.fetchAutocompleteSuggestions(
          request
        );

      const normalized = (suggestions || [])
        .map((suggestion: any) => {
          const prediction = suggestion.placePrediction;

          if (!prediction) return null;

          return {
            placeId: prediction.placeId,
            mainText:
              prediction.mainText?.text ||
              prediction.text?.text ||
              "Place",
            secondaryText:
              prediction.secondaryText?.text || "",
            fullText:
              prediction.text?.text ||
              prediction.mainText?.text ||
              "Place",
            prediction,
          } satisfies PlaceSuggestion;
        })
        .filter(Boolean) as PlaceSuggestion[];

      setPlaceSuggestions(normalized);
      setShowSuggestions(normalized.length > 0);
    } catch (caughtError) {
      setPlaceSuggestions([]);
      setShowSuggestions(false);
      setPlacesError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to search destinations."
      );
    } finally {
      setSearchingPlaces(false);
    }
  }

  function handleDestinationNameChange(value: string) {
    if (
      navigationStatus === "active" ||
      navigationStatus === "paused"
    ) {
      stopLiveTracking();
      setNavigationStatus("idle");
      setSpeedKph(0);
      setDistanceRemainingMetres(null);
    }

    updateField("destinationName", value);
    updateField("destinationLatitude", "");
    updateField("destinationLongitude", "");
    setResult(null);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      void fetchPlaceSuggestions(value);
    }, 250);
  }

  function scrollToRouteMap() {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        mapSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    });
  }

  async function selectPlaceSuggestion(
    suggestion: PlaceSuggestion
  ) {
    setSearchingPlaces(true);
    setPlacesError("");

    try {
      const place = suggestion.prediction.toPlace();

      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "location"],
      });

      const latitude = place.location?.lat();
      const longitude = place.location?.lng();

      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        throw new Error(
          "The selected place did not provide coordinates."
        );
      }

      updateField(
        "destinationName",
        place.formattedAddress ||
          place.displayName ||
          suggestion.fullText
      );
      updateField(
        "destinationLatitude",
        latitude.toFixed(6)
      );
      updateField(
        "destinationLongitude",
        longitude.toFixed(6)
      );

      setPlaceSuggestions([]);
      setShowSuggestions(false);

      const { AutocompleteSessionToken } =
        await window.google.maps.importLibrary("places");

      autocompleteSessionRef.current =
        new AutocompleteSessionToken();

      if (origin) {
        await runTrafficAnalysis({ latitude, longitude });
      }
    } catch (caughtError) {
      setPlacesError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to use the selected destination."
      );
    } finally {
      setSearchingPlaces(false);
    }
  }

  useEffect(() => {
    if (
      !placesReady ||
      !mapElementRef.current ||
      !window.google?.maps ||
      mapRef.current
    ) {
      return;
    }

    const initialCenter = origin
      ? {
          lat: origin.latitude,
          lng: origin.longitude,
        }
      : {
          lat: 12.9716,
          lng: 77.5946,
        };

    mapRef.current = new window.google.maps.Map(
      mapElementRef.current,
      {
        center: initialCenter,
        zoom: origin ? 14 : 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        styles: [
          {
            elementType: "geometry",
            stylers: [{ color: "#0f172a" }],
          },
          {
            elementType: "labels.text.fill",
            stylers: [{ color: "#cbd5e1" }],
          },
          {
            elementType: "labels.text.stroke",
            stylers: [{ color: "#020617" }],
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#334155" }],
          },
          {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ color: "#475569" }],
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#082f49" }],
          },
        ],
      }
    );

    setMapReady(true);
  }, [origin, placesReady]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    if (origin) {
      const originPosition = {
        lat: origin.latitude,
        lng: origin.longitude,
      };

      originMarkerRef.current?.setMap(null);
      originMarkerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: originPosition,
        title: "Current location",
        label: {
          text: "●",
          color: "#ffffff",
          fontSize: "18px",
        },
      });

      if (!result?.routes?.length) {
        mapRef.current.panTo(originPosition);
        mapRef.current.setZoom(14);
      }
    }

    if (destinationCoordinates) {
      const destinationPosition = {
        lat: destinationCoordinates.latitude,
        lng: destinationCoordinates.longitude,
      };

      destinationMarkerRef.current?.setMap(null);
      destinationMarkerRef.current =
        new window.google.maps.Marker({
          map: mapRef.current,
          position: destinationPosition,
          title:
            form.destinationName || "Destination",
        });
    }
  }, [
    destinationCoordinates,
    form.destinationName,
    origin,
  ]);

  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      !window.google?.maps ||
      !result?.routes?.length
    ) {
      return;
    }

    routePolylinesRef.current.forEach((polyline) =>
      polyline.setMap(null)
    );
    routePolylinesRef.current = [];

    const availableRoutes = result.routes.filter(
      (route) => route.encoded_polyline
    );

    if (availableRoutes.length === 0) return;

    const recommendedIndex =
      result.recommendation?.recommended_route_index ??
      availableRoutes[0].route_index;

    const activeRouteIndex =
      selectedRouteIndex ?? recommendedIndex;

    if (selectedRouteIndex === null) {
      setSelectedRouteIndex(activeRouteIndex);
    }

    const bounds = new window.google.maps.LatLngBounds();

    availableRoutes.forEach((route) => {
      const path =
        window.google.maps.geometry.encoding.decodePath(
          route.encoded_polyline
        );

      path.forEach((point: any) => bounds.extend(point));

      const active = route.route_index === activeRouteIndex;
      const recommended =
        route.route_index === recommendedIndex;

      const polyline = new window.google.maps.Polyline({
        map: mapRef.current,
        path,
        clickable: true,
        strokeColor: active
          ? "#3b82f6"
          : recommended
            ? "#22d3ee"
            : "#64748b",
        strokeOpacity: active ? 1 : 0.65,
        strokeWeight: active ? 7 : 4,
        zIndex: active ? 10 : recommended ? 5 : 1,
      });

      polyline.addListener("click", () => {
        setSelectedRouteIndex(route.route_index);
      });

      routePolylinesRef.current.push(polyline);
    });

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 70);
    }
  }, [mapReady, result, selectedRouteIndex]);


  const canSubmit =
    origin !== null && destinationCoordinates !== null;

  async function detectCurrentLocation(silent = false) {
    setLocating(true);
    setLocationIssue("");

    try {
      if (!navigator.geolocation) {
        throw new Error(
          "Geolocation is not supported by this browser."
        );
      }

      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 30000,
            }
          );
        }
      );

      const nextOrigin = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setOrigin(nextOrigin);
      currentLocationRef.current = nextOrigin;
      setCurrentLocation(nextOrigin);
      setLocationIssue("");
    } catch (caughtError) {
      const geoError =
        typeof GeolocationPositionError !== "undefined" &&
        caughtError instanceof GeolocationPositionError
          ? caughtError
          : null;

      const denied =
        geoError?.code === geoError?.PERMISSION_DENIED ||
        (caughtError instanceof Error &&
          /permission|denied/i.test(caughtError.message));

      setLocationIssue(
        denied
          ? "Location access is off. Enable location permission to use live navigation."
          : "Current location could not be detected. Tap Retry Location."
      );

      if (!silent && !denied) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to detect current location."
        );
      }
    } finally {
      setLocating(false);
    }
  }

  async function loadActiveVehicleType() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const storedId =
        typeof window !== "undefined"
          ? window.localStorage.getItem("myvehicle.activeVehicleId")
          : null;

      let query = supabase
        .from("vehicles")
        .select("id, vehicle_number, vehicle_type")
        .eq("user_id", user.id);

      if (storedId) {
        query = query.eq("id", Number(storedId));
      } else {
        query = query.order("id", { ascending: true }).limit(1);
      }

      const { data, error: vehicleError } = await query.maybeSingle();

      if (vehicleError || !data) return;

      const rawType = String(data.vehicle_type || "").toLowerCase();
      const navigationType: NavigationForm["vehicleType"] =
        /bike|motorcycle|scooter|two.?wheeler/.test(rawType)
          ? "two_wheeler"
          : "car";

      updateField("vehicleType", navigationType);
      setActiveVehicleLabel(
        `${data.vehicle_number || "Active vehicle"} · ${
          navigationType === "two_wheeler" ? "Two Wheeler" : "Car"
        }`
      );
    } catch {
      // Navigation can safely continue with the default car profile.
    }
  }

  async function shareDestination() {
    if (!destinationCoordinates) return;

    const shareUrl =
      `https://www.google.com/maps/search/?api=1&query=` +
      encodeURIComponent(
        `${destinationCoordinates.latitude},${destinationCoordinates.longitude}`
      );

    const shareData = {
      title: form.destinationName || "My Vehicle destination",
      text: form.destinationName || "Navigation destination",
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setMiraNavigationMessage("Destination link copied.");
      }
    } catch {
      // User may dismiss the native share sheet; no error is necessary.
    }
  }

  function saveDestination() {
    if (!destinationCoordinates || typeof window === "undefined") return;

    const saved = JSON.parse(
      window.localStorage.getItem("myvehicle.savedDestinations") || "[]"
    );

    const next = [
      {
        name: form.destinationName || "Saved destination",
        latitude: destinationCoordinates.latitude,
        longitude: destinationCoordinates.longitude,
        savedAt: new Date().toISOString(),
      },
      ...saved.filter(
        (item: any) => item?.name !== form.destinationName
      ),
    ].slice(0, 20);

    window.localStorage.setItem(
      "myvehicle.savedDestinations",
      JSON.stringify(next)
    );
    setMiraNavigationMessage("Destination saved.");
  }

  async function runTrafficAnalysis(
    destinationOverride?: Coordinates
  ) {
    const destination =
      destinationOverride ?? destinationCoordinates;

    if (!origin || !destination || loading) {
      setError(
        "Use your current location and select a destination before analysing the route."
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        throw new Error(
          "Please sign in again before using Mira Navigation."
        );
      }

      const response = await fetch(
        "/api/navigation/traffic/predict",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            origin,
            destination,
            planned_departure_time:
              form.departureTime || null,
            avoid_tolls: form.avoidTolls,
            avoid_highways: form.avoidHighways,
            avoid_ferries: form.avoidFerries,
            vehicle_type: form.vehicleType,
            allow_narrow_shortcuts:
              form.allowNarrowShortcuts,
            minimum_time_saving_minutes: 5,
            strong_warning_minutes: 10,
            language_code: "en-IN",
          }),
        }
      );

      const data =
        (await response.json()) as TrafficPredictionResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to analyse traffic routes."
        );
      }

      setResult(data);
      setSelectedRouteIndex(
        data.recommendation?.recommended_route_index ??
          data.routes?.[0]?.route_index ??
          null
      );
      scrollToRouteMap();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to analyse traffic routes."
      );
    } finally {
      setLoading(false);
    }
  }

  async function analyseTraffic(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    await runTrafficAnalysis();
  }

  function speakNavigationMessage(
    message: string,
    force = false
  ) {
    if (
      !voiceEnabled ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !message.trim()
    ) {
      return;
    }

    const now = Date.now();

    if (!force && now - lastSpokenAtRef.current < 8000) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = voiceLanguage;
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);

    lastSpokenAtRef.current = now;
    setLastSpokenMessage(message);
  }

  function repeatLastInstruction() {
    if (!lastSpokenMessage.trim()) {
      setMiraNavigationMessage(
        "There is no previous voice instruction to repeat."
      );
      return;
    }

    speakNavigationMessage(lastSpokenMessage, true);
  }

  function stopVoice() {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }
  }

  function getEmergencyLocation() {
    return (
      currentLocationRef.current ||
      currentLocation ||
      origin ||
      null
    );
  }

  function openEmergencySearch(query: string) {
    const location = getEmergencyLocation();
    const destination = location
      ? `${location.latitude},${location.longitude}`
      : form.destinationName.trim();

    const searchValue = destination
      ? `${query} near ${destination}`
      : query;

    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        searchValue
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function cancelSos() {
    if (sosTimerRef.current) {
      clearInterval(sosTimerRef.current);
      sosTimerRef.current = null;
    }

    setSosState("cancelled");
    setSosCountdown(5);
    setSosMessage("SOS cancelled. Navigation can continue.");

    if (sosMode === "normal") {
      speakNavigationMessage("SOS cancelled.", true);
    }

    window.setTimeout(() => {
      setSosState("idle");
      setSosMessage("");
    }, 1800);
  }

  async function sendSosAlert() {
    const location = getEmergencyLocation();

    setSosState("sending");
    setSosMessage("Preparing emergency details…");

    try {
      const payload = {
        mode: sosMode,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        destination: form.destinationName || null,
        navigation_status: navigationStatus,
        speed_kph: Math.round(speedKph),
        created_at: new Date().toISOString(),
      };

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        await fetch("/api/sos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        }).catch(() => null);
      }

      setSosState("sent");
      setSosMessage(
        location
          ? `SOS prepared with live coordinates ${location.latitude.toFixed(
              5
            )}, ${location.longitude.toFixed(5)}.`
          : "SOS prepared. Live coordinates were unavailable."
      );

      if (sosMode === "normal") {
        speakNavigationMessage(
          "SOS activated. Emergency assistance options are ready.",
          true
        );
      }
    } catch (caughtError) {
      setSosState("idle");
      setSosMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to prepare SOS."
      );
    }
  }

  function startSosCountdown() {
    if (sosState === "countdown" || sosState === "sending") {
      return;
    }

    setSosState("countdown");
    setSosCountdown(5);
    setSosMessage(
      sosMode === "silent"
        ? "Silent SOS will activate in 5 seconds."
        : "SOS will activate in 5 seconds."
    );

    if (sosMode === "normal") {
      speakNavigationMessage(
        "Emergency SOS will activate in five seconds. Tap cancel to stop.",
        true
      );
    }

    let remaining = 5;

    sosTimerRef.current = setInterval(() => {
      remaining -= 1;
      setSosCountdown(remaining);

      if (remaining <= 0) {
        if (sosTimerRef.current) {
          clearInterval(sosTimerRef.current);
          sosTimerRef.current = null;
        }

        void sendSosAlert();
      }
    }, 1000);
  }

  async function refreshTrafficDuringNavigation(
    liveOrigin: Coordinates,
    target: Coordinates
  ) {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.access_token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch(
        "/api/navigation/traffic/predict",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            origin: liveOrigin,
            destination: target,
            planned_departure_time: null,
            avoid_tolls: form.avoidTolls,
            avoid_highways: form.avoidHighways,
            avoid_ferries: form.avoidFerries,
            vehicle_type: form.vehicleType,
            allow_narrow_shortcuts:
              form.allowNarrowShortcuts,
            minimum_time_saving_minutes: 5,
            strong_warning_minutes: 10,
            language_code: "en-IN",
          }),
        }
      );

      const data =
        (await response.json()) as TrafficPredictionResponse;

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to refresh traffic."
        );
      }

      setResult(data);
      setLastTrafficRefresh(new Date().toISOString());

      const recommendedRouteIndex =
        data.recommendation?.recommended_route_index ??
        data.routes?.[0]?.route_index ??
        null;

      if (recommendedRouteIndex !== null) {
        setSelectedRouteIndex(recommendedRouteIndex);
      }

      if (data.recommendation?.should_reroute) {
        const rerouteMessage =
          data.recommendation.mira_message ||
          "A faster route is available.";

        setMiraNavigationMessage(rerouteMessage);
        speakNavigationMessage(rerouteMessage);
      } else {
        setMiraNavigationMessage(
          "Your selected route remains suitable. Mira will keep monitoring traffic."
        );
      }
    } catch (caughtError) {
      setMiraNavigationMessage(
        caughtError instanceof Error
          ? `Traffic refresh failed: ${caughtError.message}`
          : "Traffic could not be refreshed."
      );
    }
  }

  function stopLiveTracking() {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (trafficTimerRef.current) {
      clearInterval(trafficTimerRef.current);
      trafficTimerRef.current = null;
    }
  }

  function beginLiveTracking() {
    if (!navigator.geolocation) {
      setError(
        "Geolocation is not supported by this browser."
      );
      return;
    }

    stopLiveTracking();

    watchIdRef.current =
      navigator.geolocation.watchPosition(
        (position) => {
          const liveLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          const liveSpeed =
            typeof position.coords.speed === "number" &&
            Number.isFinite(position.coords.speed)
              ? Math.max(0, position.coords.speed * 3.6)
              : 0;

          currentLocationRef.current = liveLocation;
          setCurrentLocation(liveLocation);
          setOrigin(liveLocation);
          setSpeedKph(liveSpeed);

          if (liveSpeed < 2) {
            const stoppedAt =
              stoppedSinceRef.current ?? Date.now();

            stoppedSinceRef.current = stoppedAt;
            setStoppedSince(stoppedAt);
          } else {
            stoppedSinceRef.current = null;
            setStoppedSince(null);
          }

          const target = destinationRef.current;

          if (target) {
            const remaining =
              distanceBetweenMetres(liveLocation, target);

            setDistanceRemainingMetres(remaining);

            if (remaining <= 75) {
              stopLiveTracking();
              setNavigationStatus("completed");
              setSpeedKph(0);
              const arrivalMessage = `You have arrived near ${
                form.destinationName || "your destination"
              }.`;

              setMiraNavigationMessage(arrivalMessage);
              speakNavigationMessage(arrivalMessage, true);
            }
          }

          if (mapRef.current) {
            const positionOnMap = {
              lat: liveLocation.latitude,
              lng: liveLocation.longitude,
            };

            originMarkerRef.current?.setPosition(
              positionOnMap
            );
            mapRef.current.panTo(positionOnMap);
          }
        },
        (geoError) => {
          setError(
            geoError.code === geoError.PERMISSION_DENIED
              ? "Location permission was denied."
              : geoError.message ||
                  "Live location could not be updated."
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 3000,
        }
      );

    trafficTimerRef.current = setInterval(() => {
      const liveOrigin = currentLocationRef.current;
      const target = destinationRef.current;

      if (
        liveOrigin &&
        target &&
        navigationStatus !== "completed"
      ) {
        void refreshTrafficDuringNavigation(
          liveOrigin,
          target
        );
      }
    }, 120000);
  }

  function buildLiveNavigationHref() {
    if (!destinationCoordinates) {
      return "/navigation/live";
    }

    const routeIndex =
      selectedRouteIndex ??
      result?.recommendation?.recommended_route_index ??
      result?.routes?.[0]?.route_index ??
      0;

    const params = new URLSearchParams({
      name: form.destinationName || "Destination",
      address: form.destinationName || "Destination",
      lat: String(destinationCoordinates.latitude),
      lng: String(destinationCoordinates.longitude),
      route: String(routeIndex),
    });

    return `/navigation/live?${params.toString()}`;
  }

  async function startLiveNavigation() {
    if (!destinationCoordinates) {
      setError("Select a destination first.");
      return;
    }

    setError("");
    window.location.assign(buildLiveNavigationHref());
  }

  function pauseOrResumeNavigation() {
    if (navigationStatus === "paused") {
      setNavigationStatus("active");
      setMiraNavigationMessage("Navigation resumed.");
      speakNavigationMessage("Navigation resumed.", true);
      beginLiveTracking();
      return;
    }

    stopLiveTracking();
    setNavigationStatus("paused");
    setSpeedKph(0);
    setMiraNavigationMessage("Navigation paused.");
    speakNavigationMessage("Navigation paused.", true);
  }

  function endLiveNavigation() {
    stopLiveTracking();
    stopVoice();
    setNavigationStatus("completed");
    setSpeedKph(0);
    setMiraNavigationMessage("Navigation ended.");
    speakNavigationMessage("Navigation ended.", true);
  }

  function updateField<K extends keyof NavigationForm>(
    field: K,
    value: NavigationForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openExternalNavigation() {
    if (!origin || !destinationCoordinates) {
      setError(
        "Current location and valid destination coordinates are required."
      );
      return;
    }

    const destinationLabel = form.destinationName.trim();

    const routeUrl = new URL(
      "https://www.google.com/maps/dir/"
    );

    routeUrl.searchParams.set(
      "api",
      "1"
    );
    routeUrl.searchParams.set(
      "origin",
      `${origin.latitude},${origin.longitude}`
    );
    routeUrl.searchParams.set(
      "destination",
      destinationLabel ||
        `${destinationCoordinates.latitude},${destinationCoordinates.longitude}`
    );
    routeUrl.searchParams.set(
      "travelmode",
      form.vehicleType === "two_wheeler"
        ? "driving"
        : "driving"
    );

    if (form.avoidTolls) {
      routeUrl.searchParams.set("avoid", "tolls");
    }

    window.open(
      routeUrl.toString(),
      "_blank",
      "noopener,noreferrer"
    );
  }

  function openNearbySearch(query: string) {
    const destination =
      form.destinationLatitude &&
      form.destinationLongitude
        ? `${form.destinationLatitude},${form.destinationLongitude}`
        : origin
          ? `${origin.latitude},${origin.longitude}`
          : "";

    const searchUrl =
      "https://www.google.com/maps/search/" +
      encodeURIComponent(
        destination
          ? `${query} near ${destination}`
          : query
      );

    window.open(searchUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            My Vehicle
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Mira Smart Navigation
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Compare live traffic-aware routes, detect congestion
            ahead and let Mira recommend a faster alternate route
            before you reach the delay.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl">
          <form
            onSubmit={analyseTraffic}
            className="border-b border-white/10 p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
              <div className="relative min-w-0 flex-1">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    🔎
                  </span>
                  <input
                    value={form.destinationName}
                    placeholder="Where do you want to go?"
                    autoComplete="off"
                    onFocus={() =>
                      setShowSuggestions(placeSuggestions.length > 0)
                    }
                    onBlur={() => {
                      window.setTimeout(
                        () => setShowSuggestions(false),
                        180
                      );
                    }}
                    onChange={(event) =>
                      handleDestinationNameChange(event.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 py-4 pl-11 pr-24 text-base font-semibold outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
                  />

                  {searchingPlaces ? (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-cyan-300">
                      Searching…
                    </span>
                  ) : null}
                </div>

                {showSuggestions ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
                    {placeSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.placeId}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() =>
                          void selectPlaceSuggestion(suggestion)
                        }
                        className="block w-full rounded-xl px-4 py-3 text-left transition hover:bg-white/[0.06]"
                      >
                        <span className="block text-sm font-bold text-white">
                          {suggestion.mainText}
                        </span>
                        {suggestion.secondaryText ? (
                          <span className="mt-1 block text-xs text-slate-500">
                            {suggestion.secondaryText}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}

                {placesError ? (
                  <p className="mt-2 text-xs leading-5 text-amber-300">
                    {placesError}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs font-semibold text-slate-300">
                  🚘 {activeVehicleLabel}
                </span>

                {locationIssue ? (
                  <button
                    type="button"
                    onClick={() => void detectCurrentLocation(false)}
                    disabled={locating}
                    className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs font-bold text-amber-200"
                  >
                    {locating ? "Detecting…" : "Retry Location"}
                  </button>
                ) : null}
              </div>
            </div>

            {locationIssue ? (
              <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                {locationIssue}
              </p>
            ) : null}

            {destinationCoordinates ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                >
                  {loading ? "Finding routes…" : "Directions"}
                </button>

                {origin ? (
                  <Link
                    href={buildLiveNavigationHref()}
                    className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
                  >
                    Start
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white opacity-50"
                  >
                    Start
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void shareDestination()}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-slate-200"
                >
                  Share
                </button>

                <button
                  type="button"
                  onClick={saveDestination}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-slate-200"
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => setShowRouteOptions((current) => !current)}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-slate-200"
                >
                  More
                </button>
              </div>
            ) : null}

            {showRouteOptions ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Route options
                </span>
                <CompactToggle
                  label="Avoid tolls"
                  checked={form.avoidTolls}
                  onChange={(value) => updateField("avoidTolls", value)}
                />
                <CompactToggle
                  label="Avoid highways"
                  checked={form.avoidHighways}
                  onChange={(value) => updateField("avoidHighways", value)}
                />
                <CompactToggle
                  label="Avoid ferries"
                  checked={form.avoidFerries}
                  onChange={(value) => updateField("avoidFerries", value)}
                />
                <CompactToggle
                  label="Narrow shortcuts"
                  checked={form.allowNarrowShortcuts}
                  onChange={(value) =>
                    updateField("allowNarrowShortcuts", value)
                  }
                />
                <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300">
                  <span>Leave at</span>
                  <input
                    type="datetime-local"
                    value={form.departureTime}
                    onChange={(event) =>
                      updateField("departureTime", event.target.value)
                    }
                    className="max-w-[170px] bg-transparent text-xs text-white outline-none"
                  />
                </label>
              </div>
            ) : null}
          </form>

          <section
            ref={mapSectionRef}
            className="relative min-h-[560px]"
          >
            <div
              ref={mapElementRef}
              className="absolute inset-0"
            />

            {!placesReady ? (
              <div className="absolute inset-0 grid place-items-center bg-slate-950">
                <div className="text-center">
                  <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-300" />
                  <p className="mt-4 text-sm text-slate-400">
                    Loading map…
                  </p>
                </div>
              </div>
            ) : null}

            {selectedRouteIndex !== null ? (
              <div className="absolute right-4 top-4 rounded-full border border-blue-400/30 bg-slate-950/90 px-3 py-2 text-xs font-bold text-blue-200 shadow-xl backdrop-blur">
                Route {selectedRouteIndex + 1}
              </div>
            ) : null}

            {result &&
            !(result.routes ?? []).some(
              (route) => route.encoded_polyline
            ) ? (
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-amber-400/25 bg-slate-950/95 p-4 text-sm text-amber-100 shadow-2xl backdrop-blur-xl">
                Route details are available, but route drawing data was not returned.
              </div>
            ) : null}
          </section>
        </section>

        {result ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <TrafficResult
              result={result}
              origin={origin}
              destination={destinationCoordinates}
              destinationName={form.destinationName}
              selectedRouteIndex={selectedRouteIndex}
              onSelectRoute={setSelectedRouteIndex}
              onStartNavigation={() => void startLiveNavigation()}
              onOpenExternalNavigation={openExternalNavigation}
            />
          </section>
        ) : null}

        {navigationStatus !== "idle" ? (
          <section className="rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-950/60 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                  Live Navigation Session
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  {navigationStatus === "active"
                    ? "Mira is monitoring your journey"
                    : navigationStatus === "paused"
                      ? "Navigation is paused"
                      : "Journey completed"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  {miraNavigationMessage}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {navigationStatus === "active" ||
                navigationStatus === "paused" ? (
                  <button
                    type="button"
                    onClick={pauseOrResumeNavigation}
                    className="rounded-2xl border border-blue-400/25 bg-blue-400/10 px-4 py-3 text-sm font-bold text-blue-200"
                  >
                    {navigationStatus === "paused"
                      ? "Resume"
                      : "Pause"}
                  </button>
                ) : null}

                {navigationStatus !== "completed" ? (
                  <button
                    type="button"
                    onClick={endLiveNavigation}
                    className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200"
                  >
                    End Navigation
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <label className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Voice language
                </span>

                <select
                  value={voiceLanguage}
                  onChange={(event) =>
                    setVoiceLanguage(event.target.value)
                  }
                  className="w-full bg-transparent text-sm font-bold text-white outline-none"
                >
                  {VOICE_LANGUAGES.map((language) => (
                    <option
                      key={language.code}
                      value={language.code}
                      className="bg-slate-950"
                    >
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setVoiceEnabled((current) => {
                    const nextValue = !current;

                    if (!nextValue) {
                      stopVoice();
                    }

                    return nextValue;
                  });
                }}
                className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                  voiceEnabled
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-slate-950/50 text-slate-400"
                }`}
              >
                {voiceEnabled ? "Voice On" : "Voice Muted"}
              </button>

              <button
                type="button"
                onClick={repeatLastInstruction}
                className="rounded-2xl border border-blue-400/25 bg-blue-400/10 px-4 py-3 text-sm font-bold text-blue-200"
              >
                Repeat Instruction
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric
                label="Speed"
                value={`${Math.round(speedKph)} km/h`}
              />
              <Metric
                label="Distance Remaining"
                value={formatRemainingDistance(
                  distanceRemainingMetres
                )}
              />
              <Metric
                label="Traffic ETA"
                value={
                  result?.routes?.find(
                    (route) =>
                      route.route_index ===
                      selectedRouteIndex
                  )?.traffic_duration_minutes
                    ? `${
                        result.routes.find(
                          (route) =>
                            route.route_index ===
                            selectedRouteIndex
                        )?.traffic_duration_minutes
                      } min`
                    : "Not available"
                }
              />
              <Metric
                label="Stopped"
                value={
                  stoppedSince
                    ? `${Math.max(
                        1,
                        Math.floor(
                          (Date.now() - stoppedSince) /
                            60000
                        )
                      )} min`
                    : "Moving"
                }
              />
              <Metric
                label="Traffic Updated"
                value={
                  lastTrafficRefresh
                    ? formatTime(lastTrafficRefresh)
                    : "Waiting"
                }
              />
            </div>

            {currentLocation ? (
              <p className="mt-4 text-xs text-slate-600">
                Live GPS:{" "}
                {currentLocation.latitude.toFixed(6)},{" "}
                {currentLocation.longitude.toFixed(6)}
              </p>
            ) : null}

            <p className="mt-2 text-xs text-slate-600">
              Mira speaks only important journey updates to avoid
              distracting the driver.
            </p>
          </section>
        ) : null}

        <section className="rounded-3xl border border-rose-400/25 bg-gradient-to-br from-rose-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rose-500 text-2xl shadow-lg shadow-rose-950/40">
                🆘
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
                  Emergency SOS
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  Help during navigation
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Start an SOS countdown, prepare live coordinates and open
                  nearby emergency services. Actual contact alerts require the
                  connected SOS backend and saved emergency contacts.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={startSosCountdown}
              disabled={
                sosState === "countdown" ||
                sosState === "sending"
              }
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-rose-500 px-7 py-4 text-base font-black text-white shadow-lg shadow-rose-950/40 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sosState === "countdown"
                ? `SOS in ${sosCountdown}`
                : sosState === "sending"
                  ? "Sending SOS…"
                  : sosState === "sent"
                    ? "SOS Active"
                    : "Activate SOS"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-200">
                  Silent SOS
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Suppresses spoken confirmation and audible prompts.
                </p>
              </div>

              <input
                type="checkbox"
                checked={sosMode === "silent"}
                onChange={(event) =>
                  setSosMode(
                    event.target.checked ? "silent" : "normal"
                  )
                }
                className="h-5 w-5 accent-rose-500"
              />
            </label>

            {sosState === "countdown" ? (
              <button
                type="button"
                onClick={cancelSos}
                className="rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-bold text-white"
              >
                Cancel SOS
              </button>
            ) : null}
          </div>

          {sosMessage ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                sosState === "sent"
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                  : sosState === "cancelled"
                    ? "border-blue-400/25 bg-blue-400/10 text-blue-100"
                    : "border-amber-400/25 bg-amber-400/10 text-amber-100"
              }`}
            >
              {sosMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => openEmergencySearch("hospital")}
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-rose-400/30"
            >
              🏥 Nearest Hospital
            </button>

            <button
              type="button"
              onClick={() => openEmergencySearch("police station")}
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-rose-400/30"
            >
              👮 Nearest Police
            </button>

            <button
              type="button"
              onClick={() => openEmergencySearch("tow truck")}
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-rose-400/30"
            >
              🚚 Tow Support
            </button>

            <button
              type="button"
              onClick={() =>
                openEmergencySearch("vehicle workshop")
              }
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-rose-400/30"
            >
              🛠️ Nearby Workshop
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Emergency details
            </p>

            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs text-slate-600">Latitude</p>
                <p className="mt-1 font-bold text-slate-200">
                  {getEmergencyLocation()
                    ? getEmergencyLocation()!.latitude.toFixed(6)
                    : "Unavailable"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-600">Longitude</p>
                <p className="mt-1 font-bold text-slate-200">
                  {getEmergencyLocation()
                    ? getEmergencyLocation()!.longitude.toFixed(6)
                    : "Unavailable"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-600">Destination</p>
                <p className="mt-1 font-bold text-slate-200">
                  {form.destinationName || "Not selected"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-600">Speed</p>
                <p className="mt-1 font-bold text-slate-200">
                  {Math.round(speedKph)} km/h
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold">
              Nearby services
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Quickly search important places near your current or
              selected destination.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {nearbyServices.map((service) => (
              <button
                key={service.title}
                type="button"
                onClick={() =>
                  openNearbySearch(service.query)
                }
                className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 text-left transition hover:-translate-y-1 hover:border-cyan-400/30"
              >
                <h3 className="text-lg font-bold">
                  {service.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {service.subtitle}
                </p>
              </button>
            ))}
          </div>
        </section>

        <div className="pb-4">
          <Link
            href="/"
            className="text-sm font-semibold text-cyan-300 hover:underline"
          >
            ← Back to My Vehicle
          </Link>
        </div>
      </div>
    </main>
  );
}

function TrafficResult(props: {
  result: TrafficPredictionResponse;
  origin: Coordinates | null;
  destination: Coordinates | null;
  destinationName: string;
  selectedRouteIndex: number | null;
  onSelectRoute: (routeIndex: number) => void;
  onStartNavigation: () => void;
  onOpenExternalNavigation: () => void;
}) {
  const recommendation =
    props.result.recommendation;

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Mira recommendation
        </p>

        <h2 className="mt-2 text-2xl font-bold">
          {recommendation?.should_reroute
            ? "Faster route available"
            : "Current route is suitable"}
        </h2>
      </div>

      {recommendation ? (
        <div
          className={
            recommendation.should_reroute
              ? "mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100"
              : "mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100"
          }
        >
          <p className="font-semibold">
            {recommendation.mira_message}
          </p>

          <p className="mt-2 text-sm leading-6 opacity-80">
            {recommendation.reason}
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Routes found"
          value={String(
            props.result.route_count ?? 0
          )}
        />

        <Metric
          label="Time saving"
          value={`${
            recommendation?.time_saved_minutes ?? 0
          } min`}
        />

        <Metric
          label="Distance difference"
          value={`${
            recommendation?.distance_difference_km ?? 0
          } km`}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Traffic-signal intelligence
            </p>
            <h3 className="mt-2 font-bold">
              Signal countdown data is not connected yet
            </h3>
          </div>

          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
            Integration required
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          My Vehicle can display signal count, live red or green status
          and countdown timers only after a supported city traffic-signal
          data provider is connected.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {(props.result.routes ?? []).map((route) => (
          <RouteCard
            key={route.route_index}
            route={route}
            recommended={
              recommendation?.recommended_route_index ===
              route.route_index
            }
            selected={
              props.selectedRouteIndex === route.route_index
            }
            onSelect={() =>
              props.onSelectRoute(route.route_index)
            }
          />
        ))}
      </div>

      {props.result.disclaimer ? (
        <p className="mt-5 text-xs leading-5 text-slate-600">
          {props.result.disclaimer}
        </p>
      ) : null}
    </div>
  );
}

function RouteCard(props: {
  route: RouteOption;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={props.onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onSelect();
        }
      }}
      className={
        props.selected
          ? "cursor-pointer rounded-2xl border-2 border-blue-400 bg-blue-400/15 p-4 shadow-lg shadow-blue-950/30"
          : props.recommended
            ? "cursor-pointer rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 transition hover:border-cyan-300/60"
            : "cursor-pointer rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-white/25"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">
              Route {props.route.route_index + 1}
            </h3>

            {props.recommended ? (
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                Recommended
              </span>
            ) : null}

            {props.selected ? (
              <span className="rounded-full border border-blue-400/30 bg-blue-400/15 px-2.5 py-1 text-xs font-semibold text-blue-200">
                Selected
              </span>
            ) : null}

            <CongestionBadge
              value={
                props.route.congestion.overall_level
              }
            />
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {props.route.description ||
              formatLabel(props.route.route_type)}
          </p>
        </div>

        <p className="text-lg font-bold text-cyan-300">
          {props.route.traffic_duration_minutes} min
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Detail
          label="Distance"
          value={`${props.route.distance_km} km`}
        />

        <Detail
          label="Normal time"
          value={`${props.route.normal_duration_minutes} min`}
        />

        <Detail
          label="Traffic delay"
          value={`${props.route.traffic_delay_minutes} min`}
        />

        <Detail
          label="Arrival"
          value={formatTime(
            props.route.estimated_arrival_time
          )}
        />
      </div>
    </article>
  );
}

function EmptyRouteState() {
  return (
    <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-3xl">
        🧭
      </div>

      <h2 className="mt-5 text-2xl font-bold">
        Ready to analyse traffic
      </h2>

      <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
        Detect your current location, enter a destination and let
        Mira compare traffic-aware routes before you start driving.
      </p>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  type?: string;
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
        type={props.type || "text"}
        value={props.value}
        required={props.required}
        placeholder={props.placeholder}
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
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
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
      >
        {props.options.map(([value, label]) => (
          <option
            key={value}
            value={value}
          >
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompactToggle(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
        props.checked
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
          : "border-white/10 bg-white/[0.04] text-slate-400"
      }`}
    >
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-cyan-400"
      />
      {props.label}
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
        className="h-5 w-5 rounded border-white/20 bg-slate-900"
      />
    </label>
  );
}

function Metric(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-1 text-lg font-bold">
        {props.value}
      </p>
    </div>
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

      <p className="mt-1 font-semibold text-slate-300">
        {props.value}
      </p>
    </div>
  );
}

function CongestionBadge(props: {
  value: RouteOption["congestion"]["overall_level"];
}) {
  const classes =
    props.value === "severe"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : props.value === "heavy"
        ? "border-orange-400/30 bg-orange-400/10 text-orange-200"
        : props.value === "moderate"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.value)}
    </span>
  );
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}