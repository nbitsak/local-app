import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useSelectedLocation,
} from "../SelectedLocationContext";

import {
  getForecasts,
  type ForecastResult,
} from "../../services/xweatherForecast";

import {
  getSavedWeatherForecast,
  listSavedWeatherForecasts,
  saveWeatherForecast,
  type SavedForecast,
  type SavedForecastSummary,
} from "../../services/weatherDatabase";

// Testing only. Use your existing credentials here.
const XWEATHER_CLIENT_ID =
  "oJmFhaLyES3fAlD3O88s";

const XWEATHER_CLIENT_SECRET =
  "Q5oQYsfWMCNloYzDYeObKvCYxHbjboIHddzwjcxU";

type CurrentForecast = {
  data: ForecastResult;
  fetchedAt: string;
};

function temperature(
  value: number | null,
): string {
  return value == null
    ? "—"
    : `${Math.round(value)}°C`;
}

function weatherIcon(
  description: string | null | undefined,
): string {
  const weather =
    description?.toLowerCase() ?? "";

  if (/thunder|lightning/.test(weather)) {
    return "⛈️";
  }

  if (
    /sleet|hail|freezing rain|ice pellets/.test(
      weather,
    )
  ) {
    return "🌨️";
  }

  if (/snow|flurr|blizzard/.test(weather)) {
    return "❄️";
  }

  if (/rain|shower|drizzle/.test(weather)) {
    return "🌧️";
  }

  if (/fog|mist|haze|smoke/.test(weather)) {
    return "🌫️";
  }

  if (/mostly cloudy|overcast/.test(weather)) {
    return "☁️";
  }

  if (
    /partly cloudy|partly sunny|mostly sunny|fair/.test(
      weather,
    )
  ) {
    return "🌤️";
  }

  if (/cloud/.test(weather)) {
    return "☁️";
  }

  if (/wind|breez|gust/.test(weather)) {
    return "💨";
  }

  if (/sun|clear/.test(weather)) {
    return "☀️";
  }

  return "🌡️";
}

