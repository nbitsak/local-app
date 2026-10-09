import { useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ExpoLocation from "expo-location";

import type { RootStackParamList } from "../navigation/types";

import {
  saveLocationIfFarEnough,
  type SaveLocationResult,
} from "../../database";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [coordinates, setCoordinates] =
    useState<Coordinates | null>(null);

  const [saveResult, setSaveResult] =
    useState<SaveLocationResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [canContinue, setCanContinue] = useState(false);

  // Immediately block repeated button presses
  // before the loading state has updated.
  const requestInProgress = useRef(false);

  function continueToNextScreen() {
    if (loading || !canContinue || !saveResult) return;

    // Use the newly saved location or the existing nearby location.
    const location = saveResult.saved
      ? saveResult.location
      : saveResult.existingLocation;

    navigation.navigate("LocationDetails", {
      location,
    });

    setCanContinue(false);
  }

  async function findAndCheckLocation() {
    if (requestInProgress.current) return;

    requestInProgress.current = true;

    setLoading(true);
    setError(null);
    setWarning(null);
    setSaveResult(null);
    setCoordinates(null);
    setCanContinue(false);

    try {
      const permission =
        await ExpoLocation.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setError("Permission to access location was denied.");
        return;
      }

      const enabled =
        await ExpoLocation.hasServicesEnabledAsync();

      if (!enabled) {
        setError(
          "Please enable location services on your device."
        );
        return;
      }

      const position =
        await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.High,
        });

      const currentCoordinates: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setCoordinates(currentCoordinates);

      let address:
        | ExpoLocation.LocationGeocodedAddress
        | undefined;

      let lookupWarning: string | null = null;

      try {
        const addresses =
          await ExpoLocation.reverseGeocodeAsync(
            currentCoordinates
          );

        address = addresses[0];

        if (!address) {
          lookupWarning =
            "No address was found. The distance check " +
            "and saved location will use the coordinates.";
        }
      } catch {
        lookupWarning =
          "Address lookup failed. The distance check " +
          "and saved location will use the coordinates.";
      }

      const streetAddress = [
        address?.street,
        address?.streetNumber,
      ]
        .filter(Boolean)
        .join(" ");

      const city = address?.city ?? "";

      const readableAddress = [
        streetAddress || address?.name,
        city,
        address?.country,
      ]
        .filter(Boolean)
        .join(", ");

      // Handle an address object with no usable address details.
      if (!readableAddress && !lookupWarning) {
        lookupWarning =
          "No usable address details were returned. " +
          "The coordinates will be used instead.";
      }

      setWarning(lookupWarning);

      const realLocation =
        readableAddress ||
        `GPS location: ${currentCoordinates.latitude.toFixed(6)}, ${
          currentCoordinates.longitude.toFixed(6)
        }`;

      const result = await saveLocationIfFarEnough({
        real_location: realLocation,
        city,
        country_code:
          address?.isoCountryCode?.toUpperCase() ?? "",
        latitude: currentCoordinates.latitude,
        longitude: currentCoordinates.longitude,
        source_url: "",
      });

      setSaveResult(result);

      // Show Continue for both new and existing locations.
      // Navigation happens only when the user presses Continue.
      setCanContinue(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to retrieve or save the location."
      );
    } finally {
      requestInProgress.current = false;
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {/* Display location details and Continue near the top. */}
        <View style={styles.details}>
          {loading && (
            <View style={styles.loadingInfo}>
              <ActivityIndicator />
              <Text>Finding and checking your location…</Text>
            </View>
          )}

          {error && (
            <Text style={styles.error}>{error}</Text>
          )}

          {warning && (
            <Text style={styles.warning}>{warning}</Text>
          )}

          {coordinates && (
            <Text>
              Latitude: {coordinates.latitude.toFixed(6)}
              {"\n"}
              Longitude: {coordinates.longitude.toFixed(6)}
            </Text>
          )}

          {saveResult?.saved === true && (
            <View style={styles.resultInfo}>
              <Text style={styles.success}>
                The new location was saved.
              </Text>

              <Text>ID: {saveResult.location.id}</Text>

              <Text>
                {saveResult.location.real_location}
              </Text>
            </View>
          )}

          {saveResult?.saved === false && (
            <View style={styles.resultInfo}>
              <Text style={styles.warning}>
                No new record was created: a saved location
                already exists within a 100-meter radius.
              </Text>

              <Text>
                Nearby record:{" "}
                {saveResult.existingLocation.real_location}
              </Text>

              <Text>
                ID: {saveResult.existingLocation.id}
              </Text>

              <Text>
                Distance:{" "}
                {saveResult.distanceMeters.toFixed(1)} meters
              </Text>
            </View>
          )}

          {canContinue && !loading && (
            <Pressable
              accessibilityRole="button"
              onPress={continueToNextScreen}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text style={styles.actionButtonText}>
                Continue
              </Text>
            </Pressable>
          )}
        </View>

        {/* Keep the main buttons at the bottom. */}
        <View style={styles.buttons}>
          <Image
              source={require("../../assets/prisma_logo.webp")}
              style={styles.homeImage}
               resizeMode="contain"
               accessibilityLabel="Home illustration"
            />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            onPress={() =>
              navigation.navigate("PreviousLocations")
            }
            style={({ pressed }) => [
              styles.actionButton,
              loading && styles.actionButtonDisabled,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={styles.actionButtonText}>
              Previous Locations
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: loading,
              busy: loading,
            }}
            disabled={loading}
            onPress={findAndCheckLocation}
            style={({ pressed }) => [
              styles.actionButton,
              loading && styles.actionButtonDisabled,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={styles.actionButtonText}>
              {loading
                ? "Checking Location…"
                : "Find and Check My Location"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 40,
    gap: 24,
  },
  details: {
    gap: 12,
  },
  loadingInfo: {
    alignItems: "center",
    gap: 8,
  },
  resultInfo: {
    gap: 6,
  },
  buttons: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: "red",
  },
  warning: {
    color: "#8a5700",
  },
  success: {
    color: "green",
  },
  homeImage: {
    width: "100%",
    height: 200,
    marginBottom: 0,
  },
});