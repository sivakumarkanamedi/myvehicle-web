"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type CongestionLevel =
  | "light"
  | "moderate"
  | "heavy"
  | "severe";

type TrafficSegment = {
  encoded_polyline?: string | null;
  congestion_level?: CongestionLevel | null;
  level?: CongestionLevel | null;
};

type NavigationRoute = {
  route_index: number;
  encoded_polyline: string | null;
  congestion?: {
    overall_level?: CongestionLevel | null;
  } | null;
  traffic_segments?: TrafficSegment[] | null;
};

export type SelectedPlace = {
  placeId: string | null;
  name: string;
  address: string;
  coordinates: Coordinates;
  rating: number | null;
  phoneNumber: string | null;
  websiteUrl: string | null;
  isOpenNow: boolean | null;
  regularOpeningHours: string[];
};

type MiraMapProps = {
  currentLocation?: Coordinates | null;
  destination?: Coordinates | null;
  destinationName?: string;
  routes?: NavigationRoute[];
  selectedRouteIndex?: number;
  heightClassName?: string;
  showPlaceSearch?: boolean;

  /**
   * Live-navigation mode keeps the map clean and avoids repeatedly fitting
   * the whole route while GPS updates are coming in.
   */
  navigationMode?: boolean;

  /**
   * When true in navigationMode, the map follows the moving vehicle.
   */
  followCurrentLocation?: boolean;

  onPlaceSelected?: (place: SelectedPlace) => void;
  onMapReady?: () => void;
  onError?: (message: string) => void;
};

type GoogleMapsWindow = Window & {
  google?: any;
  __miraGoogleMapsPromise?: Promise<any>;
};

const DEFAULT_CENTER = {
  lat: 12.9716,
  lng: 77.5946,
};

const MAP_SCRIPT_ID =
  "mira-google-maps-javascript-api";

