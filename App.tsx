import {
  createStaticNavigation,
  getFocusedRouteNameFromRoute,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";

import HomeScreen from "./src/screens/HomeScreen";
import PreviousLocations from "./src/screens/PreviousLocations";
import LocationDetailsScreen from "./src/screens/LocationDetailsScreen";
import WikipediaScreen from "./src/screens/WikipediaScreen";
import SelectedPlacesMapScreen from "./src/screens/SelectedPlacesMapScreen";

const RootStack = createNativeStackNavigator({
  screens: {
    Home: {
      screen: HomeScreen,
      options: {
        title: "Localize",
      },
    },

    PreviousLocations: {
      screen: PreviousLocations,
      options: {
        title: "Locations",
      },
    },

    LocationDetails: {
      screen: LocationDetailsScreen,
      options: ({ route }) => ({
        headerTitle:
          getFocusedRouteNameFromRoute(route) ?? "Map",
      }),
    },

    Wikipedia: {
      screen: WikipediaScreen,
      options: {
        title: "Wikipedia",
      },
    },

    SelectedPlacesMap: {
      screen: SelectedPlacesMapScreen,
      options: {
        title: "Selected places",
      },
    },
  },
});

const Navigation = createStaticNavigation(RootStack);

export default function App() {
  return <Navigation />;
}