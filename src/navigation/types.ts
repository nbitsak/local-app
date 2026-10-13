
export type Location = {
  id: number;
  real_location: string;
  city: string;
  country_code: string;
  latitude: number;
  longitude: number;
  source_url: string;
};

export type RootStackParamList = {
  PreviousLocations: undefined;
  LocationScreen: { location: Location };
  LocationDetails: { location: Location };
  Main: undefined;
  Wikipedia: {
    title: string;
    url: string;
  };
};

export type LocationTabsParamList = {
  Map: undefined;
  Weather: undefined;
  Nearby: undefined;
  Info: undefined;
};