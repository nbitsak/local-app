import { useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function LocationScreen() {
    const [coordinates, setCoordinates] = 
    useState<Coordinates | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function findLocation() {
        setLoading(true);
        setError(null);

        try {
            const permission =
                await Location.requestForegroundPermissionsAsync();
            
            if (permission.status !== "granted") {
                setError("Permission to access location was denied");
                return;
            }

            const enabled = await Location.hasServicesEnabledAsync();

            if (!enabled) {
                setError("Enable location services on your cellphone.");
                return;
            }

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            setCoordinates({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            });
        } catch (err) {
            setError(
                err instanceof Error
                ? err.message
                : "Could not fetch location. Please try again later."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.controls}>
                <Text>
                      {"\n"}
                </Text>
                <Button 
                    title="Find My Location" 
                    onPress={findLocation}
                    disabled={loading}
                />

                {loading && <ActivityIndicator />}
                {error && <Text style={styles.error}>{error}</Text>}

                {coordinates && (
                    <Text>
                        Latitude: {coordinates.latitude.toFixed(6)}
                        {"\n"}
                        Longitude: {coordinates.longitude.toFixed(6)}
                    </Text>
                )}
            </View>

            {coordinates && (
                <MapView
                    style={styles.map}
                    region={{
                        ...coordinates,
                        latitudeDelta: 0.01, 
                        longitudeDelta: 0.01 
                    }}
                    showsUserLocation
                    >
                        <Marker
                             coordinate={coordinates}
                              title="My position"
                        />
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
    error: {
        color: "red",
    },
});




