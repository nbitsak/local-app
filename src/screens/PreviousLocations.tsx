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
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { GestureHandlerRootView } from "react-native-gesture-handler";
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

  async function handleSwipeOpen() {
    try {
      await onDelete(location);
    } finally {
      // Close the row if deletion was blocked or failed.
      swipeableRef.current?.close();
    }
  }

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
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
        // Only right actions are configured,
       // so opening the row follows a leftward swipe.
       void handleSwipeOpen();
       }}
      >
      <Pressable
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
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Block overlapping deletions immediately.
  const deletionInProgress = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadLocations() {
      try {
        setError(null);

        const rows = await db.getAllAsync<Location>(
          "SELECT * FROM locations ORDER BY id"
        );

        if (active) {
          setLocations(rows);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : String(err)
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

  async function deleteLocation(location: Location) {
    if (deletionInProgress.current) return;

    deletionInProgress.current = true;

    setDeleting(true);
    setError(null);

    try {
      // Enforce the minimum record count inside the DELETE statement.
      const result = await db.runAsync(
        `
          DELETE FROM locations
          WHERE id = ?
            AND (SELECT COUNT(*) FROM locations) > 1
        `,
        location.id
      );

      if (result.changes > 0) {
        // Update the visible list only after database deletion succeeds.
        setLocations((currentLocations) =>
          currentLocations.filter(
            (item) => item.id !== location.id
          )
        );

        return;
      }

      // Refresh the list when the database did not delete a record.
      const rows = await db.getAllAsync<Location>(
        "SELECT * FROM locations ORDER BY id"
      );

      setLocations(rows);

      if (
        rows.length <= 1 &&
        rows.some((item) => item.id === location.id)
      ) {
        Alert.alert(
          "Cannot Delete Location",
          "At least one saved location must remain."
        );
      } else {
        Alert.alert(
          "Location Not Deleted",
          "This location no longer exists or could not be deleted."
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);

      setError(message);

      Alert.alert(
        "Deletion Failed",
        "The location could not be deleted. Please try again."
      );
    } finally {
      deletionInProgress.current = false;
      setDeleting(false);
    }
  }

  function openLocation(location: Location) {
    if (deletionInProgress.current) return;

    navigation.navigate("LocationDetails", {
      location,
    });
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
        <Text>Loading locations…</Text>
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
            <Text>Deleting location…</Text>
          </View>
        )}

        {error && (
          <Text style={styles.error}>
            Error: {error}
          </Text>
        )}
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={locations}
        keyExtractor={(item) => String(item.id)}
        extraData={deleting}
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
        ListEmptyComponent={
          <Text>No saved locations found.</Text>
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
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },
  hint: {
    color: "#555",
    lineHeight: 20,
  },
  deletingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  error: {
    color: "red",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  separator: {
    height: 1,
    backgroundColor: "#ddd",
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  rowPressed: {
    backgroundColor: "#f0f0f0",
  },
  rowDisabled: {
    opacity: 0.6,
  },
  address: {
    fontSize: 16,
    fontWeight: "600",
  },
  city: {
    marginTop: 4,
    color: "#555",
  },
  latitude: {
    marginTop: 8,
  },
  longitude: {
    marginTop: 4,
  },
  deleteAction: {
    width: 110,
    backgroundColor: "#c62828",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});