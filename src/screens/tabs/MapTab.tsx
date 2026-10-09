import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { useSelectedLocation } from "../SelectedLocationContext";

export default function MapTab() {
  const location = useSelectedLocation();

  const coordinate = {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };

  return (
    <View style={styles.container}>
      <MapView
        key={`${location.id}:${location.latitude}:${location.longitude}`}
        style={styles.map}
        initialRegion={{
          ...coordinate,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
      >
        <Marker
          coordinate={coordinate}
          title={location.real_location ?? "Selected Location"}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});