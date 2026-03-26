/**
 * Shared types for the meal recommendation MCP app UI.
 */

export interface WeatherSnapshot {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

export interface Recommendation {
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  distanceKm: number;
  openNow: boolean;
  openingHours?: string;
  weatherConditions?: string;
  travelAdvisory?: string;
  placeId?: string;
  photoUrl?: string;
}

export interface MealData {
  recommendations: Recommendation[];
  weather?: WeatherSnapshot;
  cravingLevel?: number;
}

export interface InputArgs {
  cuisine?: string;
  location?: string;
  hour?: string;
}

export type LocationSource = 'gps' | 'approximate' | 'pending';

export interface BrowserLocation {
  coords: { lat: number; lng: number } | null;
  source: LocationSource;
}
