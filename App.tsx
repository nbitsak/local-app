import {createStaticNavigation} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/navigation/types';
import LocationScreen from './src/screens/LocationScreen';
import HomeScreen from './src/screens/HomeScreen';
import PreviousLocations from './src/screens/PreviousLocations';
import LocationDetailsScreen from './src/screens/LocationDetailsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

<Stack.Screen
  name="LocationDetails"
  component={LocationDetailsScreen}
  options={({ route }) => ({
    title: route.params.location.real_location,
  })}
/>

const RootStack = createNativeStackNavigator({
  screens: {
    Home: {
      screen: HomeScreen,
      options: {title: 'Welcome'},
    },
    LocationScreen: {
      screen: LocationScreen,
      options: {title: 'Get Location'},
    },
    PreviousLocations: {
      screen: PreviousLocations,
      options: {title: 'Previous Locations'},
    },
    LocationDetails: {
      screen: LocationDetailsScreen,
      options: {title: 'Location Details'},
    },
  },
});

const Navigation = createStaticNavigation(RootStack);

export default function App() {
  return <Navigation />;
}