// screens/WikipediaScreen.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import type { NativeStackScreenProps } from
  "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "Wikipedia"
>;

export default function WikipediaScreen({ route }: Props) {
  const { url } = route.params;
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.message}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" />
            </View>
          )}
          onError={() =>
            setError("Δεν ήταν δυνατή η φόρτωση της Wikipedia.")
          }
          onHttpError={({ nativeEvent }) => {
            // Only treat a main-page HTTP failure as a screen error.
            if (nativeEvent.url === url) {
              setError(
                `Σφάλμα φόρτωσης: HTTP ${nativeEvent.statusCode}`,
              );
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webview: {
    flex: 1,
  },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
     alignItems: "center",
    backgroundColor: "#FFFFFF",
},
  message: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  error: {
    color: "#B91C1C",
    textAlign: "center",
  },
});