function getForecastErrorMessage(
  cause: unknown,
): string {
  const technicalMessage =
    cause instanceof Error
      ? cause.message
      : String(cause);

  const isConnectionError =
    /offline|network|internet|failed to fetch|fetch failed|connection|timed?\s*out|timeout|unable to resolve host/i.test(
      technicalMessage,
    );

  if (isConnectionError) {
    return (
      "We couldn't connect to the weather service. " +
      "Check your internet connection and try again. " +
      "You can still open any forecasts you have saved."
    );
  }

  return (
    "We couldn't load the latest forecast right now. " +
    "Please try again later. " +
    "Any saved forecasts are still available."
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatForecastDate(
  iso: string,
  timezone: string,
  hourly: boolean,
): string {
  const date = new Date(iso);

  if (!Number.isFinite(date.getTime())) {
    return iso;
  }

  const options: Intl.DateTimeFormatOptions =
    hourly
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      : {
          weekday: "short",
          day: "numeric",
          month: "short",
        };

  try {
    return new Intl.DateTimeFormat("en-GB", {
      ...options,
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      "en-GB",
      options,
    ).format(date);
  }
}

function hasValidCoordinates(
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

function ForecastContent({
  forecast,
  historical,
}: {
  forecast: ForecastResult;
  historical: boolean;
}) {
  return (
    <>
      <Text style={styles.heading}>
        {historical
          ? "Daily summary at retrieval"
          : "Today"}
      </Text>

      {forecast.today ? (
        <View style={styles.card}>
          <View style={styles.weatherRow}>
            <Text style={styles.weatherIcon}>
              {weatherIcon(
                forecast.today.weather,
              )}
            </Text>

            <Text style={styles.weatherText}>
              {forecast.today.weather ??
                "Conditions unavailable"}
            </Text>
          </View>

          <Text>
            High:{" "}
            {temperature(
              forecast.today.maxTempC,
            )}
            {" · "}
            Low:{" "}
            {temperature(
              forecast.today.minTempC,
            )}
          </Text>

          <Text>
            Chance of precipitation:{" "}
            {forecast.today.pop ?? "—"}%
          </Text>
        </View>
      ) : (
        <Text>
          No daily summary available.
        </Text>
      )}

      <Text style={styles.heading}>
        {historical
          ? "Hourly forecast at retrieval"
          : "Remaining hours today"}
      </Text>

      {forecast.todayHourly.length === 0 ? (
        <Text>
          No hourly periods available.
        </Text>
      ) : (
        forecast.todayHourly.map((period) => (
          <View
            key={period.timestamp}
            style={styles.card}
          >
            <Text style={styles.label}>
              {formatForecastDate(
                period.dateTimeISO,
                forecast.timezone,
                true,
              )}
              {" · "}
              {temperature(period.tempC)}
            </Text>

            <View style={styles.weatherRow}>
              <Text style={styles.weatherIcon}>
                {weatherIcon(period.weather)}
              </Text>

              <Text style={styles.weatherText}>
                {period.weather ?? "—"}
              </Text>
            </View>

            <Text>
              Precipitation chance:{" "}
              {period.pop ?? "—"}%
            </Text>
          </View>
        ))
      )}

      <Text style={styles.heading}>
        {forecast.week.length}-day forecast
      </Text>

      {forecast.week.map((period) => (
        <View
          key={period.timestamp}
          style={styles.card}
        >
          <Text style={styles.label}>
            {formatForecastDate(
              period.dateTimeISO,
              forecast.timezone,
              false,
            )}
          </Text>

          <View style={styles.weatherRow}>
            <Text style={styles.weatherIcon}>
              {weatherIcon(period.weather)}
            </Text>

            <Text style={styles.weatherText}>
              {period.weather ?? "—"}
            </Text>
          </View>

          <Text>
            High: {temperature(period.maxTempC)}
            {" · "}
            Low: {temperature(period.minTempC)}
          </Text>

          <Text>
            Precipitation chance:{" "}
            {period.pop ?? "—"}%
          </Text>
        </View>
      ))}
    </>
  );
}

export default function WeatherTab() {
  const location = useSelectedLocation();

  const rawLatitude = location.latitude;
  const rawLongitude = location.longitude;

  const latitude =
    rawLatitude == null ||
    String(rawLatitude).trim() === ""
      ? NaN
      : Number(rawLatitude);

  const longitude =
    rawLongitude == null ||
    String(rawLongitude).trim() === ""
      ? NaN
      : Number(rawLongitude);

  const locationKey =
    `${location.id}:${latitude}:${longitude}`;

  const scopeRef = useRef(locationKey);
  scopeRef.current = locationKey;

  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const openRequestRef = useRef(0);

  const [currentForecast, setCurrentForecast] =
    useState<CurrentForecast | null>(null);

  const [forecastScope, setForecastScope] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshAttempt, setRefreshAttempt] =
    useState(0);

  const [savedForecasts, setSavedForecasts] =
    useState<SavedForecastSummary[]>([]);

  const [historyScope, setHistoryScope] =
    useState<string | null>(null);

  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [historyError, setHistoryError] =
    useState<string | null>(null);

  const [historyAttempt, setHistoryAttempt] =
    useState(0);

  const [selectedSaved, setSelectedSaved] =
    useState<SavedForecast | null>(null);

  const [openingId, setOpeningId] =
    useState<number | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [savedFetchedAt, setSavedFetchedAt] =
    useState<string | null>(null);

  const [storageMessage, setStorageMessage] =
    useState<string | null>(null);

  const [storageError, setStorageError] =
    useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      openRequestRef.current++;
    };
  }, []);

  // Load the online forecast independently of saved history.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);
    setCurrentForecast(null);
    setForecastScope(null);
    setSavedFetchedAt(null);

    async function load(): Promise<void> {
      try {
        if (
          !hasValidCoordinates(
            latitude,
            longitude,
          )
        ) {
          throw new Error(
            "Select a location with valid coordinates.",
          );
        }

        if (
          XWEATHER_CLIENT_ID ===
            "YOUR_XWEATHER_CLIENT_ID" ||
          XWEATHER_CLIENT_SECRET ===
            "YOUR_XWEATHER_CLIENT_SECRET"
        ) {
          throw new Error(
            "Set your Xweather credentials to load a new forecast.",
          );
        }

        const result = await getForecasts({
          latitude,
          longitude,
          clientId: XWEATHER_CLIENT_ID,
          clientSecret: XWEATHER_CLIENT_SECRET,
          signal: controller.signal,
        });

        if (!active) return;

        setCurrentForecast({
          data: result,
          fetchedAt: new Date().toISOString(),
        });

        setForecastScope(locationKey);
      } catch (cause) {
        if (!active) return;

        // Display a friendly message instead of the raw API error.
        setError(getForecastErrorMessage(cause));

        // Keep technical details in development logs only.
        if (__DEV__) {
          console.log(
            "Forecast request diagnostic:",
            cause instanceof Error
              ? cause.message
              : String(cause),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    locationKey,
    latitude,
    longitude,
    refreshAttempt,
  ]);

  // Reset the displayed saved snapshot when location changes.
  useEffect(() => {
    openRequestRef.current++;

    setSelectedSaved(null);
    setOpeningId(null);
    setStorageMessage(null);
    setStorageError(null);
  }, [locationKey]);

  // Load saved history even if the online request fails.
  useEffect(() => {
    let active = true;

    setHistoryLoading(true);
    setHistoryError(null);
    setSavedForecasts([]);
    setHistoryScope(null);

    async function loadHistory(): Promise<void> {
      try {
        const rows =
          await listSavedWeatherForecasts(
            location.id,
          );

        if (!active) return;

        setSavedForecasts(rows);
        setHistoryScope(locationKey);
      } catch (cause) {
        if (!active) return;

        setHistoryError(
          cause instanceof Error
            ? cause.message
            : "Unable to load saved forecasts.",
        );
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, [
    location.id,
    locationKey,
    historyAttempt,
  ]);

  const current =
    forecastScope === locationKey
      ? currentForecast
      : null;

  const history =
    historyScope === locationKey
      ? savedForecasts
      : [];

  const savedView =
    selectedSaved?.location_id === location.id
      ? selectedSaved
      : null;

  const displayedForecast =
    savedView?.forecast ??
    current?.data ??
    null;

  const alreadySaved =
    current !== null &&
    savedFetchedAt === current.fetchedAt;

  async function handleSaveForecast():
    Promise<void> {
    if (
      !current ||
      savedView ||
      savingRef.current ||
      alreadySaved
    ) {
      return;
    }

    const requestScope = locationKey;
    const snapshot = current;

    savingRef.current = true;
    setSaving(true);
    setStorageMessage(null);
    setStorageError(null);

    try {
      await saveWeatherForecast({
        location: {
          id: location.id,
          name: location.real_location,
          latitude,
          longitude,
        },
        forecast: snapshot.data,
        fetchedAt: snapshot.fetchedAt,
      });

      if (
        !mountedRef.current ||
        scopeRef.current !== requestScope
      ) {
        return;
      }

      setSavedFetchedAt(snapshot.fetchedAt);
      setStorageMessage("Forecast saved.");

      // Refresh the list without repeating the weather request.
      setHistoryAttempt(
        (attempt) => attempt + 1,
      );
    } catch (cause) {
      if (
        !mountedRef.current ||
        scopeRef.current !== requestScope
      ) {
        return;
      }

      setStorageError(
        cause instanceof Error
          ? cause.message
          : "Unable to save the forecast.",
      );
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }

  async function openSavedForecast(
    id: number,
  ): Promise<void> {
    const requestScope = locationKey;
    const requestId =
      ++openRequestRef.current;

    setOpeningId(id);
    setStorageMessage(null);
    setStorageError(null);

    try {
      const saved =
        await getSavedWeatherForecast(
          id,
          location.id,
        );

      if (
        !mountedRef.current ||
        scopeRef.current !== requestScope ||
        openRequestRef.current !== requestId
      ) {
        return;
      }

      if (!saved) {
        throw new Error(
          "The saved forecast was not found.",
        );
      }

      setSelectedSaved(saved);
    } catch (cause) {
      if (
        !mountedRef.current ||
        scopeRef.current !== requestScope ||
        openRequestRef.current !== requestId
      ) {
        return;
      }

      setStorageError(
        cause instanceof Error
          ? cause.message
          : "Unable to open the saved forecast.",
      );
    } finally {
      if (
        mountedRef.current &&
        scopeRef.current === requestScope &&
        openRequestRef.current === requestId
      ) {
        setOpeningId(null);
      }
    }
  }

  function showCurrentForecast() {
    openRequestRef.current++;

    setOpeningId(null);
    setSelectedSaved(null);
    setStorageMessage(null);
    setStorageError(null);
  }

  function refreshCurrentForecast() {
    if (loading || savingRef.current) return;

    showCurrentForecast();

    setRefreshAttempt(
      (attempt) => attempt + 1,
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
    >
      <Text style={styles.locationTitle}>
        Weather for {location.real_location}
      </Text>

      <View style={styles.historySection}>
        <Text style={styles.sectionHeading}>
          Saved forecasts
        </Text>

        <Text style={styles.hint}>
          Select a saved forecast to view it without
          requesting new weather data.
        </Text>

        {historyLoading && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" />

            <Text style={styles.statusText}>
              Loading saved forecasts…
            </Text>
          </View>
        )}

        {historyError && (
          <>
            <Text
              accessibilityRole="alert"
              style={styles.error}
            >
              {historyError}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setHistoryAttempt(
                  (attempt) => attempt + 1,
                )
              }
              style={styles.secondaryButton}
            >
              <Text
                style={styles.secondaryButtonText}
              >
                Retry loading history
              </Text>
            </Pressable>
          </>
        )}

        {!historyLoading &&
          !historyError &&
          history.length === 0 && (
            <Text style={styles.hint}>
              No forecasts have been saved for this
              location.
            </Text>
          )}

        {history.map((item) => {
          const selected =
            savedView?.id === item.id;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{
                selected,
                busy: openingId === item.id,
              }}
              onPress={() =>
                void openSavedForecast(item.id)
              }
              style={({ pressed }) => [
                styles.historyCard,
                selected &&
                  styles.historyCardSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.label}>
                {item.location_name}
              </Text>

              <Text>
                Saved:{" "}
                {formatDateTime(item.saved_at)}
              </Text>

              <Text style={styles.hintSmall}>
                Retrieved:{" "}
                {formatDateTime(item.fetched_at)}
              </Text>

              {openingId === item.id && (
                <ActivityIndicator
                  size="small"
                  style={styles.itemSpinner}
                />
              )}

              {selected && (
                <Text style={styles.selectedText}>
                  Viewing this saved forecast
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {storageMessage && (
        <Text style={styles.success}>
          {storageMessage}
        </Text>
      )}

      {storageError && (
        <Text
          accessibilityRole="alert"
          style={styles.error}
        >
          {storageError}
        </Text>
      )}

      {savedView ? (
        <View style={styles.snapshotBanner}>
          <Text style={styles.label}>
            Saved forecast
          </Text>

          <Text>
            Retrieved:{" "}
            {formatDateTime(savedView.fetched_at)}
          </Text>

          <Text>
            Saved:{" "}
            {formatDateTime(savedView.saved_at)}
          </Text>

          <Text style={styles.snapshotNote}>
            This is a historical forecast snapshot,
            not a new forecast or a record of the
            actual weather.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={showCurrentForecast}
            style={styles.secondaryButton}
          >
            <Text
              style={styles.secondaryButtonText}
            >
              Back to current forecast
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.sectionHeading}>
            Current forecast
          </Text>

          {loading && (
            <View style={styles.statusRow}>
              <ActivityIndicator />

              <Text style={styles.statusText}>
                Loading current forecast…
              </Text>
            </View>
          )}

          {error && (
            <View
              accessibilityRole="alert"
              style={styles.forecastNotice}
            >
              <Text
                style={styles.forecastNoticeTitle}
              >
                Latest forecast unavailable
              </Text>

              <Text
                style={styles.forecastNoticeText}
              >
                {error}
              </Text>
            </View>
          )}

          {current && (
            <>
              <Text style={styles.hint}>
                Retrieved:{" "}
                {formatDateTime(current.fetchedAt)}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: saving || alreadySaved,
                  busy: saving,
                }}
                disabled={saving || alreadySaved}
                onPress={() =>
                  void handleSaveForecast()
                }
                style={({ pressed }) => [
                  styles.primaryButton,
                  (saving || alreadySaved) &&
                    styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={styles.primaryButtonText}
                >
                  {saving
                    ? "Saving..."
                    : alreadySaved
                      ? "Forecast saved"
                      : "Save forecast"}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: loading || saving,
            }}
            disabled={loading || saving}
            onPress={refreshCurrentForecast}
            style={({ pressed }) => [
              styles.secondaryButton,
              (loading || saving) &&
                styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={styles.secondaryButtonText}
            >
              Refresh current forecast
            </Text>
          </Pressable>
        </>
      )}

      {displayedForecast && (
        <ForecastContent
          forecast={displayedForecast}
          historical={savedView !== null}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  locationTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },
  historySection: {
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  sectionHeading: {
    fontSize: 21,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    marginBottom: 12,
  },
  hintSmall: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 5,
  },
  historyCard: {
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  historyCardSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  selectedText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#1d4ed8",
  },
  itemSpinner: {
    marginTop: 10,
  },
  snapshotBanner: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    marginBottom: 12,
  },
  snapshotNote: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#9a3412",
  },
  forecastNotice: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
  },
  forecastNoticeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  forecastNoticeText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
  },
  card: {
    padding: 16,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: "#eef2f6",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  weatherIcon: {
    fontSize: 30,
    marginRight: 10,
  },
  weatherText: {
    flex: 1,
    fontSize: 15,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  statusText: {
    flex: 1,
    marginLeft: 10,
    color: "#64748b",
  },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  success: {
    color: "#15803d",
    marginBottom: 12,
  },
  error: {
    color: "#b91c1c",
    marginBottom: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});