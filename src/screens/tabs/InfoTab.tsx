// src/screens/tabs/InfoTab.tsx

import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import * as ExpoLocation from "expo-location";

import {
  useNavigation,
} from "@react-navigation/native";

import type {
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";

import {
  getTourismPlacesWithin5Km,
  type TourismPlace,
} from "../../services/woosmapTourism";

import {
  findWikipediaArticle,
  type WikipediaArticle,
} from "../../services/wikipedia";

import {
  loadInfoSnapshot,
  saveInfoSnapshot,
  type CityInfo,
  type CityStatus,
  type InfoSnapshot,
  type PlaceWithWikipedia,
} from "../../services/infoDatabase";

import type {
  RootStackParamList,
} from "../../navigation/types";

import {
  useSelectedLocation,
} from "../SelectedLocationContext";

type Navigation =
  NativeStackNavigationProp<RootStackParamList>;

const WOOSMAP_API_KEY = "789357b7-df18-41af-b04d-290c988618b5";

const WIKIPEDIA_CONCURRENCY = 3;

const LANGUAGE_LABELS: Record<
  WikipediaArticle["language"],
  string
> = {
  el: "Greek",
  en: "English",
  fr: "French",
  it: "Italian",
};

function isValidLocation(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-GB");
}

export default function InfoTab() {
  const navigation = useNavigation<Navigation>();
  const location = useSelectedLocation();

  const latitude =
    location.latitude == null ||
    String(location.latitude).trim() === ""
      ? NaN
      : Number(location.latitude);

  const longitude =
    location.longitude == null ||
    String(location.longitude).trim() === ""
      ? NaN
      : Number(location.longitude);

  const [places, setPlaces] =
    useState<PlaceWithWikipedia[]>([]);

  const [cityInfo, setCityInfo] =
    useState<CityInfo | null>(null);

  const [cityStatus, setCityStatus] =
    useState<CityStatus>("loading");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [placesUpdatedAt, setPlacesUpdatedAt] =
    useState<string | null>(null);

  const [cityUpdatedAt, setCityUpdatedAt] =
    useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    setLoading(true);
    setRefreshing(false);
    setPlaces([]);
    setCityInfo(null);
    setCityStatus("loading");
    setNotice(null);
    setPlacesUpdatedAt(null);
    setCityUpdatedAt(null);

    async function load(): Promise<void> {
      let cached: InfoSnapshot | null = null;

      const messages = new Set<string>();

      try {
        const stored =
          await loadInfoSnapshot(location.id);

        // Avoid restoring data for changed coordinates.
        if (
          stored &&
          stored.latitude === latitude &&
          stored.longitude === longitude
        ) {
          cached = stored;
        }
      } catch {
        messages.add(
          "Saved information could not be loaded.",
        );
      }

      if (signal.aborted) return;

      let localPlaces = cached?.places ?? [];
      let localCity = cached?.cityInfo ?? null;

      let localCityStatus: CityStatus =
        cached?.cityStatus ?? "loading";

      let localPlacesDate =
        cached?.placesUpdatedAt ?? null;

      let localCityDate =
        cached?.cityUpdatedAt ?? null;

      // Old transient states should not remain as spinners offline.
      localPlaces = localPlaces.map((place) => ({
        ...place,
        wikiStatus:
          place.wikipedia
            ? "found"
            : place.wikiStatus === "loading"
              ? "error"
              : place.wikiStatus,
      }));

      if (
        localCityStatus === "loading" &&
        cached
      ) {
        localCityStatus = localCity
          ? "found"
          : "not-found";
      }

      setPlaces(localPlaces);
      setCityInfo(localCity);
      setCityStatus(localCityStatus);
      setPlacesUpdatedAt(localPlacesDate);
      setCityUpdatedAt(localCityDate);

      if (cached) {
        setLoading(false);
      }

      if (
        !isValidLocation(latitude, longitude)
      ) {
        setNotice(
          "Select a location with valid coordinates.",
        );
        setCityStatus("not-found");
        setLoading(false);
        return;
      }

      setRefreshing(true);

      let placesSucceeded = false;
      let citySucceeded = false;

      const cachedById = new Map(
        localPlaces.map((place) => [
          place.public_id,
          place,
        ]),
      );

      async function loadCity(): Promise<void> {
        try {
          // Reuse the saved city identity when available.
          let city = localCity;

          if (!city) {
            if (
              Platform.OS !== "android" &&
              Platform.OS !== "ios"
            ) {
              localCityStatus = "unsupported";
              setCityStatus(localCityStatus);
              return;
            }

            if (Platform.OS === "android") {
              let permission =
                await ExpoLocation
                  .getForegroundPermissionsAsync();

              if (signal.aborted) return;

              if (
                !permission.granted &&
                permission.canAskAgain
              ) {
                permission =
                  await ExpoLocation
                    .requestForegroundPermissionsAsync();
              }

              if (signal.aborted) return;

              if (!permission.granted) {
                localCityStatus =
                  "permission-denied";

                setCityStatus(localCityStatus);
                return;
              }
            }

            const addresses =
              await ExpoLocation.reverseGeocodeAsync({
                latitude,
                longitude,
              });

            if (signal.aborted) return;

            const address = addresses.find(
              (item) => item.city?.trim(),
            );

            const cityName = address?.city?.trim();

            if (!cityName) {
              localCityStatus = "not-found";
              setCityStatus(localCityStatus);
              return;
            }

            city = {
              name: cityName,
              country: address?.country ?? null,
              wikipedia: null,
            };

            citySucceeded = true;
            localCityDate =
              new Date().toISOString();
          }

          localCity = city;
          setCityInfo(city);

          try {
            const article =
              await findWikipediaArticle(
                city.name,
                signal,
              );

            if (signal.aborted) return;

            localCity = {
              ...city,
              wikipedia: article,
            };

            localCityStatus = "found";
            localCityDate =
              new Date().toISOString();

            citySucceeded = true;

            setCityInfo(localCity);
            setCityStatus(localCityStatus);
          } catch {
            if (signal.aborted) return;

            // Keep a previously found article.
            localCityStatus = city.wikipedia
              ? "found"
              : "wiki-error";

            setCityStatus(localCityStatus);

            messages.add(
              "Some Wikipedia information could not be updated.",
            );
          }
        } catch {
          if (signal.aborted) return;

          localCityStatus = localCity
            ? localCity.wikipedia
              ? "found"
              : "wiki-error"
            : "error";

          setCityStatus(localCityStatus);

          messages.add(
            "City information could not be updated.",
          );
        }
      }

      async function enrichPlaces(
        results: TourismPlace[],
      ): Promise<void> {
        let nextIndex = 0;

        const lookups = new Map<
          string,
          Promise<WikipediaArticle | null>
        >();

        async function worker(): Promise<void> {
          while (!signal.aborted) {
            const index = nextIndex++;

            if (index >= results.length) return;

            const place = results[index];
            const name = place.name.trim();

            const previous =
              cachedById.get(place.public_id);

            let wikipedia =
              previous?.wikipedia ?? null;

            let wikiStatus:
              PlaceWithWikipedia["wikiStatus"];

            try {
              let lookup = lookups.get(name);

              if (!lookup) {
                lookup = findWikipediaArticle(
                  name,
                  signal,
                );

                lookups.set(name, lookup);
              }

              wikipedia = await lookup;

              wikiStatus = wikipedia
                ? "found"
                : "not-found";
            } catch {
              if (signal.aborted) return;

              wikiStatus = wikipedia
                ? "found"
                : "error";

              messages.add(
                "Some Wikipedia information could not be updated.",
              );
            }

            if (signal.aborted) return;

            localPlaces[index] = {
              ...place,
              wikipedia,
              wikiStatus,
            };

            setPlaces([...localPlaces]);
          }
        }

        await Promise.all(
          Array.from(
            {
              length: Math.min(
                WIKIPEDIA_CONCURRENCY,
                results.length,
              ),
            },
            () => worker(),
          ),
        );
      }

      async function loadPlaces(): Promise<void> {
        try {
          const results =
            await getTourismPlacesWithin5Km({
              apiKey: WOOSMAP_API_KEY,
              location: {
                latitude,
                longitude,
              },
              signal,
            });

          if (signal.aborted) return;

          placesSucceeded = true;

          localPlacesDate =
            new Date().toISOString();

          localPlaces = results.map((place) => {
            const previous =
              cachedById.get(place.public_id);

            return {
              ...place,
              wikipedia:
                previous?.wikipedia ?? null,
              wikiStatus: "loading",
            };
          });

          setPlaces([...localPlaces]);
          setPlacesUpdatedAt(localPlacesDate);
          setLoading(false);

          await enrichPlaces(results);
        } catch (cause) {
          if (signal.aborted) return;

          messages.add(
            cached?.placesUpdatedAt
              ? "Nearby information could not be updated. " +
                  "Showing saved places."
              : "We couldn't load nearby places. " +
                  "Check your internet connection and try again.",
          );

          if (__DEV__) {
            console.log(
              "Info request diagnostic:",
              cause instanceof Error
                ? cause.message
                : String(cause),
            );
          }
        } finally {
          if (!signal.aborted) {
            setLoading(false);
          }
        }
      }

      await Promise.all([
        loadCity(),
        loadPlaces(),
      ]);

      if (signal.aborted) return;

      setPlacesUpdatedAt(localPlacesDate);
      setCityUpdatedAt(localCityDate);

      // Do not replace a saved snapshot with a total network failure.
      if (placesSucceeded || citySucceeded) {
        try {
          await saveInfoSnapshot({
            locationId: location.id,
            locationName:
              location.real_location,
            latitude,
            longitude,
            cityInfo: localCity,
            cityStatus: localCityStatus,
            places: localPlaces,
            placesUpdatedAt: localPlacesDate,
            cityUpdatedAt: localCityDate,
          });
        } catch {
          messages.add(
            "The latest information could not be saved for offline use.",
          );
        }
      }

      if (signal.aborted) return;

      setNotice(
        messages.size > 0
          ? [...messages].join(" ")
          : null,
      );

      setLoading(false);
      setRefreshing(false);
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    location.id,
    location.real_location,
    latitude,
    longitude,
    attempt,
  ]);

  function openWikipedia(
    article: WikipediaArticle,
  ): void {
    navigation.navigate("Wikipedia", {
      title: article.title,
      url: article.url,
    });
  }

  function renderArticleName(
    name: string,
    article: WikipediaArticle | null,
    searching: boolean,
  ) {
    if (article) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            `Open Wikipedia article for ${name}`
          }
          onPress={() => openWikipedia(article)}
          style={({ pressed }) => [
            styles.nameRow,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.name, styles.link]}
          >
            {name}
          </Text>

          <Text
            accessible={false}
            style={styles.arrow}
          >
            ›
          </Text>
        </Pressable>
      );
    }

    return (
      <View style={styles.nameRow}>
        <Text style={styles.name}>
          {name}
        </Text>

        {searching && (
          <ActivityIndicator
            size="small"
            style={styles.wikiSpinner}
          />
        )}
      </View>
    );
  }

  function renderCityInfo() {
    let unavailableMessage =
      "No city could be identified for this location.";

    if (cityStatus === "permission-denied") {
      unavailableMessage =
        "Location permission is required to identify the city.";
    } else if (cityStatus === "unsupported") {
      unavailableMessage =
        "City detection is available on Android and iOS.";
    } else if (cityStatus === "error") {
      unavailableMessage =
        "City information is unavailable. " +
        "Connect to the internet and try again.";
    }

    const article = cityInfo?.wikipedia;

    return (
      <View style={styles.citySection}>
        <Text style={styles.heading}>
          City Info
        </Text>

        <View style={styles.card}>
          {cityInfo ? (
            <>
              {renderArticleName(
                cityInfo.name,
                article ?? null,
                cityStatus === "loading",
              )}

              {cityInfo.country && (
                <Text style={styles.address}>
                  {cityInfo.country}
                </Text>
              )}

              {article && (
                <Text style={styles.wikiHint}>
                  Wikipedia: {article.title}
                  {" · "}
                  {LANGUAGE_LABELS[
                    article.language
                  ]}
                </Text>
              )}

              {cityStatus === "found" &&
                !article && (
                  <Text style={styles.wikiHint}>
                    No exact Wikipedia article was
                    found for this city.
                  </Text>
                )}

              {cityStatus === "wiki-error" && (
                <Text style={styles.wikiHint}>
                  Wikipedia information is
                  temporarily unavailable.
                </Text>
              )}

              {cityUpdatedAt && (
                <Text style={styles.wikiHint}>
                  Last updated:{" "}
                  {formatDate(cityUpdatedAt)}
                </Text>
              )}
            </>
          ) : cityStatus === "loading" ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" />

              <Text style={styles.rowText}>
                Loading city information…
              </Text>
            </View>
          ) : (
            <Text style={styles.empty}>
              {unavailableMessage}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList<PlaceWithWikipedia>
        data={places}
        keyExtractor={(item) =>
          item.public_id
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.offlineBanner}>
              <Text style={styles.bannerTitle}>
                Information and offline reading
              </Text>

              <Text style={styles.bannerText}>
                Place information is saved
                automatically after loading.
                Open a Wikipedia article while
                connected to save its text for
                offline reading.
              </Text>

              {refreshing && (
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" />

                  <Text style={styles.rowText}>
                    Checking for updated information…
                  </Text>
                </View>
              )}

              {notice && (
                <Text style={styles.noticeText}>
                  {notice}
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={
                  loading || refreshing
                }
                onPress={() =>
                  setAttempt(
                    (value) => value + 1,
                  )
                }
                style={[
                  styles.refreshButton,
                  (loading || refreshing) &&
                    styles.disabled,
                ]}
              >
                <Text
                  style={styles.refreshButtonText}
                >
                  Refresh information
                </Text>
              </Pressable>
            </View>

            {renderCityInfo()}

            <Text style={styles.heading}>
              Nearby Attractions
            </Text>

            {placesUpdatedAt && (
              <Text style={styles.count}>
                Last updated:{" "}
                {formatDate(placesUpdatedAt)}
              </Text>
            )}

            {!loading && (
              <Text style={styles.count}>
                {places.length === 1
                  ? "1 place found"
                  : `${places.length} places found`}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.status}>
              <ActivityIndicator size="large" />

              <Text style={styles.statusText}>
                Loading nearby information…
              </Text>
            </View>
          ) : (
            <Text style={styles.empty}>
              {placesUpdatedAt
                ? "No tourist attractions were found in the saved or latest result."
                : "No saved places are available yet. Connect to the internet and refresh."}
            </Text>
          )
        }
        renderItem={({ item }) => {
          const article = item.wikipedia;

          const categories = item.types
            .filter(
              (type) =>
                type !== "point_of_interest",
            )
            .join(", ");

          return (
            <View style={styles.card}>
              {renderArticleName(
                item.name,
                article,
                item.wikiStatus === "loading",
              )}

              {article && (
                <Text style={styles.wikiHint}>
                  Wikipedia: {article.title}
                  {" · "}
                  {LANGUAGE_LABELS[
                    article.language
                  ]}
                </Text>
              )}

              {item.wikiStatus === "error" && (
                <Text style={styles.wikiHint}>
                  Wikipedia information is
                  temporarily unavailable.
                </Text>
              )}

              {item.formatted_address ? (
                <Text style={styles.address}>
                  {item.formatted_address}
                </Text>
              ) : null}

              {categories ? (
                <Text style={styles.category}>
                  {categories}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    color: "#0f172a",
  },
  citySection: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#0f172a",
  },
  link: {
    color: "#2563eb",
  },
  arrow: {
    marginLeft: 12,
    fontSize: 32,
    color: "#2563eb",
  },
  wikiSpinner: {
    marginLeft: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  wikiHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748b",
  },
  address: {
    marginTop: 6,
    color: "#475569",
  },
  category: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748b",
  },
  empty: {
    color: "#475569",
    lineHeight: 21,
  },
  count: {
    marginBottom: 12,
    color: "#64748b",
  },
  status: {
    paddingVertical: 24,
    alignItems: "center",
  },
  statusText: {
    marginTop: 12,
    color: "#64748b",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
    marginLeft: 10,
    color: "#64748b",
  },
  offlineBanner: {
    padding: 16,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e3a8a",
    marginBottom: 6,
  },
  bannerText: {
    color: "#475569",
    lineHeight: 20,
  },
  noticeText: {
    marginTop: 10,
    color: "#475569",
    lineHeight: 20,
  },
  refreshButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2563eb",
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
});