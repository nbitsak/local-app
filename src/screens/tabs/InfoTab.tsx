import { StyleSheet, Text, View } from "react-native";

import { useSelectedLocation } from "../SelectedLocationContext";

export default function InfoTab() {
  const location = useSelectedLocation();

  return (
    <View style={styles.container}>
      <Text>
        Information about {location.real_location}
      </Text>

      {/* Add your info component here. */}
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
});