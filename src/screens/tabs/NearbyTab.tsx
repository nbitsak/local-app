import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useNavigation,
} from "@react-navigation/native";

import type {
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";

import {
  useSelectedLocation,
} from "../SelectedLocationContext";

import {
  getNearbyPlaces,
  type TourismPlace,
} from "../../services/woosmapTourism";

import {
  loadNearbySelection,
  saveNearbySelection,
} from "../../services/nearbyDatabase";

import type {
  RootStackParamList,
  SelectedMapPlace,
} from "../../navigation/types";

type Navigation =
  NativeStackNavigationProp<RootStackParamList>;

const WOOSMAP_API_KEY = "789357b7-df18-41af-b04d-290c988618b5";

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

function isValidCoordinates(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function toMapPlace(
  place: TourismPlace,
): SelectedMapPlace | null {
  const point = place.geometry?.location;

  if (
    !point ||
    !isValidCoordinates(point.lat, point.lng)
  ) {
    return null;
  }

  return {
    id: `place:${place.public_id}`,
    name: place.name,
    latitude: point.lat,
    longitude: point.lng,
    formatted_address: place.formatted_address,
    isStartingLocation: false,
  };
}

function getNearbyErrorMessage(
  cause: unknown,
): string {
  const technicalMessage =
    cause instanceof Error
      ? cause.message
      : String(cause);

  const isConnectionError =
    /offline|network|internet|failed to fetch|fetch failed|connection|timed?\s*out|timeout|unable to resolve host/i.test(
      technicalMessage,
    );

  if (isConnectionError) {
    return (
      "We couldn't connect to search for nearby places. " +
      "Check your internet connection and try again. " +
      "Any places you have saved are still available " +
      "in Selected places."
    );
  }

  return (
    "We couldn't load nearby places right now. " +
    "Please try again later. " +
    "Any places you have saved are still available."
  );
}

export default function NearbyTab() {
  const navigation = useNavigation<Navigation>();
  const location = useSelectedLocation();

  const rawLatitude = location?.latitude;
  const rawLongitude = location?.longitude;

  const latitude =
    rawLatitude == null ||
    String(rawLatitude).trim() === ""
      ? NaN
      : Number(rawLatitude);

  const longitude =
    rawLongitude == null ||
    String(rawLongitude).trim() === ""
      ? NaN
      : Number(rawLongitude);

  const validStartingLocation = isValidCoordinates(
    latitude,
    longitude,
  );

  const originId = `starting:${location.id}`;

  const locationKey =
    `${originId}:${latitude}:${longitude}`;

  const activeLocationKeyRef = useRef(locationKey);
  activeLocationKeyRef.current = locationKey;

  const [selectedCategory, setSelectedCategory] =
    useState<NearbyCategory | null>(null);

  const [
    selectedSubcategories,
    setSelectedSubcategories,
  ] = useState<AvailableType[]>([]);

  const [places, setPlaces] =
    useState<TourismPlace[]>([]);

  const [selectedPlaces, setSelectedPlaces] =
    useState<SelectedMapPlace[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [hasSearched, setHasSearched] =
    useState(false);

  const [
    loadingSavedPlaces,
    setLoadingSavedPlaces,
  ] = useState(true);

  const [savingPlaces, setSavingPlaces] =
    useState(false);

  const [storageMessage, setStorageMessage] =
    useState<string | null>(null);

  const [storageError, setStorageError] =
    useState<string | null>(null);

  const [
    restoredLocationKey,
    setRestoredLocationKey,
  ] = useState<string | null>(null);

  const [restoreAttempt, setRestoreAttempt] =
    useState(0);

  const requestRef =
    useRef<AbortController | null>(null);

  // Block repeated save presses before state updates.
  const saveInProgressRef = useRef(false);

  const mountedRef = useRef(true);

  const allSelected =
    selectedSubcategories.length === 0;

  const subcategories = selectedCategory
    ? availableTypes.filter((type) =>
        type.startsWith(`${selectedCategory}.`),
      )
    : [];

  const startingPlace: SelectedMapPlace = {
    id: originId,
    name: location.real_location,
    latitude,
    longitude,
    isStartingLocation: true,
  };

  const selectionReady =
    !loadingSavedPlaces &&
    restoredLocationKey === locationKey;

  const selectionLocked =
    !selectionReady || savingPlaces;

  const canSave =
    validStartingLocation &&
    selectionReady &&
    !savingPlaces;

  const canShowMap =
    validStartingLocation &&
    selectionReady;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Restore saved destinations when the starting location changes.
  useEffect(() => {
    let cancelled = false;

    setSelectedPlaces([]);
    setLoadingSavedPlaces(true);
    setRestoredLocationKey(null);
    setStorageMessage(null);
    setStorageError(null);

    async function restoreSelection(): Promise<void> {
      try {
        const savedPlaces =
          await loadNearbySelection(originId);

        if (cancelled) return;

        setSelectedPlaces(savedPlaces);
        setRestoredLocationKey(locationKey);
      } catch (cause) {
        if (cancelled) return;

        setStorageError(
          cause instanceof Error
            ? cause.message
            : "Unable to load saved places.",
        );
      } finally {
        if (!cancelled) {
          setLoadingSavedPlaces(false);
        }
      }
    }

    void restoreSelection();

    return () => {
      cancelled = true;
    };
  }, [originId, locationKey, restoreAttempt]);

  // Reset only search results when filters or location change.
  // Selected destinations remain independent of the online search.
  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;

    setPlaces([]);
    setError(null);
    setHasSearched(false);
    setLoading(false);

    return () => {
      requestRef.current?.abort();
    };
  }, [
    locationKey,
    selectedCategory,
    selectedSubcategories,
  ]);

  function selectCategory(
    category: NearbyCategory,
  ) {
    setSelectedCategory(category);

    // Default to All for the newly selected category.
    setSelectedSubcategories([]);
  }

  function selectAll() {
    setSelectedSubcategories([]);
  }

  function toggleSubcategory(
    subcategory: AvailableType,
  ) {
    setSelectedSubcategories((current) =>
      current.includes(subcategory)
        ? current.filter(
            (item) => item !== subcategory,
          )
        : [...current, subcategory],
    );
  }

  function clearStorageFeedback() {
    setStorageMessage(null);
    setStorageError(null);
  }

  function togglePlace(place: TourismPlace) {
    if (
      selectionLocked ||
      saveInProgressRef.current
    ) {
      return;
    }

    const mapPlace = toMapPlace(place);

    if (!mapPlace) return;

    clearStorageFeedback();

    setSelectedPlaces((current) =>
      current.some(
        (item) => item.id === mapPlace.id,
      )
        ? current.filter(
            (item) => item.id !== mapPlace.id,
          )
        : [...current, mapPlace],
    );
  }

  function removePlace(id: string) {
    if (
      selectionLocked ||
      saveInProgressRef.current
    ) {
      return;
    }

    clearStorageFeedback();

    setSelectedPlaces((current) =>
      current.filter((place) => place.id !== id),
    );
  }

  function retryRestore() {
    if (
      loadingSavedPlaces ||
      saveInProgressRef.current
    ) {
      return;
    }

    setRestoreAttempt((current) => current + 1);
  }

  async function handleSaveSelectedPlaces():
    Promise<void> {
    if (
      !canSave ||
      saveInProgressRef.current
    ) {
      return;
    }

    saveInProgressRef.current = true;

    const savingLocationKey = locationKey;

    setSavingPlaces(true);
    clearStorageFeedback();

    try {
      await saveNearbySelection(
        startingPlace,
        selectedPlaces,
      );

      if (
        !mountedRef.current ||
        activeLocationKeyRef.current !==
          savingLocationKey
      ) {
        return;
      }

      setStorageMessage("Selected places saved.");
    } catch (cause) {
      if (
        !mountedRef.current ||
        activeLocationKeyRef.current !==
          savingLocationKey
      ) {
        return;
      }

      setStorageError(
        cause instanceof Error
          ? cause.message
          : "Unable to save selected places.",
      );
    } finally {
      saveInProgressRef.current = false;

      if (mountedRef.current) {
        setSavingPlaces(false);
      }
    }
  }

  function showOnMap() {
    if (!canShowMap) return;

    navigation.navigate("SelectedPlacesMap", {
      places: [
        startingPlace,
        ...selectedPlaces,
      ],
    });
  }

  async function handleContinue(): Promise<void> {
    if (!selectedCategory) return;

    if (!validStartingLocation) {
      setError(
        "This location does not have valid coordinates. " +
        "Please select another starting location.",
      );
      return;
    }

    const selectedTypes: AvailableType[] =
      allSelected
        ? [selectedCategory]
        : [...selectedSubcategories];

    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setError(null);
    setHasSearched(false);
    setPlaces([]);

    try {
      const results = await getNearbyPlaces({
        apiKey: WOOSMAP_API_KEY,
        location: {
          latitude,
          longitude,
        },
        types: selectedTypes,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setPlaces(results);
      setHasSearched(true);
    } catch (cause) {
      if (controller.signal.aborted) return;

      // Show a friendly message instead of the raw API error.
      setError(getNearbyErrorMessage(cause));

      // Keep technical details in development logs only.
      if (__DEV__) {
        console.log(
          "Nearby request diagnostic:",
          cause instanceof Error
            ? cause.message
            : String(cause),
        );
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;

        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }
  }

  return (
    <ScrollView
      style={styles.nearbyScreen}
      contentContainerStyle={styles.nearbyContent}
    >
      <View style={styles.selectedSection}>
        <Text style={styles.sectionTitle}>
          Selected places
        </Text>

        <View
          style={[
            styles.placeCard,
            styles.startingCard,
          ]}
        >
          <Text style={styles.placeName}>
            {startingPlace.name}
          </Text>

          <Text style={styles.startingHint}>
            Starting location · Cannot be removed
          </Text>

          {!validStartingLocation && (
            <Text style={styles.errorText}>
              This location does not have valid
              coordinates.
            </Text>
          )}
        </View>

        {loadingSavedPlaces && (
          <View style={styles.storageLoading}>
            <ActivityIndicator
              size="small"
              color="#2563eb"
            />

            <Text style={styles.storageLoadingText}>
              Loading saved places…
            </Text>
          </View>
        )}

        {selectionReady &&
          selectedPlaces.map((place) => (
            <View
              key={place.id}
              style={styles.selectedPlaceCard}
            >
              <View
                style={styles.selectedPlaceContent}
              >
                <Text style={styles.placeName}>
                  {place.name}
                </Text>

                {place.formatted_address ? (
                  <Text
                    style={styles.placeAddress}
                  >
                    {place.formatted_address}
                  </Text>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  `Remove ${place.name}`
                }
                accessibilityState={{
                  disabled: selectionLocked,
                }}
                disabled={selectionLocked}
                onPress={() =>
                  removePlace(place.id)
                }
                hitSlop={8}
                style={({ pressed }) => [
                  styles.removeButton,
                  selectionLocked &&
                    styles.disabledButton,
                  pressed &&
                    styles.categoryTagPressed,
                ]}
              >
                <Text
                  style={styles.removeButtonText}
                >
                  ×
                </Text>
              </Pressable>
            </View>
          ))}

        {selectionReady &&
          selectedPlaces.length === 0 && (
            <Text style={styles.nearbyHint}>
              Tap a nearby place below to add it here.
            </Text>
          )}

        {storageError && (
          <Text
            accessibilityRole="alert"
            style={styles.storageError}
          >
            {storageError}
          </Text>
        )}

        {!loadingSavedPlaces &&
          !selectionReady && (
            <Pressable
              accessibilityRole="button"
              onPress={retryRestore}
              style={({ pressed }) => [
                styles.retryButton,
                pressed &&
                  styles.categoryTagPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>
                Retry loading saved places
              </Text>
            </Pressable>
          )}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: !canSave,
            busy: savingPlaces,
          }}
          disabled={!canSave}
          onPress={() =>
            void handleSaveSelectedPlaces()
          }
          style={({ pressed }) => [
            styles.saveButton,
            !canSave && styles.disabledButton,
            pressed &&
              styles.categoryTagPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {savingPlaces
              ? "Saving..."
              : "Save selected places"}
          </Text>
        </Pressable>

        {storageMessage && (
          <Text style={styles.storageSuccess}>
            {storageMessage}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: !canShowMap,
          }}
          disabled={!canShowMap}
          onPress={showOnMap}
          style={({ pressed }) => [
            styles.mapButton,
            !canShowMap &&
              styles.disabledButton,
            pressed &&
              styles.categoryTagPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            Show on The Map
          </Text>
        </Pressable>

        <Text style={styles.saveHint}>
          Changes are stored only when you press
          Save selected places.
        </Text>
      </View>

      <Text style={styles.nearbyTitle}>
        Nearby places around {location.real_location}
      </Text>

      <Text style={styles.nearbyHint}>
        Select a category.
      </Text>

      <View style={styles.tagsContainer}>
        {nearbyCategories.map((category) => {
          const selected =
            selectedCategory === category;

          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() =>
                selectCategory(category)
              }
              style={({ pressed }) => [
                styles.categoryTag,
                selected &&
                  styles.categoryTagSelected,
                pressed &&
                  styles.categoryTagPressed,
              ]}
            >
              <Text
                style={[
                  styles.categoryTagText,
                  selected &&
                    styles.categoryTagTextSelected,
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
              accessibilityState={{
                selected: allSelected,
              }}
              onPress={selectAll}
              style={({ pressed }) => [
                styles.categoryTag,
                allSelected &&
                  styles.categoryTagSelected,
                pressed &&
                  styles.categoryTagPressed,
              ]}
            >
              <Text
                style={[
                  styles.categoryTagText,
                  allSelected &&
                    styles.categoryTagTextSelected,
                ]}
              >
                All
              </Text>
            </Pressable>

            {subcategories.map((subcategory) => {
              const selected =
                selectedSubcategories.includes(
                  subcategory,
                );

              const label = subcategory.slice(
                selectedCategory.length + 1,
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
                    selected &&
                      styles.categoryTagSelected,
                    pressed &&
                      styles.categoryTagPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryTagText,
                      selected &&
                        styles.categoryTagTextSelected,
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
            accessibilityState={{
              disabled: loading,
              busy: loading,
            }}
            disabled={loading}
            onPress={() => void handleContinue()}
            style={({ pressed }) => [
              styles.nearbyContinueButton,
              loading &&
                styles.disabledButton,
              pressed &&
                styles.categoryTagPressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {loading
                ? "Searching..."
                : "Continue"}
            </Text>
          </Pressable>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color="#2563eb"
              />

              <Text style={styles.loadingText}>
                Searching for nearby places…
              </Text>
            </View>
          )}

          {error && (
            <View
              accessibilityRole="alert"
              style={styles.nearbyNotice}
            >
              <Text
                style={styles.nearbyNoticeTitle}
              >
                Nearby search unavailable
              </Text>

              <Text
                style={styles.nearbyNoticeText}
              >
                {error}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled:
                    loading ||
                    !validStartingLocation,
                }}
                disabled={
                  loading ||
                  !validStartingLocation
                }
                onPress={() =>
                  void handleContinue()
                }
                style={({ pressed }) => [
                  styles.retryButton,
                  styles.noticeRetryButton,
                  (
                    loading ||
                    !validStartingLocation
                  ) && styles.disabledButton,
                  pressed &&
                    styles.categoryTagPressed,
                ]}
              >
                <Text
                  style={styles.retryButtonText}
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          )}

          {hasSearched && (
            <View style={styles.placesContainer}>
              <Text style={styles.resultsTitle}>
                {places.length === 1
                  ? "1 place found"
                  : `${places.length} places found`}
              </Text>

              {places.length === 0 && (
                <Text style={styles.nearbyHint}>
                  No places were found for your
                  selected categories within 2 km.
                </Text>
              )}

              {places.map((place) => {
                const mapPlace = toMapPlace(place);

                const hasCoordinates =
                  mapPlace !== null;

                const selected =
                  selectionReady &&
                  selectedPlaces.some(
                    (item) =>
                      item.id ===
                      `place:${place.public_id}`,
                  );

                const disabled =
                  !hasCoordinates ||
                  selectionLocked;

                let selectionHint =
                  "Tap to add to Selected places.";

                if (!hasCoordinates) {
                  selectionHint =
                    "Coordinates unavailable — cannot add to map.";
                } else if (loadingSavedPlaces) {
                  selectionHint =
                    "Please wait while saved places load.";
                } else if (!selectionReady) {
                  selectionHint =
                    "Load saved places before changing the selection.";
                } else if (savingPlaces) {
                  selectionHint =
                    "Saving your selection…";
                } else if (selected) {
                  selectionHint =
                    "Tap to remove from Selected places.";
                }

                return (
                  <Pressable
                    key={place.public_id}
                    accessibilityRole="button"
                    accessibilityLabel={
                      `${selected ? "Remove" : "Select"} ${place.name}`
                    }
                    accessibilityState={{
                      selected,
                      disabled,
                    }}
                    disabled={disabled}
                    onPress={() =>
                      togglePlace(place)
                    }
                    style={({ pressed }) => [
                      styles.placeCard,
                      selected &&
                        styles.selectedResultCard,
                      disabled &&
                        styles.unavailableCard,
                      pressed &&
                        styles.categoryTagPressed,
                    ]}
                  >
                    <View
                      style={styles.resultNameRow}
                    >
                      <Text
                        style={[
                          styles.placeName,
                          styles.resultName,
                        ]}
                      >
                        {place.name}
                      </Text>

                      {selected && (
                        <Text
                          style={styles.selectedBadge}
                        >
                          ✓ Selected
                        </Text>
                      )}
                    </View>

                    {place.formatted_address ? (
                      <Text
                        style={styles.placeAddress}
                      >
                        {place.formatted_address}
                      </Text>
                    ) : null}

                    <Text style={styles.placeTypes}>
                      {place.types
                        .filter(
                          (type) =>
                            type !==
                            "point_of_interest",
                        )
                        .join(", ")}
                    </Text>

                    <Text
                      style={styles.selectionHint}
                    >
                      {selectionHint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nearbyScreen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  nearbyContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  selectedSection: {
    marginBottom: 28,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
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
  saveButton: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  mapButton: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#0f766e",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  storageLoading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  storageLoadingText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#6b7280",
  },
  storageSuccess: {
    marginTop: 12,
    fontSize: 14,
    color: "#15803d",
  },
  storageError: {
    marginBottom: 12,
    fontSize: 14,
    color: "#b91c1c",
  },
  saveHint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b",
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    alignItems: "center",
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1d4ed8",
  },
  nearbyNotice: {
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
  },
  nearbyNoticeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  nearbyNoticeText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
  },
  noticeRetryButton: {
    marginTop: 14,
    marginBottom: 0,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: "#b91c1c",
  },
  placesContainer: {
    marginTop: 24,
  },
  resultsTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  placeCard: {
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#f9fafb",
  },
  startingCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#93c5fd",
  },
  startingHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#1d4ed8",
  },
  selectedPlaceCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 12,
    backgroundColor: "#f0fdfa",
  },
  selectedPlaceContent: {
    flex: 1,
  },
  removeButton: {
    marginLeft: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
  },
  removeButtonText: {
    color: "#b91c1c",
    fontSize: 26,
    lineHeight: 30,
  },
  placeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  placeAddress: {
    marginTop: 6,
    fontSize: 14,
    color: "#4b5563",
  },
  placeTypes: {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
  },
  resultNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultName: {
    flex: 1,
  },
  selectedResultCard: {
    borderColor: "#0f766e",
    backgroundColor: "#f0fdfa",
  },
  selectedBadge: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#0f766e",
  },
  selectionHint: {
    marginTop: 10,
    fontSize: 12,
    color: "#64748b",
  },
  unavailableCard: {
    opacity: 0.6,
  },
});