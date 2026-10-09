import { createContext, useContext } from "react";
import type { Location } from "../navigation/types";

export const SelectedLocationContext =
  createContext<Location | null>(null);

export function useSelectedLocation(): Location {
  const location = useContext(SelectedLocationContext);

  if (location === null) {
    throw new Error(
      "useSelectedLocation must be used inside SelectedLocationContext.Provider"
    );
  }

  return location;
}