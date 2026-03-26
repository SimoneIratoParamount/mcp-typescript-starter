/**
 * Places API (Legacy) text search for restaurants.
 */

import type { RestaurantResult } from './types';
import { haversineKm } from './distance';

/** Legacy Places API result item. */
interface LegacyPlaceResult {
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  rating?: number;
  place_id?: string;
  opening_hours?: { open_now?: boolean };
  photos?: Array<{ photo_reference: string }>;
}

interface LegacyPlacesResponse {
  results?: LegacyPlaceResult[];
  status: string;
  error_message?: string;
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
        photoReference: p.photos?.[0]?.photo_reference,
      };
    });
}
