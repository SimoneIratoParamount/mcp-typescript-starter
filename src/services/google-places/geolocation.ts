/**
 * Geocoding, lat/lng parsing, IP lookup, and Google Geolocation API fallback.
 */

import * as geoip from 'geoip-lite';

interface GeocodeResult {
  results: Array<{
    geometry: { location: { lat: number; lng: number } };
  }>;
  status: string;
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
 * Convert an IP address to approximate lat/lng using the offline geoip-lite
 * database. Returns null if the lookup fails or the address is invalid.
 */
export function ipToLatLng(ip: string): { lat: number; lng: number } | null {
  try {
    const geo = geoip.lookup(ip);
    if (geo?.ll && geo.ll.length === 2) {
      return { lat: geo.ll[0], lng: geo.ll[1] };
    }
  } catch {
    // lookup failed
  }
  return null;
}

interface GeolocationResponse {
  location?: { lat: number; lng: number };
  accuracy?: number;
  error?: { message: string };
}

/**
 * Use Google Maps Geolocation API to estimate position from the server's IP.
 * Useful as a last-resort fallback when the client IP can't be resolved
 * offline (e.g. loopback addresses during local development).
 */
export async function geolocateViaGoogle(
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://www.googleapis.com/geolocation/v1/geolocate?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ considerIp: true }),
  });

  const data = (await res.json()) as GeolocationResponse;
  if (data.location?.lat != null && data.location?.lng != null) {
    return { lat: data.location.lat, lng: data.location.lng };
  }
  return null;
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
