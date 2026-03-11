/**
 * Restaurant database loader.
 * Single source of truth for restaurant data; used by the MCP resource and by recommend_meal.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  distanceKm: number;
  plateQuantity: number;
  address: string;
  rating: number;
  openingHours: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Path to the restaurant DB JSON (works from src/ in dev and dist/ when JSON is copied). */
function getDbPath(): string {
  return join(__dirname, 'restaurants.json');
}

/** Load and parse the restaurant database. */
export function loadRestaurants(): Restaurant[] {
  const raw = readFileSync(getDbPath(), 'utf-8');
  return JSON.parse(raw) as Restaurant[];
}

/** Load and return the raw JSON string (for the resource to serve as-is). */
export function loadRestaurantsJson(): string {
  return readFileSync(getDbPath(), 'utf-8');
}
