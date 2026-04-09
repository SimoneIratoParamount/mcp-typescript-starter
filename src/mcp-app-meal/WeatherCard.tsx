/**
 * Compact horizontal weather card for the meal app.
 */

import type { WeatherSnapshot } from './types';
import { getWeatherTheme } from './themes';
import { getWeatherPhotoUrlMeal } from './utils';

export function WeatherCard({ w }: { w: WeatherSnapshot }) {
  const { emoji, gradient } = getWeatherTheme(w.conditions);
  const photoUrl = getWeatherPhotoUrlMeal(w.conditions);
  return (
    <div
      style={{
        background: photoUrl ? `url(${photoUrl}) center/cover no-repeat` : gradient,
        borderRadius: 16,
        padding: '16px 20px',
        width: '100%',
        maxWidth: 420,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {photoUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.25) 100%)',
        }} />
      )}
      <span style={{ fontSize: 44, lineHeight: 1, flexShrink: 0, position: 'relative', zIndex: 1 }}>{emoji}</span>
      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          {w.location}
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>
          {w.temperature}
          <span style={{ fontSize: 16, fontWeight: 300, verticalAlign: 'super' }}>°C</span>
        </div>
        <div style={{ fontSize: 13, textTransform: 'capitalize', opacity: 0.9, marginTop: 2 }}>
          {w.conditions}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          textAlign: 'right',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{w.humidity}%</div>
          <div
            style={{
              fontSize: 10,
              opacity: 0.72,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Humidity
          </div>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{w.windSpeed} m/s</div>
          <div
            style={{
              fontSize: 10,
              opacity: 0.72,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Wind
          </div>
        </div>
      </div>
    </div>
  );
}
