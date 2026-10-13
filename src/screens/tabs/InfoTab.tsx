import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import React, { useEffect, useState } from "react";

import {
  Coordinates,
  TourismPlace,
  getTourismPlacesWithin5Km,
} from "../../services/woosmapTourism";



import { useSelectedLocation } from "../SelectedLocationContext";

export default function InfoTab(){

  const location = useSelectedLocation();
  
    const coordinate = {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    };

  const [places, setPlaces] = useState<TourismPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPlaces() {
      setLoading(true);
      setError(null);
      setPlaces([]);

      try {
        const results = await getTourismPlacesWithin5Km({
          apiKey: "789357b7-df18-41af-b04d-290c988618b5",
          location: { latitude: coordinate.latitude, longitude: coordinate.longitude },
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setPlaces(results);
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load tourism places.",
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
  }, [coordinate.latitude, coordinate.longitude]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Tourism places within 5 km</Text>

      {loading ? (
        <View style={styles.status}>
          <ActivityIndicator size="large" />
          <Text style={styles.statusText}>Finding nearby places…</Text>
        </View>
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.public_id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.count}>
              {places.length} places found
            </Text>
          }
          ListEmptyComponent={
            <Text>No tourism places were returned for this area.</Text>
          }
          renderItem={({ item }) => {
            const coordinates = item.geometry?.location;

            return (
              <View style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>

                {item.formatted_address && (
                  <Text style={styles.address}>
                    {item.formatted_address}
                  </Text>
                )}

                <Text style={styles.category}>
                  {item.types
                    .filter((type) => type !== "point_of_interest")
                    .join(", ")}
                </Text>

                {coordinates && (
                  <Text style={styles.coordinates}>
                    {coordinates.lat.toFixed(6)},{" "}
                    {coordinates.lng.toFixed(6)}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F8FAFC",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
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
  list: {
    paddingBottom: 24,
  },
  count: {
    marginBottom: 12,
    color: "#64748B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0F172A",
  },
  address: {
    marginTop: 6,
    color: "#475569",
  },
  category: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748B",
  },
  coordinates: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748B",
  },
});