/**
 * Parsing, formatting, and Unsplash helpers for the meal app UI.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MealData, Recommendation } from './types';

export function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

export function parseMealData(result: CallToolResult): MealData | null {
  const sc = result.structuredContent;
  if (sc && 'recommendations' in sc && Array.isArray(sc.recommendations)) {
    return sc as unknown as MealData;
  }
  return null;
}

export function mapsDirectionsUrl(rec: Recommendation): string {
  const dest = encodeURIComponent(rec.address);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export function mapsSearchUrl(rec: Recommendation): string {
  if (rec.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${rec.placeId}`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(rec.name + ' ' + rec.address)}`;
}

/** Same photo map as mcp-app.tsx */
const WEATHER_PHOTOS_MEAL: Array<[string, string]> = [
  ['thunder', 'photo-1429552077091-836152271555'],
  ['storm', 'photo-1429552077091-836152271555'],
  ['snow', 'photo-1491002052546-bf38f186af56'],
  ['sleet', 'photo-1491002052546-bf38f186af56'],
  ['rain', 'photo-1519692933481-e162a57d6721'],
  ['drizzle', 'photo-1519692933481-e162a57d6721'],
  ['fog', 'photo-1495107334309-fcf20504a5ab'],
  ['mist', 'photo-1495107334309-fcf20504a5ab'],
  ['haze', 'photo-1495107334309-fcf20504a5ab'],
  ['cloud', 'photo-1534088568595-a066f410bcda'],
  ['overcast', 'photo-1534088568595-a066f410bcda'],
  ['clear', 'photo-1507003211169-0a1dd7228f2d'],
  ['sunny', 'photo-1507003211169-0a1dd7228f2d'],
];

export function getWeatherPhotoUrlMeal(conditions: string): string | null {
  const c = conditions.toLowerCase();
  for (const [key, id] of WEATHER_PHOTOS_MEAL) {
    if (c.includes(key)) {
      return `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;
    }
  }
  return null;
}
