import {
  createStaticNavigation,
  getFocusedRouteNameFromRoute,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";

import {
  SafeAreaProvider,
} from "react-native-safe-area-context";

import HomeScreen from "./src/screens/HomeScreen";
import PreviousLocations from "./src/screens/PreviousLocations";
import LocationDetailsScreen from "./src/screens/LocationDetailsScreen";
import WikipediaScreen from "./src/screens/WikipediaScreen";
import SelectedPlacesMapScreen from "./src/screens/SelectedPlacesMapScreen";

//define the root stack along with screens inside 
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

    //title of Location screen is initially "Map" (it changes when other tab is selected)
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

//initial screen of app is Navigation
export default function App() {
  return (
    <SafeAreaProvider>
      <Navigation />
    </SafeAreaProvider>
  );
}