/**
 * Google Maps integration for restaurant search.
 * Uses Geocoding API to resolve location, Places API (Legacy) for text search,
 * and Place Details (Legacy) for opening-hours lookup.
 */

export interface RestaurantResult {
  placeId: string;
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  distanceKm: number;
  openNow: boolean;
}

interface GeocodeResult {
  results: Array<{
    geometry: { location: { lat: number; lng: number } };
  }>;
  status: string;
}

/** Legacy Places API result item. */
interface LegacyPlaceResult {
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  rating?: number;
  place_id?: string;
  opening_hours?: { open_now?: boolean };
}

interface LegacyPlacesResponse {
  results?: LegacyPlaceResult[];
  status: string;
  error_message?: string;
}

export interface OpeningPeriod {
  open: { day: number; time: string };
  close?: { day: number; time: string };
}

export interface PlaceOpeningHours {
  periods: OpeningPeriod[];
  weekdayText: string[];
}

interface PlaceDetailsResponse {
  result?: {
    opening_hours?: {
      periods?: Array<{
        open: { day: number; time: string };
        close?: { day: number; time: string };
      }>;
      weekday_text?: string[];
    };
  };
  status: string;
  error_message?: string;
}

/** Earth radius in km for haversine distance. */
const R_KM = 6371;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_KM * c;
}

/**
 * Resolve an address or place name to lat/lng using Geocoding API.
 */
export async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address.trim());
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  const data = (await res.json()) as GeocodeResult;

  if (data.status !== 'OK' || !data.results?.length) {
    return null;
  }

  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

/**
 * Parse "lat,lng" or return null if not valid.
 */
export function parseLatLng(location: string): { lat: number; lng: number } | null {
  const trimmed = location.trim();
  const parts = trimmed.split(/[\s,]+/);
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Resolve location string to lat/lng: either "lat,lng" or geocode the address.
 */
export async function resolveLocation(
  location: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  const parsed = parseLatLng(location);
  if (parsed) return parsed;
  return geocodeAddress(location, apiKey);
}

/**
 * Search for restaurants by cuisine near the given coordinates using Places API (Legacy).
 * GET https://maps.googleapis.com/maps/api/place/textsearch/json
 */
export async function searchRestaurants(
  cuisine: string,
  centerLat: number,
  centerLng: number,
  apiKey: string
): Promise<RestaurantResult[]> {
  const query = `${cuisine} restaurant`;
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('location', `${centerLat},${centerLng}`);
  url.searchParams.set('radius', '5000');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  const data = (await res.json()) as LegacyPlacesResponse;

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    const msg = data.error_message ?? res.statusText;
    throw new Error(`Google Places API error: ${msg}`);
  }

  const results = data.results ?? [];
  const cuisineLower = cuisine.toLowerCase();

  return results
    .filter((p) => p.name || p.formatted_address)
    .map((p) => {
      const lat = p.geometry?.location?.lat ?? centerLat;
      const lng = p.geometry?.location?.lng ?? centerLng;
      const distanceKm = haversineKm(centerLat, centerLng, lat, lng);
      return {
        placeId: p.place_id ?? '',
        name: p.name ?? 'Unnamed place',
        cuisine: cuisineLower,
        address: p.formatted_address ?? '',
        rating: typeof p.rating === 'number' ? p.rating : 0,
        distanceKm: Math.round(distanceKm * 10) / 10,
        openNow: p.opening_hours?.open_now ?? false,
      };
    });
}

/**
 * Fetch opening hours for a place via Place Details (Legacy).
 * GET /maps/api/place/details/json?place_id=...&fields=opening_hours
 */
export async function getPlaceOpeningHours(
  placeId: string,
  apiKey: string
): Promise<PlaceOpeningHours | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'opening_hours');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  const data = (await res.json()) as PlaceDetailsResponse;

  if (data.status !== 'OK') return null;

  const oh = data.result?.opening_hours;
  if (!oh?.periods?.length) return null;

  return {
    periods: oh.periods.map((p) => ({
      open: p.open,
      close: p.close,
    })),
    weekdayText: oh.weekday_text ?? [],
  };
}

/**
 * Check whether a place is open at a specific day + time based on its periods.
 * @param periods - from Place Details `opening_hours.periods`
 * @param day - JS day-of-week: 0 = Sunday, 6 = Saturday
 * @param hhmm - time in "HHMM" format (e.g. "1000", "1430")
 */
export function isOpenAtHour(
  periods: OpeningPeriod[],
  day: number,
  hhmm: string
): boolean {
  // A single period with open day=0 time="0000" and no close means open 24/7
  if (
    periods.length === 1 &&
    periods[0].open.day === 0 &&
    periods[0].open.time === '0000' &&
    !periods[0].close
  ) {
    return true;
  }

  const target = parseInt(hhmm, 10);

  for (const period of periods) {
    if (!period.close) continue;

    const openDay = period.open.day;
    const closeDay = period.close.day;
    const openTime = parseInt(period.open.time, 10);
    const closeTime = parseInt(period.close.time, 10);

    if (openDay === closeDay) {
      if (day === openDay && target >= openTime && target < closeTime) {
        return true;
      }
    } else {
      // Overnight span (e.g. open Friday 2200, close Saturday 0200)
      const nextDay = (openDay + 1) % 7;
      if (day === openDay && target >= openTime) return true;
      if (day === nextDay && target < closeTime) return true;
    }
  }

  return false;
}
