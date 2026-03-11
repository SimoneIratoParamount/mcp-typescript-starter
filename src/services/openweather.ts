/**
 * OpenWeatherMap integration for real-world weather data.
 *
 *  - OWM Geocoding API: city name → lat/lon
 *  - OWM Current Weather API: lat/lon → current conditions
 */

export interface WeatherResult {
  location: string;
  temperature: number;
  unit: string;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

// ---------------------------------------------------------------------------
// OWM Geocoding
// ---------------------------------------------------------------------------

interface OWMGeoResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

/**
 * Convert a city name to lat/lon using the OWM Geocoding API.
 */
async function geocodeCity(
  city: string,
  apiKey: string
): Promise<{ lat: number; lon: number; label: string } | null> {
  const url = new URL('http://api.openweathermap.org/geo/1.0/direct');
  url.searchParams.set('q', city.trim());
  url.searchParams.set('limit', '1');
  url.searchParams.set('appid', apiKey);

  const res = await fetch(url.toString());
  const data = (await res.json()) as OWMGeoResult[];
  if (!Array.isArray(data) || !data.length) return null;

  const g = data[0];
  const label = [g.name, g.state, g.country].filter(Boolean).join(', ');
  return { lat: g.lat, lon: g.lon, label };
}

// ---------------------------------------------------------------------------
// OWM Current Weather
// ---------------------------------------------------------------------------

interface OWMWeatherResponse {
  name?: string;
  sys?: { country?: string };
  main?: { temp?: number; humidity?: number };
  weather?: Array<{ description?: string }>;
  wind?: { speed?: number };
  cod?: number | string;
  message?: string;
}

/**
 * Classify whether conditions are weather-adverse (rain, storm, snow, fog…).
 */
export type WeatherSeverity = 'good' | 'bad';

export function classifyWeather(conditions: string): WeatherSeverity {
  const bad = ['rain', 'drizzle', 'storm', 'thunder', 'snow', 'sleet', 'blizzard', 'hail', 'fog', 'mist'];
  const lower = conditions.toLowerCase();
  return bad.some((w) => lower.includes(w)) ? 'bad' : 'good';
}

/**
 * Fetch current weather from OWM using coordinates.
 * Units are metric (°C, m/s).
 */
export async function fetchWeatherByCoords(
  lat: number,
  lon: number,
  locationLabel: string,
  apiKey: string
): Promise<WeatherResult> {
  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('units', 'metric');
  url.searchParams.set('appid', apiKey);

  const res = await fetch(url.toString());
  const data = (await res.json()) as OWMWeatherResponse;

  if (!res.ok || (data.cod && Number(data.cod) !== 200)) {
    throw new Error(`OpenWeatherMap error: ${data.message ?? res.statusText}`);
  }

  const cityName = [data.name, data.sys?.country].filter(Boolean).join(', ');

  return {
    location: cityName || locationLabel,
    temperature: Math.round(data.main?.temp ?? 0),
    unit: 'celsius',
    conditions: data.weather?.[0]?.description ?? 'unknown',
    humidity: Math.round(data.main?.humidity ?? 0),
    windSpeed: Math.round((data.wind?.speed ?? 0) * 10) / 10,
  };
}

/**
 * Get current weather for a named location.
 * Geocodes the city name via OWM, then fetches current conditions.
 */
export async function getWeather(
  location: string,
  apiKey: string
): Promise<WeatherResult> {
  const coords = await geocodeCity(location, apiKey);
  if (!coords) {
    throw new Error(
      `Could not find location "${location}". Try a city name like "Berlin" or "Tokyo, JP".`
    );
  }
  return fetchWeatherByCoords(coords.lat, coords.lon, coords.label, apiKey);
}
