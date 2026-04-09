/**
 * Public types for Google Maps / Places integration.
 */

export interface RestaurantResult {
  placeId: string;
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  distanceKm: number;
  openNow: boolean;
  photoReference?: string;
}

export interface OpeningPeriod {
  open: { day: number; time: string };
  close?: { day: number; time: string };
}

export interface PlaceOpeningHours {
  periods: OpeningPeriod[];
  weekdayText: string[];
}
