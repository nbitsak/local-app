import {createStaticNavigation} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/navigation/types';
import HomeScreen from './src/screens/HomeScreen';
import PreviousLocations from './src/screens/PreviousLocations';
import LocationDetailsScreen from './src/screens/LocationDetailsScreen';
import WikipediaScreen from "./src/screens/WikipediaScreen";
import { NavigationContainer, getFocusedRouteNameFromRoute } from "@react-navigation/native";

const Stack = createNativeStackNavigator<RootStackParamList>();

<Stack.Screen
  name="LocationDetails"
  component={LocationDetailsScreen}
  options={({ route }) => ({
    headerTitle: getFocusedRouteNameFromRoute(route) ?? "Map",
  })}
/>

const RootStack = createNativeStackNavigator({
  screens: {
    Home: {
      screen: HomeScreen,
      options: {title: 'Localize'},
    },
    PreviousLocations: {
      screen: PreviousLocations,
      options: {title: 'Locations'},
    },
    LocationDetails: {
      screen: LocationDetailsScreen,
      options: {title: 'Location Details'},
    },
    Wikipedia: {
      screen: WikipediaScreen,
      options: {title: 'Wikipedia'},
    },
  },
});

const Navigation = createStaticNavigation(RootStack);

export default function App() {
  return <Navigation />;
}