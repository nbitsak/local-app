import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';

type Location = {
  id: number;
  real_location: string;
  city: string;
  country_code: string;
  latitude: number;
  longitude: number;
  source_url: string;
};

function LocationsScreen() {
  const db = useSQLiteContext();
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLocations() {
      try {
        const rows = await db.getAllAsync<Location>(
          'SELECT * FROM locations ORDER BY id'
        );

        if (active) setLocations(rows);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void loadLocations();

    return () => {
      active = false;
    };
  }, [db]);

  if (error) {
    return <Text>Σφάλμα φόρτωσης: {error}</Text>;
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 24, paddingTop: 30 }}
      data={locations}
      keyExtractor={(item) => String(item.id)}
      ItemSeparatorComponent={() => (
        <View
          style={{
          height: 1,
          backgroundColor: '#ddd',
          }}
        />
      )}
       renderItem={({ item }) => (
         <Pressable
             onPress={() => {
               console.log('Selected location:', item);
              // Add your navigation or other action here.
              }}
              style={({ pressed }) => ({
              paddingVertical: 16,
              paddingHorizontal: 12,
             backgroundColor: pressed ? '#f0f0f0' : 'transparent',
          })}
        >
        <Text style={{ fontSize: 16, fontWeight: '600' }}>
          {item.real_location}
        </Text>

        <Text style={{ marginTop: 4, color: '#555' }}>
          {item.city}
       </Text>

       <Text style={{ marginTop: 8 }}>
          Latitude: {item.latitude}
       </Text>

       <Text style={{ marginTop: 4 }}>
         Longitude: {item.longitude}
        </Text>
      </Pressable>
    )}
  />
  );
}

export default function PreviousLocations() {
  return (
    <SQLiteProvider
      databaseName="locations.db"
      assetSource={{ assetId: require('./assets/locations.db') }}
    >
      <LocationsScreen />
    </SQLiteProvider>
  );
}