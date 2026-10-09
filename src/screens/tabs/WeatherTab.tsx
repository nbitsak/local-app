import { StyleSheet, Text, View } from "react-native";

import { useSelectedLocation } from "../SelectedLocationContext";

export default function WeatherTab() {
    
  const location = useSelectedLocation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Weather for {location.real_location}
      </Text>

      {/* Add your weather component here. */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
});