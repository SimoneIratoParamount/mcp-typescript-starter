/**
 * Google Maps integration for restaurant search.
 * Uses Geocoding API to resolve location and Places API (Legacy) for text search.
 */

export interface RestaurantResult {
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  distanceKm: number;
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
}

interface LegacyPlacesResponse {
  results?: LegacyPlaceResult[];
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
        name: p.name ?? 'Unnamed place',
        cuisine: cuisineLower,
        address: p.formatted_address ?? '',
        rating: typeof p.rating === 'number' ? p.rating : 0,
        distanceKm: Math.round(distanceKm * 10) / 10,
      };
    });
}
