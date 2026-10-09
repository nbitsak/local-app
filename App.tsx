import {createStaticNavigation} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LocationScreen from './src/screens/LocationScreen';
import HomeScreen from './src/screens/HomeScreen';
import PreviousLocations from './src/screens/PreviousLocations';

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
  },
});

const Navigation = createStaticNavigation(RootStack);

export default function App() {
  return <Navigation />;
}