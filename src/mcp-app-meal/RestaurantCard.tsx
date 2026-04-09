/**
 * Single restaurant card in the carousel.
 */

import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback } from 'react';
import type { Recommendation } from './types';
import { getCuisineTheme } from './themes';
import { CravingMeter } from './CravingMeter';
import { PopularTimes } from './PopularTimes';
import { mapsDirectionsUrl, mapsSearchUrl, renderStars } from './utils';

interface CardProps {
  rec: Recommendation;
  app: App;
  index: number;
  total: number;
  cravingLevel: number;
}

export function RestaurantCard({ rec, app, index, total, cravingLevel }: CardProps) {
  const { emoji, gradient } = getCuisineTheme(rec.cuisine);

  const openLink = useCallback(
    (url: string) => {
      app.openLink({ url }).catch(console.error);
    },
    [app]
  );

  const openNowText = rec.openNow ? 'Open now' : 'Closed';
  const firstHourLine = rec.openingHours?.split('\n')[0];

  return (
    <div className="card">
      <div
        className="banner"
        style={
          rec.photoUrl
            ? {
                backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%), url(${rec.photoUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : { background: gradient }
        }
      >
        {!rec.photoUrl && <span className="banner-emoji">{emoji}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="cuisine-tag">{rec.cuisine}</span>
          <span className="cuisine-tag" style={{ opacity: 0.85, fontSize: 11 }}>
            {index + 1}/{total}
          </span>
        </div>
      </div>

      <div className="body">
        <div className="name-row">
          <div className="name">{rec.name}</div>
          <div className="rating-pill">
            <span className="star" style={{ color: '#fbbc04' }}>
              ★
            </span>
            <span className="rating-number">{rec.rating.toFixed(1)}</span>
          </div>
        </div>

        <div style={{ color: '#fbbc04', fontSize: 13, letterSpacing: 1 }}>
          {renderStars(rec.rating)}
        </div>

        <div className="meta-row">
          <span className={`open-badge ${rec.openNow ? 'open' : 'closed'}`}>{openNowText}</span>
          {firstHourLine && (
            <>
              <span className="dot">·</span>
              <span className="meta-text">{firstHourLine}</span>
            </>
          )}
          <span className="dot">·</span>
          <span className="meta-text">{rec.distanceKm.toFixed(1)} km away</span>
        </div>

        <div className="address-row">
          <span className="address-icon">📍</span>
          <span className="address">{rec.address}</span>
        </div>

        <div className="divider" />
        <CravingMeter level={cravingLevel} />

        <div className="divider" />
        <PopularTimes />

        {rec.travelAdvisory && (
          <>
            <div className="divider" />
            <div className="advisory-row">
              <span className="advisory-icon">
                {rec.weatherConditions?.toLowerCase().includes('rain')
                  ? '🌧️'
                  : rec.weatherConditions?.toLowerCase().includes('snow')
                    ? '❄️'
                    : rec.weatherConditions?.toLowerCase().includes('thunder')
                      ? '⛈️'
                      : '🌤️'}
              </span>
              <span className="advisory-text">{rec.travelAdvisory}</span>
            </div>
          </>
        )}

        <div className="divider" />

        <div className="actions">
          <button className="btn btn-primary" onClick={() => openLink(mapsDirectionsUrl(rec))}>
            ↗ Directions
          </button>
          <button className="btn btn-secondary" onClick={() => openLink(mapsSearchUrl(rec))}>
            🗺 Maps
          </button>
        </div>
      </div>
    </div>
  );
}
