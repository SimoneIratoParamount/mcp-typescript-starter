/**
 * Google Maps integration for restaurant search.
 * Uses Geocoding API to resolve location, Places API (Legacy) for text search,
 * and Place Details (Legacy) for opening-hours lookup.
 */

export type { RestaurantResult, OpeningPeriod, PlaceOpeningHours } from './types';
export {
  geocodeAddress,
  parseLatLng,
  ipToLatLng,
  geolocateViaGoogle,
  resolveLocation,
} from './geolocation';
export { searchRestaurants } from './search';
export { getPlaceOpeningHours, isOpenAtHour, getPlacePhotoUrl } from './details';
