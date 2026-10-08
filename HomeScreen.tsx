import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';
import {useNavigation} from '@react-navigation/native';
import LocationScreen from './LocationScreen';
import PreviousLocations from './PreviousLocations';

export default function HomeScreen() {

  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text>Nice to have you here!</Text>
       <Button
          title="Previous Locations"
          onPress={() =>
                navigation.navigate('PreviousLocations' as never) 
          }     
       />
       <Button 
            title="Go to Location Screen" 
            onPress={() =>
                navigation.navigate('LocationScreen' as never)
            }
        />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});