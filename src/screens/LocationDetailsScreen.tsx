import {
  useEffect,
  useLayoutEffect,
  type ComponentProps,
} from "react";

import {
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";

import {
  useNavigation,
} from "@react-navigation/native";

import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";

import Ionicons from "@expo/vector-icons/Ionicons";

import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import type {
  LocationTabsParamList,
  RootStackParamList,
} from "../navigation/types";

import {
  SelectedLocationContext,
} from "./SelectedLocationContext";

import MapTab from "./tabs/MapTab";
import WeatherTab from "./tabs/WeatherTab";
import NearbyTab from "./tabs/NearbyTab";
import InfoTab from "./tabs/InfoTab";

const Tab =
  createBottomTabNavigator<LocationTabsParamList>();

type IoniconName =
  ComponentProps<typeof Ionicons>["name"];

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

type Props = NativeStackScreenProps<
  RootStackParamList,
  "LocationDetails"
>;

export default function LocationDetailsScreen({
  route,
}: Props) {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        RootStackParamList,
        "LocationDetails"
      >
    >();

  const { location } = route.params;
  const insets = useSafeAreaInsets();

  // Space for the icons and labels, excluding system navigation.
  const tabContentHeight = 60;

  // Additional space reserved for the Android/iOS system area.
  const bottomInset = insets.bottom;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Map",
      headerTitle: "Map",
    });
  }, [navigation]);

  // Temporary diagnostic: remove after verifying the layout.
  useEffect(() => {
    console.log("LocationDetails safe-area insets:", {
      top: insets.top,
      bottom: insets.bottom,
      left: insets.left,
      right: insets.right,
    });
  }, [
    insets.top,
    insets.bottom,
    insets.left,
    insets.right,
  ]);

  return (
    <SelectedLocationContext.Provider value={location}>
      <Tab.Navigator
        initialRouteName="Map"
        screenListeners={({ route: tabRoute }) => ({
          focus: () => {
            navigation.setOptions({
              title: tabRoute.name,
              headerTitle: tabRoute.name,
            });
          },
        })}
        screenOptions={({ route: tabRoute }) => ({
          headerShown: false,

          tabBarActiveTintColor: "#2563eb",
          tabBarInactiveTintColor: "#6b7280",

          tabBarStyle: {
            height: tabContentHeight + bottomInset,
            paddingTop: 6,
            paddingBottom: bottomInset,
            backgroundColor: "#ffffff",
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
          },

          tabBarLabelStyle: {
            fontSize: 13,
            marginBottom: 4,
          },

          tabBarIcon: ({ focused, color, size }) => {
            const icons = tabIcons[tabRoute.name];

            return (
              <Ionicons
                name={
                  focused
                    ? icons.active
                    : icons.inactive
                }
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen
          name="Map"
          component={MapTab}
        />

        <Tab.Screen
          name="Weather"
          component={WeatherTab}
        />

        <Tab.Screen
          name="Nearby"
          component={NearbyTab}
        />

        <Tab.Screen
          name="Info"
          component={InfoTab}
        />
      </Tab.Navigator>
    </SelectedLocationContext.Provider>
  );
}