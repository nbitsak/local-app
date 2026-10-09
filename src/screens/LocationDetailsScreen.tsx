import { useLayoutEffect, type ComponentProps } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type {
  LocationTabsParamList,
  RootStackParamList,
} from "../navigation/types";

import { SelectedLocationContext } from "./SelectedLocationContext";

import MapTab from "./tabs/MapTab";
import WeatherTab from "./tabs/WeatherTab";  
import NearbyTab from "./tabs/NearbyTab";
import InfoTab from "./tabs/InfoTab";

const Tab = createBottomTabNavigator<LocationTabsParamList>();

type IoniconName = ComponentProps<typeof Ionicons>["name"];

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

export default function LocationDetailsScreen({ route }: Props) {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        RootStackParamList,
        "LocationDetails"
      >
    >();

  const { location } = route.params;

  // Set the initial header title.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Map",
      headerTitle: "Map",
    });
  }, [navigation]);

  return (
    <SelectedLocationContext.Provider value={location}>
      <Tab.Navigator
        initialRouteName="Map"
        screenListeners={({ route: tabRoute }) => ({
          focus: () => {
            // Update the parent stack header when a tab gains focus.
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