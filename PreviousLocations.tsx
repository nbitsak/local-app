import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
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
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
      data={locations}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={{ marginBottom: 20 }}>
          <Text>{item.real_location}</Text>
          <Text>{item.city}</Text>
          <Text>
            Latitude: {item.latitude} · Longitude: {item.longitude}
          </Text>
        </View>
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