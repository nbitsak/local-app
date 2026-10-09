import React, { createContext, useContext, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import MapView, { Marker } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";

import type {
  Location,
  LocationTabsParamList,
  RootStackParamList,
} from "../navigation/types";

const Tab = createBottomTabNavigator<LocationTabsParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<
  keyof LocationTabsParamList,
  {
    active: IoniconName;
    inactive: IoniconName;
  }
> = {
  Map: {
    active: "map",
    inactive: "map-outline",
  },
  Weather: {
    active: "partly-sunny",
    inactive: "partly-sunny-outline",
  },
  Nearby: {
    active: "location",
    inactive: "location-outline",
  },
  Info: {
    active: "information-circle",
    inactive: "information-circle-outline",
  },
};

const SelectedLocationContext =
  createContext<Location | null>(null);

function useSelectedLocation(): Location {
  const location = useContext(SelectedLocationContext);

  if (location === null) {
    throw new Error(
      "useSelectedLocation must be used inside SelectedLocationContext.Provider"
    );
  }

  return location;
}

function MapTab() {
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

function WeatherTab() {
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

const availableTypes = [
  "transit.station",
  "transit.station.airport",
  "transit.station.rail",
  "business",
  "business.cinema",
  "business.theatre",
  "business.nightclub",
  "business.finance",
  "business.finance.bank",
  "business.fuel",
  "business.parking",
  "business.mall",
  "business.food_and_drinks",
  "business.food_and_drinks.bar",
  "business.food_and_drinks.biergarten",
  "business.food_and_drinks.cafe",
  "business.food_and_drinks.fast_food",
  "business.food_and_drinks.pub",
  "business.food_and_drinks.restaurant",
  "business.food_and_drinks.food_court",
  "business.shop",
  "business.shop.mall",
  "business.shop.bakery",
  "business.shop.butcher",
  "business.shop.library",
  "business.shop.grocery",
  "business.shop.sports",
  "business.shop.toys",
  "business.shop.clothes",
  "business.shop.furniture",
  "business.shop.electronics",
  "education",
  "education.school",
  "education.kindergarten",
  "education.university",
  "education.college",
  "education.library",
  "hospitality",
  "hospitality.hotel",
  "hospitality.hostel",
  "hospitality.guest_house",
  "hospitality.bed_and_breakfast",
  "hospitality.motel",
  "medical",
  "medical.hospital",
  "medical.pharmacy",
  "medical.clinic",
  "tourism",
  "tourism.attraction",
  "tourism.attraction.amusement_park",
  "tourism.attraction.zoo",
  "tourism.attraction.aquarium",
  "tourism.monument",
  "tourism.monument.castle",
  "tourism.museum",
  "government",
  "park",
  "place_of_worship",
  "police",
  "post_office",
  "sports",
] as const;

type AvailableType = (typeof availableTypes)[number];

const nearbyCategories = [
  "business",
  "education",
  "government",
  "hospitality",
  "medical",
  "park",
  "place_of_worship",
  "police",
  "post_office",
  "sports",
  "tourism",
  "transit.station",
] as const;

type NearbyCategory = (typeof nearbyCategories)[number];

function NearbyTab() {
  const location = useSelectedLocation();

  const [selectedCategory, setSelectedCategory] =
    useState<NearbyCategory | null>(null);

  const [selectedSubcategories, setSelectedSubcategories] =
    useState<AvailableType[]>([]);

  // All is selected whenever no specific subcategories are selected.
  const allSelected = selectedSubcategories.length === 0;

  // Include every descendant, including nested subcategories.
  const subcategories = selectedCategory
    ? availableTypes.filter((type) =>
        type.startsWith(`${selectedCategory}.`)
      )
    : [];

  function selectCategory(category: NearbyCategory) {
    setSelectedCategory(category);

    // Default to All whenever a main category is selected.
    setSelectedSubcategories([]);
  }

  function selectAll() {
    setSelectedSubcategories([]);
  }

  function toggleSubcategory(subcategory: AvailableType) {
    setSelectedSubcategories((current) =>
      current.includes(subcategory)
        ? current.filter((item) => item !== subcategory)
        : [...current, subcategory]
    );
  }

  function handleContinue() {
    if (!selectedCategory) return;

    // Use the main category for All, or the selected subcategories.
    const selectedTypes: AvailableType[] = allSelected
      ? [selectedCategory]
      : [...selectedSubcategories];

    // Replace this preview with your nearby search or navigation.
    Alert.alert(
      "Selected Types",
      selectedTypes.join("\n")
    );
  }

  return (
    <ScrollView
      style={styles.nearbyScreen}
      contentContainerStyle={styles.nearbyContent}
    >
      <Text style={styles.nearbyTitle}>
        Nearby places around {location.real_location}
      </Text>

      <Text style={styles.nearbyHint}>
        Select a category.
      </Text>

      <View style={styles.tagsContainer}>
        {nearbyCategories.map((category) => {
          const selected = selectedCategory === category;

          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectCategory(category)}
              style={({ pressed }) => [
                styles.categoryTag,
                selected && styles.categoryTagSelected,
                pressed && styles.categoryTagPressed,
              ]}
            >
              <Text
                style={[
                  styles.categoryTagText,
                  selected && styles.categoryTagTextSelected,
                ]}
              >
                {category}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedCategory && (
        <View style={styles.nearbyResults}>
          <Text style={styles.selectedCategoryText}>
            Selected category: {selectedCategory}
          </Text>

          <Text style={styles.subcategoryHint}>
            {subcategories.length > 0
              ? "Select All or choose one or more subcategories."
              : "No subcategories are available. All is selected."}
          </Text>

          <View style={styles.tagsContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: allSelected }}
              onPress={selectAll}
              style={({ pressed }) => [
                styles.categoryTag,
                allSelected && styles.categoryTagSelected,
                pressed && styles.categoryTagPressed,
              ]}
            >
              <Text
                style={[
                  styles.categoryTagText,
                  allSelected && styles.categoryTagTextSelected,
                ]}
              >
                All
              </Text>
            </Pressable>

            {subcategories.map((subcategory) => {
              const selected =
                selectedSubcategories.includes(subcategory);

              // Remove the main category prefix from the visible label.
              // Keep the full identifier in the selection state.
              const label = subcategory.slice(
                selectedCategory.length + 1
              );

              return (
                <Pressable
                  key={subcategory}
                  accessibilityRole="button"
                  accessibilityLabel={subcategory}
                  accessibilityState={{ selected }}
                  onPress={() =>
                    toggleSubcategory(subcategory)
                  }
                  style={({ pressed }) => [
                    styles.categoryTag,
                    selected && styles.categoryTagSelected,
                    pressed && styles.categoryTagPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryTagText,
                      selected && styles.categoryTagTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.nearbyContinueButton,
              pressed && styles.categoryTagPressed,
            ]}
          >
            <Text style={styles.nearbyContinueButtonText}>
              Continue
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function InfoTab() {
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

type Props = NativeStackScreenProps<
  RootStackParamList,
  "LocationDetails"
>;

export default function LocationDetailsScreen({ route }: Props) {
  const { location } = route.params;

  return (
    <SelectedLocationContext.Provider value={location}>
      <Tab.Navigator
        initialRouteName="Map"
        screenOptions={({ route: tabRoute }) => ({
          headerShown: false,
          tabBarActiveTintColor: "#2563eb",
          tabBarInactiveTintColor: "#6b7280",
          tabBarLabelStyle: {
            fontSize: 14,
          },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = tabIcons[tabRoute.name];

            return (
              <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen name="Map" component={MapTab} />

        <Tab.Screen name="Weather" component={WeatherTab} />

        <Tab.Screen name="Nearby" component={NearbyTab} />

        <Tab.Screen name="Info" component={InfoTab} />
      </Tab.Navigator>
    </SelectedLocationContext.Provider>
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
  map: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  nearbyScreen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  nearbyContent: {
      paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 32,
  },
  nearbyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  nearbyHint: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryTag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
     borderRadius: 20,
     borderWidth: 1,
     borderColor: "#d1d5db",
     backgroundColor: "#f3f4f6",
  },
  categoryTagSelected: {
    backgroundColor: "#2563eb",
     borderColor: "#2563eb",
  },
  categoryTagPressed: {
    opacity: 0.7,
  },
  categoryTagText: {
    fontSize: 14,
    color: "#374151",
  },
  categoryTagTextSelected: {
    color: "#fff",
  },
  nearbyResults: {
    marginTop: 24,
    },
    selectedCategoryText: {
     fontSize: 16,
    color: "#374151",
    },
    subcategoryHint: {
        fontSize: 14,
        color: "#6b7280",
        marginBottom: 16,
    },
    nearbyContinueButton: {
        marginTop: 24,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        backgroundColor: "#2563eb",
        alignItems: "center",
    },
    nearbyContinueButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#fff",
    },
});
