// LocationScreen.tsx
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as ExpoLocation from "expo-location";

import {
  saveLocationIfFarEnough,
  type SaveLocationResult,
} from "./database";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function LocationScreen() {
  const [coordinates, setCoordinates] =
    useState<Coordinates | null>(null);

  const [saveResult, setSaveResult] =
    useState<SaveLocationResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Άμεσο μπλοκάρισμα δεύτερου πατήματος,
  // πριν προλάβει να ενημερωθεί το loading.
  const requestInProgress = useRef(false);

  async function findLocation() {
    if (requestInProgress.current) return;

    requestInProgress.current = true;

    setLoading(true);
    setError(null);
    setWarning(null);
    setSaveResult(null);
    setCoordinates(null);

    try {
      const permission =
        await ExpoLocation.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setError("Δεν δόθηκε άδεια πρόσβασης στην τοποθεσία.");
        return;
      }

      const enabled =
        await ExpoLocation.hasServicesEnabledAsync();

      if (!enabled) {
        setError(
          "Ενεργοποίησε τις υπηρεσίες τοποθεσίας στο κινητό."
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

      try {
        const addresses =
          await ExpoLocation.reverseGeocodeAsync(
            currentCoordinates
          );

        address = addresses[0];

        if (!address) {
          setWarning(
            "Δεν βρέθηκε διεύθυνση. Ο έλεγχος θα γίνει με τις συντεταγμένες."
          );
        }
      } catch {
        setWarning(
          "Η εύρεση διεύθυνσης απέτυχε. Ο έλεγχος θα γίνει με τις συντεταγμένες."
        );
      }

      const streetAddress = [
        address?.street,
        address?.streetNumber,
      ]
        .filter(Boolean)
        .join(" ");

      const city = address?.city ?? "";

      const realLocation =
        [
          streetAddress || address?.name,
          city,
          address?.country,
        ]
          .filter(Boolean)
          .join(", ") ||
        `Θέση GPS: ${currentCoordinates.latitude.toFixed(6)}, ${
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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ο εντοπισμός ή η αποθήκευση απέτυχε."
      );
    } finally {
      requestInProgress.current = false;
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Button
          title="Βρες και έλεγξε τη θέση μου"
          onPress={findLocation}
          disabled={loading}
        />

        {loading && <ActivityIndicator />}

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
              Η νέα τοποθεσία αποθηκεύτηκε.
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
              Δεν δημιουργήθηκε νέα εγγραφή: υπάρχει
              αποθηκευμένη θέση σε ακτίνα 100 μέτρων.
            </Text>

            <Text>
              Κοντινή εγγραφή:{" "}
              {saveResult.existingLocation.real_location}
            </Text>

            <Text>
              ID: {saveResult.existingLocation.id}
            </Text>

            <Text>
              Απόσταση:{" "}
              {saveResult.distanceMeters.toFixed(1)} μέτρα
            </Text>
          </View>
        )}
      </View>

      {coordinates && (
        <MapView
          style={styles.map}
          region={{
            ...coordinates,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
        >
          <Marker
            coordinate={coordinates}
            title="Τρέχουσα θέση"
          />

          {saveResult?.saved === false && (
            <Marker
              coordinate={{
                latitude:
                  saveResult.existingLocation.latitude,
                longitude:
                  saveResult.existingLocation.longitude,
              }}
              title="Κοντινή αποθηκευμένη θέση"
              description={
                saveResult.existingLocation.real_location
              }
              pinColor="blue"
            />
          )}
        </MapView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  controls: {
    padding: 20,
    gap: 12,
  },
  map: {
    flex: 1,
  },
  resultInfo: {
    gap: 4,
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
});