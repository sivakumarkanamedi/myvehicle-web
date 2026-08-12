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

type NavigationRoute = {
  route_index: number;
  encoded_polyline: string | null;
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
              center:
                initialCenter,
              zoom:
                currentLocation ||
                destination
                  ? 14
                  : 11,
              mapId,
              disableDefaultUI:
                false,
              mapTypeControl:
                false,
              streetViewControl:
                false,
              fullscreenControl:
                true,
              zoomControl:
                true,
              gestureHandling:
                "greedy",
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

        fitMapToContent({
          google,
          map:
            mapRef.current,
          currentLocation,
          destination,
          routes,
        });

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
    };
  }, [
    apiKey,
    mapId,
    showPlaceSearch,
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

    fitMapToContent({
      google,
      map:
        mapRef.current,
      currentLocation,
      destination,
      routes,
    });
  }, [
    currentLocation,
    destination,
    destinationName,
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

    fitMapToContent({
      google,
      map:
        mapRef.current,
      currentLocation,
      destination,
      routes,
    });
  }, [
    routes,
    selectedRouteIndex,
  ]);

  function handleError(
    message: string
  ) {
    setError(message);
    onError?.(message);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/20">
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
          <div className="absolute inset-x-4 top-4 rounded-2xl border border-rose-400/30 bg-rose-950/95 px-4 py-3 text-sm text-rose-100 shadow-xl">
            {error}
          </div>
        ) : null}

        {!loading &&
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
  removeMarker(
    currentMarkerRef.current
  );

  removeMarker(
    destinationMarkerRef.current
  );

  currentMarkerRef.current =
    null;

  destinationMarkerRef.current =
    null;

  const AdvancedMarkerElement =
    google.maps.marker
      .AdvancedMarkerElement;

  const PinElement =
    google.maps.marker.PinElement;

  if (currentLocation) {
    const currentPin =
      new PinElement({
        background: "#22d3ee",
        borderColor: "#0e7490",
        glyphColor: "#082f49",
        glyph: "●",
        scale: 1.1,
      });

    currentMarkerRef.current =
      new AdvancedMarkerElement({
        map,
        position:
          toLatLng(
            currentLocation
          ),
        title:
          "Current location",
        content:
          currentPin.element,
      });
  }

  if (destination) {
    const destinationPin =
      new PinElement({
        background: "#fb7185",
        borderColor: "#9f1239",
        glyphColor: "#4c0519",
        glyph: "D",
        scale: 1.1,
      });

    destinationMarkerRef.current =
      new AdvancedMarkerElement({
        map,
        position:
          toLatLng(destination),
        title:
          destinationName,
        content:
          destinationPin.element,
      });
  }
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

    const selected =
      route.route_index ===
      selectedRouteIndex;

    const polyline =
      new google.maps.Polyline({
        map,
        path:
          decodePath(
            route.encoded_polyline
          ),
        geodesic: true,
        strokeColor:
          selected
            ? "#06b6d4"
            : "#64748b",
        strokeOpacity:
          selected
            ? 0.95
            : 0.55,
        strokeWeight:
          selected ? 7 : 5,
        zIndex:
          selected ? 20 : 10,
        clickable: true,
      });

    routePolylinesRef.current.push(
      polyline
    );
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
  for (const polyline of routePolylinesRef.current) {
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