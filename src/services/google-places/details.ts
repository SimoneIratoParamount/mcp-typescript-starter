/**
 * Place Details (Legacy) — opening hours and photo URLs.
 */

import type { OpeningPeriod, PlaceOpeningHours } from './types';

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
export function isOpenAtHour(periods: OpeningPeriod[], day: number, hhmm: string): boolean {
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
      const nextDay = (openDay + 1) % 7;
      if (day === openDay && target >= openTime) return true;
      if (day === nextDay && target < closeTime) return true;
    }
  }

  return false;
}

/**
 * Resolve a Places photo_reference to a public CDN URL by following Google's
 * redirect server-side. The returned URL has no API key in it.
 * Returns null if the photo cannot be fetched.
 */
export async function getPlacePhotoUrl(
  photoReference: string,
  apiKey: string,
  maxWidth = 800
): Promise<string | null> {
  const url =
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${apiKey}`;
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const location = res.headers.get('location');
    if (location) return location;
    if (res.ok) return url;
    return null;
  } catch {
    return null;
  }
}
