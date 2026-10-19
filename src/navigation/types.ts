export type Location = {
  id: number;
  real_location: string;
  city: string;
  country_code: string;
  latitude: number;
  longitude: number;
  source_url: string;
};

export type SelectedMapPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  formatted_address?: string | null;
  isStartingLocation: boolean;
};

export type RootStackParamList = {
  Home: undefined;
  PreviousLocations: undefined;
  LocationScreen: { location: Location };
  LocationDetails: { location: Location };
  Main: undefined;

  Wikipedia: {
    title: string;
    url: string;
  };

  SelectedPlacesMap: {
    places: SelectedMapPlace[];
  };
};

export type LocationTabsParamList = {
  Map: undefined;
  Weather: undefined;
  Nearby: undefined;
  Info: undefined;
};