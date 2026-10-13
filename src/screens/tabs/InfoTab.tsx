import React, { useEffect, useState } from "react";
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

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from
  "@react-navigation/native-stack";

import {
  getTourismPlacesWithin5Km,
} from "../../services/woosmapTourism";
import type {
  TourismPlace,
} from "../../services/woosmapTourism";

import {
  findWikipediaArticle,
} from "../../services/wikipedia";
import type {
  WikipediaArticle,
} from "../../services/wikipedia";

import type { RootStackParamList } from "../../navigation/types";
import { useSelectedLocation } from "../SelectedLocationContext";

type PlaceWithWikipedia = TourismPlace & {
  wikipedia: WikipediaArticle | null;
  wikiStatus: "loading" | "found" | "not-found" | "error";
};

type CityInfo = {
  name: string;
  country: string | null;
  wikipedia: WikipediaArticle | null;
};

type CityStatus =
  | "loading"
  | "found"
  | "not-found"
  | "wiki-error"
  | "permission-denied"
  | "unsupported"
  | "error";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const WOOSMAP_API_KEY = "789357b7-df18-41af-b04d-290c988618b5";
const WIKIPEDIA_CONCURRENCY = 3;

const WIKIPEDIA_LANGUAGE_LABELS: Record<
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

export default function InfoTab() {
  const navigation = useNavigation<Navigation>();
  const location = useSelectedLocation();

  const rawLatitude = location?.latitude;
  const rawLongitude = location?.longitude;

  const latitude =
    rawLatitude == null || String(rawLatitude).trim() === ""
      ? NaN
      : Number(rawLatitude);

  const longitude =
    rawLongitude == null || String(rawLongitude).trim() === ""
      ? NaN
      : Number(rawLongitude);

  const [places, setPlaces] = useState<PlaceWithWikipedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cityInfo, setCityInfo] = useState<CityInfo | null>(null);
  const [cityStatus, setCityStatus] =
    useState<CityStatus>("loading");

  // Identify the city independently of the attractions request.
  useEffect(() => {
    const controller = new AbortController();

    setCityInfo(null);

    if (!isValidLocation(latitude, longitude)) {
      setCityStatus("not-found");
      return () => controller.abort();
    }

    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      setCityStatus("unsupported");
      return () => controller.abort();
    }

    setCityStatus("loading");

    async function loadCityInfo(): Promise<void> {
      try {
        if (Platform.OS === "android") {
          let permission =
            await ExpoLocation.getForegroundPermissionsAsync();

          if (controller.signal.aborted) {
            return;
          }

          if (!permission.granted && permission.canAskAgain) {
            permission =
              await ExpoLocation.requestForegroundPermissionsAsync();
          }

          if (controller.signal.aborted) {
            return;
          }

          if (!permission.granted) {
            setCityStatus("permission-denied");
            return;
          }
        }

        const addresses =
          await ExpoLocation.reverseGeocodeAsync({
            latitude,
            longitude,
          });

        // Ignore stale results from native reverse geocoding.
        if (controller.signal.aborted) {
          return;
        }

        const address = addresses.find(
          (item) => Boolean(item.city?.trim()),
        );

        const cityName = address?.city?.trim();

        if (!cityName) {
          setCityStatus("not-found");
          return;
        }

        const city: CityInfo = {
          name: cityName,
          country: address?.country ?? null,
          wikipedia: null,
        };

        setCityInfo(city);

        try {
          const article = await findWikipediaArticle(
            cityName,
            controller.signal,
          );

          if (controller.signal.aborted) {
            return;
          }

          setCityInfo({
            ...city,
            wikipedia: article,
          });

          setCityStatus("found");
        } catch {
          if (!controller.signal.aborted) {
            setCityStatus("wiki-error");
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setCityStatus("error");
        }
      }
    }

    void loadCityInfo();

    return () => controller.abort();
  }, [latitude, longitude]);

  // Load attractions and check their Wikipedia titles.
  useEffect(() => {
    const controller = new AbortController();

    if (!isValidLocation(latitude, longitude)) {
      setPlaces([]);
      setError("Select a location with valid coordinates.");
      setLoading(false);

      return () => controller.abort();
    }

    async function enrichWithWikipedia(
      results: TourismPlace[],
    ): Promise<void> {
      let nextIndex = 0;

      const lookups = new Map<
        string,
        Promise<WikipediaArticle | null>
      >();

      async function worker(): Promise<void> {
        while (!controller.signal.aborted) {
          const index = nextIndex++;

          if (index >= results.length) {
            return;
          }

          const place = results[index];
          const name = place.name.trim();

          let wikipedia: WikipediaArticle | null = null;
          let wikiStatus: PlaceWithWikipedia["wikiStatus"];

          try {
            let lookup = lookups.get(name);

            if (!lookup) {
              lookup = findWikipediaArticle(
                name,
                controller.signal,
              );

              lookups.set(name, lookup);
            }

            wikipedia = await lookup;
            wikiStatus = wikipedia ? "found" : "not-found";
          } catch {
            if (controller.signal.aborted) {
              return;
            }

            wikiStatus = "error";
          }

          if (controller.signal.aborted) {
            return;
          }

          setPlaces((current) =>
            current.map((item) =>
              item.public_id === place.public_id
                ? {
                    ...item,
                    wikipedia,
                    wikiStatus,
                  }
                : item,
            ),
          );
        }
      }

      const workerCount = Math.min(
        WIKIPEDIA_CONCURRENCY,
        results.length,
      );

      await Promise.all(
        Array.from(
          { length: workerCount },
          () => worker(),
        ),
      );
    }

    async function loadPlaces(): Promise<void> {
      setLoading(true);
      setError(null);
      setPlaces([]);

      try {
        const results = await getTourismPlacesWithin5Km({
          apiKey: WOOSMAP_API_KEY,
          location: {
            latitude,
            longitude,
          },
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        const initialPlaces: PlaceWithWikipedia[] =
          results.map((place) => ({
            ...place,
            wikipedia: null,
            wikiStatus: "loading",
          }));

        setPlaces(initialPlaces);
        setLoading(false);

        await enrichWithWikipedia(results);
      } catch {
        if (!controller.signal.aborted) {
          setError(
            "Unable to load nearby places. Please try again later.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPlaces();

    return () => controller.abort();
  }, [latitude, longitude]);

  function openWikipedia(article: WikipediaArticle): void {
    navigation.navigate("Wikipedia", {
      title: article.title,
      url: article.url,
    });
  }

  function renderCityInfo() {
    const article = cityInfo?.wikipedia;

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
        "City information could not be loaded.";
    }

    return (
      <View style={styles.citySection}>
        <Text style={styles.heading}>City Info</Text>

        <View style={styles.card}>
          {cityInfo ? (
            <>
              {article ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    `Open Wikipedia article for ${cityInfo.name}`
                  }
                  onPress={() => openWikipedia(article)}
                  style={({ pressed }) => [
                    styles.nameRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.name, styles.link]}>
                    {cityInfo.name}
                  </Text>

                  <Text
                    accessible={false}
                    style={styles.arrow}
                  >
                    ›
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.name}>
                    {cityInfo.name}
                  </Text>

                  {cityStatus === "loading" && (
                    <ActivityIndicator
                      size="small"
                      accessibilityLabel="Searching Wikipedia"
                      style={styles.wikiSpinner}
                    />
                  )}
                </View>
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
                  {WIKIPEDIA_LANGUAGE_LABELS[article.language]}
                </Text>
              )}

              {cityStatus === "found" && !article && (
                <Text style={styles.wikiHint}>
                  No exact Wikipedia article was found for this city.
                </Text>
              )}

              {cityStatus === "wiki-error" && (
                <Text style={styles.wikiError}>
                  Wikipedia search could not be completed.
                </Text>
              )}
            </>
          ) : cityStatus === "loading" ? (
            <View style={styles.cityLoading}>
              <ActivityIndicator size="small" />

              <Text style={styles.cityLoadingText}>
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
        data={loading || error ? [] : places}
        keyExtractor={(item) => item.public_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {renderCityInfo()}

            <Text style={styles.heading}>
              Nearby Attractions
            </Text>

            {!loading && !error && (
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
                Searching for nearby places…
              </Text>
            </View>
          ) : error ? (
            <Text
              accessibilityRole="alert"
              style={styles.error}
            >
              {error}
            </Text>
          ) : (
            <Text style={styles.empty}>
              No tourist attractions were found in this area.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const article = item.wikipedia;

          const categories = item.types
            .filter((type) => type !== "point_of_interest")
            .join(", ");

          return (
            <View style={styles.card}>
              {article ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    `Open Wikipedia article for ${item.name}`
                  }
                  onPress={() => openWikipedia(article)}
                  style={({ pressed }) => [
                    styles.nameRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.name, styles.link]}>
                    {item.name}
                  </Text>

                  <Text
                    accessible={false}
                    style={styles.arrow}
                  >
                    ›
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.name}>
                    {item.name}
                  </Text>

                  {item.wikiStatus === "loading" && (
                    <ActivityIndicator
                      size="small"
                      accessibilityLabel="Searching Wikipedia"
                      style={styles.wikiSpinner}
                    />
                  )}
                </View>
              )}

              {article && (
                <Text style={styles.wikiHint}>
                  Wikipedia: {article.title}
                  {" · "}
                  {WIKIPEDIA_LANGUAGE_LABELS[article.language]}
                </Text>
              )}

              {item.wikiStatus === "error" && (
                <Text style={styles.wikiError}>
                  Wikipedia search could not be completed.
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
    backgroundColor: "#F8FAFC",
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    color: "#0F172A",
  },
  citySection: {
    marginBottom: 12,
  },
  cityLoading: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  cityLoadingText: {
    flex: 1,
    marginLeft: 10,
    color: "#64748B",
  },
  status: {
    paddingVertical: 24,
    alignItems: "center",
  },
  statusText: {
    marginTop: 12,
    color: "#64748B",
  },
  error: {
    color: "#B91C1C",
  },
  count: {
    marginBottom: 12,
    color: "#64748B",
  },
  empty: {
    color: "#475569",
  },
  card: {
    backgroundColor: "#FFFFFF",
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
    color: "#0F172A",
  },
  link: {
    color: "#2563EB",
  },
  arrow: {
    marginLeft: 12,
    fontSize: 32,
    color: "#2563EB",
  },
  wikiSpinner: {
    marginLeft: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  wikiHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },
  wikiError: {
    marginTop: 4,
    fontSize: 12,
    color: "#B45309",
  },
  address: {
    marginTop: 8,
    color: "#475569",
  },
  category: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748B",
  },
});