export default function MiraMap({
  currentLocation = null,
  destination = null,
  destinationName = "Destination",
  routes = [],
  selectedRouteIndex = 0,
  heightClassName = "h-[560px]",
  showPlaceSearch = true,
  navigationMode = false,
  followCurrentLocation = false,
  onPlaceSelected,
  onMapReady,
  onError,
}: MiraMapProps) {
  const mapContainerRef =
    useRef<HTMLDivElement | null>(null);

  const autocompleteContainerRef =
    useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<any>(null);

  const currentMarkerRef =
    useRef<any>(null);

  const destinationMarkerRef =
    useRef<any>(null);

  const routePolylinesRef =
    useRef<any[]>([]);

  const autocompleteElementRef =
    useRef<any>(null);

  const firstLiveFocusDoneRef =
    useRef(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const apiKey =
    process.env
      .NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const mapId =
    process.env
      .NEXT_PUBLIC_GOOGLE_MAP_ID ||
    "DEMO_MAP_ID";

  const selectedRoute = useMemo(
    () =>
      routes.find(
        (route) =>
          route.route_index ===
          selectedRouteIndex
      ) ??
      routes[0] ??
      null,
    [routes, selectedRouteIndex]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialiseMap() {
      try {
        setLoading(true);
        setError("");

        if (!apiKey) {
          throw new Error(
            "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing from .env.local."
          );
        }

        const google =
          await loadGoogleMaps(apiKey);

        if (
          cancelled ||
          !mapContainerRef.current
        ) {
          return;
        }

        validateGoogleLibraries(google);

        const initialCenter =
          currentLocation
            ? toLatLng(currentLocation)
            : destination
              ? toLatLng(destination)
              : DEFAULT_CENTER;

        mapRef.current =
          new google.maps.Map(
            mapContainerRef.current,
            {
              center: initialCenter,
              zoom:
                navigationMode
                  ? 17
                  : currentLocation ||
                      destination
                    ? 14
                    : 11,
              mapId,

              // Live mode should feel like a navigation cockpit,
              // not like a generic Google Maps page.
              disableDefaultUI:
                navigationMode,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl:
                !navigationMode,
              zoomControl:
                !navigationMode,
              gestureHandling:
                "greedy",
              clickableIcons: true,
              keyboardShortcuts:
                !navigationMode,
              rotateControl:
                navigationMode,
            }
          );

        if (
          showPlaceSearch &&
          autocompleteContainerRef.current
        ) {
          setupAutocomplete({
            google,
            map:
              mapRef.current,
            container:
              autocompleteContainerRef.current,
            elementRef:
              autocompleteElementRef,
            onPlaceSelected,
            onError:
              handleError,
          });
        }

        updateMarkers(
          google,
          mapRef.current,
          currentLocation,
          destination,
          destinationName,
          currentMarkerRef,
          destinationMarkerRef
        );

        drawRoutes(
          google,
          mapRef.current,
          routes,
          selectedRouteIndex,
          routePolylinesRef
        );

        if (
          navigationMode &&
          currentLocation
        ) {
          focusLiveVehicle(
            mapRef.current,
            currentLocation,
            true
          );

          firstLiveFocusDoneRef.current =
            true;
        } else {
          fitMapToContent({
            google,
            map:
              mapRef.current,
            currentLocation,
            destination,
            routes,
          });
        }

        setLoading(false);
        onMapReady?.();
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        handleError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load Google Maps."
        );

        setLoading(false);
      }
    }

    void initialiseMap();

    return () => {
      cancelled = true;

      removeMarker(
        currentMarkerRef.current
      );

      removeMarker(
        destinationMarkerRef.current
      );

      clearPolylines(
        routePolylinesRef
      );

      if (
        autocompleteElementRef.current
      ) {
        autocompleteElementRef.current
          .remove();

        autocompleteElementRef.current =
          null;
      }

      mapRef.current = null;
      firstLiveFocusDoneRef.current =
        false;
    };
  }, [
    apiKey,
    mapId,
    showPlaceSearch,
    navigationMode,
  ]);

  useEffect(() => {
    const google =
      getGoogle();

    if (
      !google ||
      !mapRef.current
    ) {
      return;
    }

    updateMarkers(
      google,
      mapRef.current,
      currentLocation,
      destination,
      destinationName,
      currentMarkerRef,
      destinationMarkerRef
    );

    if (
      navigationMode &&
      followCurrentLocation &&
      currentLocation
    ) {
      focusLiveVehicle(
        mapRef.current,
        currentLocation,
        !firstLiveFocusDoneRef.current
      );

      firstLiveFocusDoneRef.current =
        true;

      return;
    }

    if (!navigationMode) {
      fitMapToContent({
        google,
        map:
          mapRef.current,
        currentLocation,
        destination,
        routes,
      });
    }
  }, [
    currentLocation,
    destination,
    destinationName,
    navigationMode,
    followCurrentLocation,
  ]);

  useEffect(() => {
    const google =
      getGoogle();

    if (
      !google ||
      !mapRef.current
    ) {
      return;
    }

    drawRoutes(
      google,
      mapRef.current,
      routes,
      selectedRouteIndex,
      routePolylinesRef
    );

    if (!navigationMode || !followCurrentLocation) {
      fitMapToContent({
        google,
        map:
          mapRef.current,
        currentLocation,
        destination,
        routes,
      });
    } else if (
      currentLocation &&
      followCurrentLocation
    ) {
      focusLiveVehicle(
        mapRef.current,
        currentLocation,
        false
      );
    }
  }, [
    routes,
    selectedRouteIndex,
    navigationMode,
    followCurrentLocation,
  ]);

  function handleError(
    message: string
  ) {
    setError(message);
    onError?.(message);
  }

  return (
    <section
      className={
        navigationMode
          ? "relative overflow-hidden bg-slate-950"
          : "overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/20"
      }
    >
      {showPlaceSearch ? (
        <div className="border-b border-white/10 bg-slate-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Search destination
          </p>

          <div
            ref={
              autocompleteContainerRef
            }
            className="min-h-[48px] overflow-hidden rounded-2xl bg-white"
          />
        </div>
      ) : null}

      <div className="relative">
        <div
          ref={mapContainerRef}
          className={`w-full ${heightClassName}`}
        />

        {navigationMode ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/15 via-transparent to-slate-950/20" />

            <div className="pointer-events-none absolute bottom-6 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-cyan-400/5 blur-3xl" />
          </>
        ) : null}

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

              <p className="mt-4 text-sm text-slate-400">
                Loading Mira Map...
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-x-4 top-4 z-30 rounded-2xl border border-rose-400/30 bg-rose-950/95 px-4 py-3 text-sm text-rose-100 shadow-xl">
            {error}
          </div>
        ) : null}

        {!navigationMode &&
        !loading &&
        !error &&
        selectedRoute ? (
          <div className="absolute bottom-4 left-4 rounded-2xl border border-cyan-400/30 bg-slate-950/90 px-4 py-3 text-sm shadow-xl backdrop-blur">
            <p className="font-semibold text-cyan-200">
              Route{" "}
              {selectedRoute.route_index +
                1}{" "}
              selected
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

async function loadGoogleMaps(
  apiKey: string
) {
  const browserWindow =
    window as GoogleMapsWindow;

  if (
    browserWindow.google?.maps &&
    hasRequiredLibraries(
      browserWindow.google
    )
  ) {
    return browserWindow.google;
  }

  if (
    browserWindow.__miraGoogleMapsPromise
  ) {
    return browserWindow.__miraGoogleMapsPromise;
  }

  browserWindow.__miraGoogleMapsPromise =
    new Promise(
      (resolve, reject) => {
        const existingScript =
          document.getElementById(
            MAP_SCRIPT_ID
          ) as HTMLScriptElement | null;

        if (existingScript) {
          if (
            browserWindow.google?.maps &&
            hasRequiredLibraries(
              browserWindow.google
            )
          ) {
            resolve(
              browserWindow.google
            );

            return;
          }

          existingScript.addEventListener(
            "load",
            () => {
              if (
                browserWindow.google?.maps &&
                hasRequiredLibraries(
                  browserWindow.google
                )
              ) {
                resolve(
                  browserWindow.google
                );
              } else {
                reject(
                  new Error(
                    "Google Maps loaded, but the Places, Geometry or Marker library is missing. Restart Next.js and hard-refresh the browser."
                  )
                );
              }
            },
            {
              once: true,
            }
          );

          existingScript.addEventListener(
            "error",
            () =>
              reject(
                new Error(
                  "Unable to load the Google Maps script."
                )
              ),
            {
              once: true,
            }
          );

          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.id =
          MAP_SCRIPT_ID;

        script.async = true;
        script.defer = true;

        script.src =
          "https://maps.googleapis.com/maps/api/js" +
          `?key=${encodeURIComponent(
            apiKey
          )}` +
          "&v=weekly" +
          "&libraries=places,geometry,marker";

        script.onload = () => {
          if (
            browserWindow.google?.maps &&
            hasRequiredLibraries(
              browserWindow.google
            )
          ) {
            resolve(
              browserWindow.google
            );
          } else {
            reject(
              new Error(
                "Google Maps loaded without the required Places, Geometry or Marker library."
              )
            );
          }
        };

        script.onerror = () =>
          reject(
            new Error(
              "Unable to load Google Maps. Check the API key, enabled APIs, billing and allowed website restrictions."
            )
          );

        document.head.appendChild(
          script
        );
      }
    );

  return browserWindow.__miraGoogleMapsPromise;
}

function hasRequiredLibraries(
  google: any
) {
  return Boolean(
    google?.maps &&
    google.maps.places &&
    google.maps.geometry?.encoding &&
    google.maps.marker
  );
}

function validateGoogleLibraries(
  google: any
) {
  if (!google?.maps) {
    throw new Error(
      "Google Maps JavaScript API failed to load."
    );
  }

  if (!google.maps.places) {
    throw new Error(
      "Google Places library failed to load."
    );
  }

  if (
    !google.maps.geometry?.encoding
  ) {
    throw new Error(
      "Google Geometry library failed to load."
    );
  }

  if (!google.maps.marker) {
    throw new Error(
      "Google Advanced Marker library failed to load."
    );
  }

  if (
    !google.maps.places
      .PlaceAutocompleteElement
  ) {
    throw new Error(
      "PlaceAutocompleteElement is unavailable. Confirm that Places API (New) is enabled in Google Cloud."
    );
  }
}

function setupAutocomplete(args: {
  google: any;
  map: any;
  container: HTMLDivElement;
  elementRef: MutableRefObject<any>;
  onPlaceSelected?: (
    place: SelectedPlace
  ) => void;
  onError: (message: string) => void;
}) {
  if (
    args.elementRef.current
  ) {
    return;
  }

  const autocomplete =
    new args.google.maps.places.PlaceAutocompleteElement(
      {
        includedRegionCodes: [
          "in",
        ],
        placeholder:
          "Search place, address or landmark",
      }
    );

  autocomplete.style.width =
    "100%";

  autocomplete.style.minHeight =
    "48px";

  autocomplete.addEventListener(
    "gmp-select",
    async (event: any) => {
      try {
        const prediction =
          event.placePrediction;

        if (!prediction) {
          throw new Error(
            "No place prediction was selected."
          );
        }

        const place =
          prediction.toPlace();

        await place.fetchFields({
          fields: [
            "id",
            "displayName",
            "formattedAddress",
            "location",
            "viewport",
            "rating",
            "nationalPhoneNumber",
            "websiteURI",
            "regularOpeningHours",
          ],
        });

        if (!place.location) {
          throw new Error(
            "The selected place does not contain a map location."
          );
        }

        if (place.viewport) {
          args.map.fitBounds(
            place.viewport
          );
        } else {
          args.map.setCenter(
            place.location
          );

          args.map.setZoom(16);
        }

        const selectedPlace: SelectedPlace =
          {
            placeId:
              place.id ?? null,

            name:
              getPlaceDisplayName(
                place,
                prediction
              ),

            address:
              place.formattedAddress ??
              "",

            coordinates: {
              latitude:
                Number(
                  place.location.lat()
                ),

              longitude:
                Number(
                  place.location.lng()
                ),
            },

            rating:
              typeof place.rating ===
              "number"
                ? place.rating
                : null,

            phoneNumber:
              place.nationalPhoneNumber ??
              null,

            websiteUrl:
              place.websiteURI ??
              null,

            isOpenNow:
              typeof place
                .regularOpeningHours
                ?.openNow ===
              "boolean"
                ? place
                    .regularOpeningHours
                    .openNow
                : null,

            regularOpeningHours:
              Array.isArray(
                place
                  .regularOpeningHours
                  ?.weekdayDescriptions
              )
                ? place
                    .regularOpeningHours
                    .weekdayDescriptions
                : [],
          };

        args.onPlaceSelected?.(
          selectedPlace
        );
      } catch (caughtError) {
        args.onError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the selected place."
        );
      }
    }
  );

  args.container.innerHTML =
    "";

  args.container.appendChild(
    autocomplete
  );

  args.elementRef.current =
    autocomplete;
}

function getPlaceDisplayName(
  place: any,
  prediction: any
) {
  if (
    typeof place.displayName ===
    "string"
  ) {
    return place.displayName;
  }

  if (
    typeof place.displayName?.text ===
    "string"
  ) {
    return place.displayName.text;
  }

  if (
    typeof prediction.text?.text ===
    "string"
  ) {
    return prediction.text.text;
  }

  return "Selected destination";
}

function updateMarkers(
  google: any,
  map: any,
  currentLocation: Coordinates | null,
  destination: Coordinates | null,
  destinationName: string,
  currentMarkerRef: MutableRefObject<any>,
  destinationMarkerRef: MutableRefObject<any>
) {
  const AdvancedMarkerElement =
    google.maps.marker
      .AdvancedMarkerElement;

  if (currentLocation) {
    if (!currentMarkerRef.current) {
      currentMarkerRef.current =
        new AdvancedMarkerElement({
          map,
          position:
            toLatLng(
              currentLocation
            ),
          title:
            "Your vehicle",
          content:
            createVehicleMarker(),
          zIndex: 100,
        });
    } else {
      currentMarkerRef.current.position =
        toLatLng(
          currentLocation
        );

      currentMarkerRef.current.map =
        map;
    }
  } else if (
    currentMarkerRef.current
  ) {
    removeMarker(
      currentMarkerRef.current
    );

    currentMarkerRef.current =
      null;
  }

  if (destination) {
    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current =
        new AdvancedMarkerElement({
          map,
          position:
            toLatLng(destination),
          title:
            destinationName,
          content:
            createDestinationMarker(),
          zIndex: 90,
        });
    } else {
      destinationMarkerRef.current.position =
        toLatLng(destination);

      destinationMarkerRef.current.title =
        destinationName;

      destinationMarkerRef.current.map =
        map;
    }
  } else if (
    destinationMarkerRef.current
  ) {
    removeMarker(
      destinationMarkerRef.current
    );

    destinationMarkerRef.current =
      null;
  }
}

function createVehicleMarker() {
  const root =
    document.createElement("div");

  root.style.width = "54px";
  root.style.height = "54px";
  root.style.borderRadius = "9999px";
  root.style.display = "grid";
  root.style.placeItems = "center";
  root.style.background =
    "radial-gradient(circle at 50% 45%, rgba(34,211,238,.34), rgba(37,99,235,.20) 50%, rgba(2,6,23,.94) 72%)";
  root.style.border =
    "2px solid rgba(103,232,249,.92)";
  root.style.boxShadow =
    "0 0 0 5px rgba(34,211,238,.12), 0 0 26px rgba(34,211,238,.75), 0 8px 30px rgba(2,6,23,.70)";
  root.style.color = "#ffffff";
  root.style.fontSize = "27px";
  root.style.lineHeight = "1";
  root.style.userSelect = "none";
  root.style.transition =
    "transform 220ms ease, filter 220ms ease";
  root.style.filter =
    "drop-shadow(0 0 7px rgba(34,211,238,.75))";

  const car =
    document.createElement("span");

  car.textContent = "🚘";
  car.style.transform =
    "translateY(-1px)";
  car.style.display = "block";

  root.appendChild(car);

  return root;
}

function createDestinationMarker() {
  const root =
    document.createElement("div");

  root.style.width = "34px";
  root.style.height = "42px";
  root.style.position = "relative";
  root.style.display = "grid";
  root.style.placeItems = "center";
  root.style.borderRadius =
    "18px 18px 18px 4px";
  root.style.transform =
    "rotate(-45deg)";
  root.style.background =
    "linear-gradient(135deg,#fb7185,#ef4444)";
  root.style.border =
    "2px solid rgba(255,255,255,.9)";
  root.style.boxShadow =
    "0 0 22px rgba(244,63,94,.62), 0 8px 20px rgba(2,6,23,.55)";

  const dot =
    document.createElement("span");

  dot.style.width = "10px";
  dot.style.height = "10px";
  dot.style.borderRadius =
    "9999px";
  dot.style.background = "#ffffff";
  dot.style.transform =
    "rotate(45deg)";
  dot.style.display = "block";

  root.appendChild(dot);

  return root;
}

function drawRoutes(
  google: any,
  map: any,
  routes: NavigationRoute[],
  selectedRouteIndex: number,
  routePolylinesRef: MutableRefObject<any[]>
) {
  clearPolylines(
    routePolylinesRef
  );

  const decodePath =
    google.maps.geometry
      .encoding.decodePath;

  const sortedRoutes =
    [...routes].sort(
      (first, second) =>
        Number(
          first.route_index ===
            selectedRouteIndex
        ) -
        Number(
          second.route_index ===
            selectedRouteIndex
        )
    );

  for (const route of sortedRoutes) {
    if (
      !route.encoded_polyline
    ) {
      continue;
    }

    const path =
      decodePath(
        route.encoded_polyline
      );

    const selected =
      route.route_index ===
      selectedRouteIndex;

    if (!selected) {
      const alternative =
        new google.maps.Polyline({
          map,
          path,
          geodesic: true,
          strokeColor:
            "#64748b",
          strokeOpacity:
            0.42,
          strokeWeight:
            5,
          zIndex:
            8,
          clickable: true,
        });

      routePolylinesRef.current.push(
        alternative
      );

      continue;
    }

    const congestionLevel =
      route.congestion
        ?.overall_level ??
      "light";

    const routeColor =
      congestionColor(
        congestionLevel
      );

    // Outer neon halo.
    const glow =
      new google.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor:
          routeColor,
        strokeOpacity:
          0.18,
        strokeWeight:
          22,
        zIndex:
          18,
        clickable: false,
      });

    // Mid glow adds the premium "Mira energy route" look.
    const midGlow =
      new google.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor:
          routeColor,
        strokeOpacity:
          0.35,
        strokeWeight:
          14,
        zIndex:
          19,
        clickable: false,
      });

    // Main selected route.
    const main =
      new google.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor:
          routeColor,
        strokeOpacity:
          1,
        strokeWeight:
          8,
        zIndex:
          20,
        clickable: true,
      });

    // Directional motion cues.
    const arrows =
      new google.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeOpacity: 0,
        zIndex: 21,
        clickable: false,
        icons: [
          {
            icon: {
              path:
                google.maps.SymbolPath
                  .FORWARD_CLOSED_ARROW,
              scale: 2.2,
              strokeColor:
                "#ffffff",
              strokeOpacity:
                0.90,
              strokeWeight: 1.3,
              fillColor:
                routeColor,
              fillOpacity: 1,
            },
            offset: "10%",
            repeat: "110px",
          },
        ],
      });

    routePolylinesRef.current.push(
      glow,
      midGlow,
      main,
      arrows
    );

    // If the backend later supplies genuine traffic-segment polylines,
    // this overlays them without inventing traffic information.
    if (
      Array.isArray(
        route.traffic_segments
      )
    ) {
      for (
        const segment of
        route.traffic_segments
      ) {
        if (
          !segment
            ?.encoded_polyline
        ) {
          continue;
        }

        const segmentLevel =
          segment.congestion_level ??
          segment.level ??
          congestionLevel;

        const segmentPolyline =
          new google.maps.Polyline({
            map,
            path:
              decodePath(
                segment
                  .encoded_polyline
              ),
            geodesic: true,
            strokeColor:
              congestionColor(
                segmentLevel
              ),
            strokeOpacity:
              1,
            strokeWeight:
              9,
            zIndex:
              24,
            clickable: false,
          });

        routePolylinesRef.current.push(
          segmentPolyline
        );
      }
    }
  }
}

