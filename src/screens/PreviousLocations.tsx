import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SQLiteProvider,
  useSQLiteContext,
} from "expo-sqlite";

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from
  "@react-navigation/native-stack";

import {
  GestureHandlerRootView,
} from "react-native-gesture-handler";

import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import type {
  Location,
  RootStackParamList,
} from "../navigation/types";

type LocationRowProps = {
  location: Location;
  disabled: boolean;
  onOpen: (location: Location) => void;
  onDelete: (location: Location) => Promise<void>;
};

function LocationRow({
  location,
  disabled,
  onOpen,
  onDelete,
}: LocationRowProps) {
  const swipeableRef = useRef<SwipeableMethods | null>(null);

  async function handleSwipeOpen(): Promise<void> {
    try {
      await onDelete(location);
    } finally {
      swipeableRef.current?.close();
    }
  }

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      containerStyle={styles.swipeContainer}
      enabled={!disabled}
      friction={2}
      rightThreshold={80}
      overshootRight={false}
      renderRightActions={() => (
        <View style={styles.deleteAction}>
          <Text style={styles.deleteActionText}>
            Delete
          </Text>
        </View>
      )}
      onSwipeableOpen={() => {
        void handleSwipeOpen();
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          `Open saved location: ${location.real_location}`
        }
        disabled={disabled}
        onPress={() => onOpen(location)}
        style={({ pressed }) => [
          styles.row,
          pressed && styles.rowPressed,
          disabled && styles.rowDisabled,
        ]}
      >
        <Text style={styles.address}>
          {location.real_location}
        </Text>

        <Text style={styles.city}>
          {location.city}
        </Text>

        <Text style={styles.latitude}>
          Latitude: {location.latitude}
        </Text>

        <Text style={styles.longitude}>
          Longitude: {location.longitude}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

function LocationsScreen() {
  const db = useSQLiteContext();

  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList>
    >();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletionInProgress = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadLocations(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const rows = await db.getAllAsync<Location>(
          "SELECT * FROM locations ORDER BY id",
        );

        if (active) {
          setLocations(rows);
        }
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error ? err.message : String(err),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLocations();

    return () => {
      active = false;
    };
  }, [db]);

  async function deleteLocation(
    location: Location,
  ): Promise<void> {
    if (deletionInProgress.current) {
      return;
    }

    deletionInProgress.current = true;
    setDeleting(true);
    setError(null);

    try {
      const result = await db.runAsync(
        `
          DELETE FROM locations
          WHERE id = ?
            AND (SELECT COUNT(*) FROM locations) > 1
        `,
        location.id,
      );

      if (result.changes > 0) {
        setLocations((currentLocations) =>
          currentLocations.filter(
            (item) => item.id !== location.id,
          ),
        );

        return;
      }

      const rows = await db.getAllAsync<Location>(
        "SELECT * FROM locations ORDER BY id",
      );

      setLocations(rows);

      if (
        rows.length <= 1 &&
        rows.some((item) => item.id === location.id)
      ) {
        Alert.alert(
          "Cannot Delete Location",
          "At least one saved location must remain.",
        );
      } else {
        Alert.alert(
          "Location Not Deleted",
          "This location no longer exists or could not be deleted.",
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);

      setError(message);

      Alert.alert(
        "Deletion Failed",
        "The location could not be deleted. Please try again.",
      );
    } finally {
      deletionInProgress.current = false;
      setDeleting(false);
    }
  }

  function openLocation(location: Location): void {
    if (deletionInProgress.current) {
      return;
    }

    navigation.navigate("LocationDetails", {
      location,
    });
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading locations…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.hint}>
          Swipe left to delete a location.
          {"\n"}
          At least one saved location must remain.
        </Text>

        {deleting && (
          <View style={styles.deletingInfo}>
            <ActivityIndicator size="small" />

            <Text style={styles.deletingText}>
              Deleting location…
            </Text>
          </View>
        )}

        {error && (
          <Text
            accessibilityRole="alert"
            style={styles.error}
          >
            Error: {error}
          </Text>
        )}
      </View>

      <FlatList<Location>
        contentContainerStyle={styles.listContent}
        data={locations}
        keyExtractor={(item) => String(item.id)}
        extraData={deleting}
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No saved locations found.
          </Text>
        }
        renderItem={({ item }) => (
          <LocationRow
            location={item}
            disabled={deleting}
            onOpen={openLocation}
            onDelete={deleteLocation}
          />
        )}
      />
    </View>
  );
}

export default function PreviousLocations() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SQLiteProvider
        databaseName="locations.db"
        assetSource={{
          assetId: require("../../assets/locations.db"),
        }}
      >
        <LocationsScreen />
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: "#64748B",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  hint: {
    color: "#64748B",
    lineHeight: 20,
  },
  deletingInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  deletingText: {
    marginLeft: 8,
    color: "#64748B",
  },
  error: {
    marginTop: 12,
    color: "#B91C1C",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  empty: {
    color: "#475569",
  },
  separator: {
    height: 12,
  },
  swipeContainer: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  row: {
    padding: 16,
    minHeight: 110,
    backgroundColor: "#FFFFFF",
  },
  rowPressed: {
    backgroundColor: "#F1F5F9",
  },
  rowDisabled: {
    opacity: 0.6,
  },
  address: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0F172A",
  },
  city: {
    marginTop: 6,
    fontSize: 14,
    color: "#475569",
  },
  latitude: {
    marginTop: 10,
    fontSize: 12,
    color: "#64748B",
  },
  longitude: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },
  deleteAction: {
    width: 110,
    backgroundColor: "#B91C1C",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});