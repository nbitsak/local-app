import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import React, { useEffect, useState } from "react";

import { useSelectedLocation } from "../SelectedLocationContext";

import {
  getForecasts,
  type ForecastResult,
} from "../../services/xweatherForecast";

function temperature(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}°C`;
}

export default function WeatherTab() {

  const location = useSelectedLocation();

  const coordinate = {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };

  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        const result = await getForecasts({
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          // Testing only: see the production note below.
          clientId: "hoJmFhaLyES3fAlD3O88s",
          clientSecret: "Q5oQYsfWMCNloYzDYeObKvCYxHbjboIHddzwjcxU",
          signal: controller.signal,
        });

        if (active) {
          setForecast(result);
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the forecast.",
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
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !forecast) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert">
          {error ?? "No forecast available."}
        </Text>
      </View>
    );
  }

  const formatDay = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: forecast.timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(iso));

  const formatHour = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: forecast.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Today</Text>

      {forecast.today ? (
        <View style={styles.card}>
          <Text>{forecast.today.weather ?? "Conditions unavailable"}</Text>
          <Text>
            High: {temperature(forecast.today.maxTempC)}
            {" · "}
            Low: {temperature(forecast.today.minTempC)}
          </Text>
          <Text>
            Chance of precipitation: {forecast.today.pop ?? "—"}%
          </Text>
        </View>
      ) : (
        <Text>No daily summary available for today.</Text>
      )}

      <Text style={styles.heading}>Remaining hours today</Text>

      {forecast.todayHourly.length === 0 ? (
        <Text>No upcoming hourly periods available for today.</Text>
      ) : (
        forecast.todayHourly.map((period) => (
          <View key={period.timestamp} style={styles.card}>
            <Text style={styles.label}>
              {formatHour(period.dateTimeISO)}
              {" · "}
              {temperature(period.tempC)}
            </Text>
            <Text>{period.weather ?? "—"}</Text>
            <Text>Precipitation chance: {period.pop ?? "—"}%</Text>
          </View>
        ))
      )}

      <Text style={styles.heading}>
        {forecast.week.length}-day forecast
      </Text>

      {forecast.week.map((period) => (
        <View key={period.timestamp} style={styles.card}>
          <Text style={styles.label}>
            {formatDay(period.dateTimeISO)}
          </Text>
          <Text>{period.weather ?? "—"}</Text>
          <Text>
            High: {temperature(period.maxTempC)}
            {" · "}
            Low: {temperature(period.minTempC)}
          </Text>
          <Text>Precipitation chance: {period.pop ?? "—"}%</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 12,
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
});