function congestionColor(
  level: CongestionLevel
) {
  switch (level) {
    case "moderate":
      return "#facc15";
    case "heavy":
      return "#fb923c";
    case "severe":
      return "#f43f5e";
    case "light":
    default:
      return "#22d3ee";
  }
}

function focusLiveVehicle(
  map: any,
  currentLocation: Coordinates,
  initial: boolean
) {
  const position =
    toLatLng(currentLocation);

  if (initial) {
    map.setCenter(position);
    map.setZoom(17);

    return;
  }

  map.panTo(position);

  const zoom =
    Number(map.getZoom?.());

  if (
    !Number.isFinite(zoom) ||
    zoom < 16
  ) {
    map.setZoom(17);
  }
}

function fitMapToContent(args: {
  google: any;
  map: any;
  currentLocation: Coordinates | null;
  destination: Coordinates | null;
  routes: NavigationRoute[];
}) {
  const bounds =
    new args.google.maps.LatLngBounds();

  let pointsAdded = 0;

  if (args.currentLocation) {
    bounds.extend(
      toLatLng(
        args.currentLocation
      )
    );

    pointsAdded += 1;
  }

  if (args.destination) {
    bounds.extend(
      toLatLng(
        args.destination
      )
    );

    pointsAdded += 1;
  }

  for (const route of args.routes) {
    if (
      !route.encoded_polyline
    ) {
      continue;
    }

    const routePath =
      args.google.maps.geometry
        .encoding.decodePath(
          route.encoded_polyline
        );

    const step =
      Math.max(
        1,
        Math.floor(
          routePath.length / 50
        )
      );

    for (
      let index = 0;
      index < routePath.length;
      index += step
    ) {
      bounds.extend(
        routePath[index]
      );

      pointsAdded += 1;
    }
  }

  if (pointsAdded >= 2) {
    args.map.fitBounds(
      bounds,
      70
    );

    return;
  }

  if (
    args.currentLocation
  ) {
    args.map.setCenter(
      toLatLng(
        args.currentLocation
      )
    );

    args.map.setZoom(15);

    return;
  }

  if (args.destination) {
    args.map.setCenter(
      toLatLng(
        args.destination
      )
    );

    args.map.setZoom(15);
  }
}

function clearPolylines(
  routePolylinesRef: MutableRefObject<any[]>
) {
  for (
    const polyline of
    routePolylinesRef.current
  ) {
    polyline.setMap(null);
  }

  routePolylinesRef.current =
    [];
}

function removeMarker(
  marker: any
) {
  if (!marker) {
    return;
  }

  marker.map = null;
}

function toLatLng(
  coordinates: Coordinates
) {
  return {
    lat:
      coordinates.latitude,
    lng:
      coordinates.longitude,
  };
}

function getGoogle() {
  return (
    window as GoogleMapsWindow
  ).google;
}