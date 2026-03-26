/**
 * Browser geolocation hook — GPS-level precision (~1–10 m).
 */

import { useEffect, useState } from 'react';
import type { BrowserLocation } from './types';

export function useBrowserLocation(): BrowserLocation {
  const [state, setState] = useState<BrowserLocation>({
    coords: null,
    source: 'pending',
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ coords: null, source: 'approximate' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          source: 'gps',
        }),
      () => setState({ coords: null, source: 'approximate' }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  return state;
}
