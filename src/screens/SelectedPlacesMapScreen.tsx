import { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type {
  StaticScreenProps,
} from "@react-navigation/native";

import type {
  RootStackParamList,
  SelectedMapPlace,
} from "../navigation/types";

type Props = StaticScreenProps<
  RootStackParamList["SelectedPlacesMap"]
>;

type MapLibrary = typeof import("react-native-maps");
type MapHandle = import("react-native-maps").default;

// Avoid importing the native map implementation on web.
const mapLibrary: MapLibrary | null =
  Platform.OS === "android" || Platform.OS === "ios"
    ? require("react-native-maps")
    : null;

function isValidPlace(place: SelectedMapPlace): boolean {
  return (
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    place.latitude >= -90 &&
    place.latitude <= 90 &&
    place.longitude >= -180 &&
    place.longitude <= 180
  );
}

export default function SelectedPlacesMapScreen({
  route,
}: Props) {
  const mapRef = useRef<MapHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const places = route.params.places.filter(isValidPlace);
  const firstPlace = places[0];

  function fitAllPoints() {
    if (!mapRef.current || !firstPlace) return;

    if (places.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: firstPlace.latitude,
          longitude: firstPlace.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        350,
      );

      return;
    }

    mapRef.current.fitToCoordinates(
      places.map((place) => ({
        latitude: place.latitude,
        longitude: place.longitude,
      })),
      {
        edgePadding: {
          top: 70,
          right: 60,
          bottom: 70,
          left: 60,
        },
        animated: true,
      },
    );
  }

  useEffect(() => {
    if (!mapReady) return;

    const frame = requestAnimationFrame(() => {
      fitAllPoints();
    });

    return () => cancelAnimationFrame(frame);
  }, [mapReady, route.params.places]);

  if (!mapLibrary) {
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>
          Map unavailable on this platform
        </Text>

        <Text style={styles.statusText}>
          This map screen is available on Android and iOS.
        </Text>
      </View>
    );
  }

  if (!firstPlace) {
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>
          No valid map points
        </Text>

        <Text style={styles.statusText}>
          Go back and select places with valid coordinates.
        </Text>
      </View>
    );
  }

  const MapView = mapLibrary.default;
  const Marker = mapLibrary.Marker;

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.heading}>
          Selected places
        </Text>

        <Text style={styles.summaryText}>
          {places.length === 1
            ? "1 point on the map"
            : `${places.length} points on the map`}
        </Text>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                styles.startingDot,
              ]}
            />
            <Text style={styles.legendText}>
              Starting location
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                styles.destinationDot,
              ]}
            />
            <Text style={styles.legendText}>
              Selected destinations
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: firstPlace.latitude,
            longitude: firstPlace.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          onMapReady={() => setMapReady(true)}
          onLayout={() => {
            if (mapReady) fitAllPoints();
          }}
        >
          {places.map((place) => (
            <Marker
              key={place.id}
              identifier={place.id}
              coordinate={{
                latitude: place.latitude,
                longitude: place.longitude,
              }}
              title={place.name}
              description={
                place.isStartingLocation
                  ? "Starting location"
                  : place.formatted_address ??
                    "Selected destination"
              }
              pinColor={
                place.isStartingLocation
                  ? "#2563eb"
                  : "#dc2626"
              }
            />
          ))}
        </MapView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show all selected points on the map"
          onPress={fitAllPoints}
          style={({ pressed }) => [
            styles.fitButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.fitButtonText}>
            Show all points
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  summary: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  summaryText: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  startingDot: {
    backgroundColor: "#2563eb",
  },
  destinationDot: {
    backgroundColor: "#dc2626",
  },
  legendText: {
    fontSize: 12,
    color: "#475569",
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  },
  fitButton: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#0f172a",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fitButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.75,
  },
  statusContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
});