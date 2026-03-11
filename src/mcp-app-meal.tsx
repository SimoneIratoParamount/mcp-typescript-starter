/**
 * Restaurant Recommendation MCP App UI
 * Google Maps-inspired carousel using @modelcontextprotocol/ext-apps React SDK.
 */
import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeatherSnapshot {
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

interface Recommendation {
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  distanceKm: number;
  openNow: boolean;
  openingHours?: string;
  weatherConditions?: string;
  travelAdvisory?: string;
  placeId?: string;
  photoUrl?: string;
}

interface MealData {
  recommendations: Recommendation[];
  weather?: WeatherSnapshot;
}

interface InputArgs {
  cuisine?: string;
  location?: string;
  hour?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CuisineTheme {
  emoji: string;
  gradient: string;
}

function getCuisineTheme(cuisine: string): CuisineTheme {
  const c = cuisine.toLowerCase();
  if (c.includes('italian') || c.includes('pizza') || c.includes('pasta'))
    return { emoji: '🍝', gradient: 'linear-gradient(135deg, #c62828 0%, #e57373 100%)' };
  if (c.includes('japanese') || c.includes('sushi') || c.includes('ramen'))
    return { emoji: '🍣', gradient: 'linear-gradient(135deg, #283593 0%, #7986cb 100%)' };
  if (c.includes('mexican') || c.includes('taco') || c.includes('burrito'))
    return { emoji: '🌮', gradient: 'linear-gradient(135deg, #e65100 0%, #ffb74d 100%)' };
  if (c.includes('thai'))
    return { emoji: '🍜', gradient: 'linear-gradient(135deg, #1b5e20 0%, #66bb6a 100%)' };
  if (c.includes('chinese') || c.includes('dim sum'))
    return { emoji: '🥟', gradient: 'linear-gradient(135deg, #b71c1c 0%, #ef9a9a 100%)' };
  if (c.includes('indian') || c.includes('curry'))
    return { emoji: '🍛', gradient: 'linear-gradient(135deg, #bf360c 0%, #ff8a65 100%)' };
  if (c.includes('french'))
    return { emoji: '🥐', gradient: 'linear-gradient(135deg, #0d47a1 0%, #64b5f6 100%)' };
  if (c.includes('burger') || c.includes('american'))
    return { emoji: '🍔', gradient: 'linear-gradient(135deg, #4e342e 0%, #a1887f 100%)' };
  if (c.includes('greek'))
    return { emoji: '🫒', gradient: 'linear-gradient(135deg, #004d40 0%, #4db6ac 100%)' };
  if (c.includes('korean'))
    return { emoji: '🥩', gradient: 'linear-gradient(135deg, #880e4f 0%, #f48fb1 100%)' };
  if (c.includes('vietnamese') || c.includes('pho'))
    return { emoji: '🍲', gradient: 'linear-gradient(135deg, #33691e 0%, #aed581 100%)' };
  if (c.includes('spanish') || c.includes('tapas'))
    return { emoji: '🥘', gradient: 'linear-gradient(135deg, #f57f17 0%, #fff176 100%)' };
  return { emoji: '🍽️', gradient: 'linear-gradient(135deg, #01579b 0%, #4fc3f7 100%)' };
}

function getWeatherTheme(conditions: string): { emoji: string; gradient: string } {
  const c = conditions.toLowerCase();
  if (c.includes('thunder') || c.includes('storm'))
    return { emoji: '⛈️', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' };
  if (c.includes('snow') || c.includes('sleet'))
    return { emoji: '❄️', gradient: 'linear-gradient(135deg, #83a4d4 0%, #b6fbff 100%)' };
  if (c.includes('rain'))
    return { emoji: '🌧️', gradient: 'linear-gradient(135deg, #373B44 0%, #4286f4 100%)' };
  if (c.includes('drizzle'))
    return { emoji: '🌦️', gradient: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)' };
  if (c.includes('fog') || c.includes('mist') || c.includes('haze'))
    return { emoji: '🌫️', gradient: 'linear-gradient(135deg, #8e9eab 0%, #c8d6df 100%)' };
  if (c.includes('cloud') || c.includes('overcast'))
    return { emoji: '☁️', gradient: 'linear-gradient(135deg, #616161 0%, #9bc5c3 100%)' };
  return { emoji: '☀️', gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' };
}

// ---------------------------------------------------------------------------
// Rush hour logic (heuristic — no API needed)
// ---------------------------------------------------------------------------

interface RushStatus {
  level: 'low' | 'medium' | 'high';
  label: string;
  color: string;
  bg: string;
}

/**
 * Returns relative busyness (0–10) for a given hour of the day (0–23)
 * based on a typical sit-down restaurant pattern.
 */
function busynessAt(hour: number, isWeekend: boolean): number {
  const weekday: Record<number, number> = {
    9: 1,
    10: 2,
    11: 4,
    12: 9,
    13: 10,
    14: 7,
    15: 3,
    16: 2,
    17: 4,
    18: 8,
    19: 10,
    20: 9,
    21: 6,
    22: 3,
  };
  const weekend: Record<number, number> = {
    9: 2,
    10: 4,
    11: 6,
    12: 8,
    13: 9,
    14: 8,
    15: 6,
    16: 4,
    17: 5,
    18: 7,
    19: 10,
    20: 10,
    21: 7,
    22: 4,
  };
  return (isWeekend ? weekend : weekday)[hour] ?? 0;
}

function getRushStatus(): RushStatus {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const t = h + m / 60;

  // Lunch rush
  const lunchStart = isWeekend ? 12 : 11.5;
  const lunchEnd = isWeekend ? 14.5 : 14;
  if (t >= lunchStart && t < lunchEnd)
    return { level: 'high', label: 'Lunch rush', color: '#c5221f', bg: '#fce8e6' };
  // Dinner rush
  if (t >= 18 && t < 21)
    return { level: 'high', label: 'Dinner rush', color: '#c5221f', bg: '#fce8e6' };
  // Approaching busy periods
  if ((t >= 11 && t < lunchStart) || (t >= 17 && t < 18))
    return { level: 'medium', label: 'Getting busier', color: '#b45309', bg: '#fef3c7' };

  return { level: 'low', label: 'Usually not busy', color: '#188038', bg: '#e6f4ea' };
}

// ---------------------------------------------------------------------------

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function parseMealData(result: CallToolResult): MealData | null {
  const sc = result.structuredContent;
  if (sc && 'recommendations' in sc && Array.isArray(sc.recommendations)) {
    return sc as unknown as MealData;
  }
  return null;
}

function mapsDirectionsUrl(rec: Recommendation): string {
  const dest = encodeURIComponent(rec.address);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

function mapsSearchUrl(rec: Recommendation): string {
  if (rec.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${rec.placeId}`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(rec.name + ' ' + rec.address)}`;
}

// ---------------------------------------------------------------------------
// Popular times bar chart
// ---------------------------------------------------------------------------

function PopularTimes() {
  const now = new Date();
  const currentHour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const rush = getRushStatus();
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  return (
    <div style={{ marginTop: 2 }}>
      {/* Rush badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#3c4043' }}>Popular times</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 100,
            color: rush.color,
            background: rush.bg,
          }}
        >
          {rush.level === 'high' ? '🔴' : rush.level === 'medium' ? '🟡' : '🟢'} {rush.label}
        </span>
      </div>

      {/* Bar chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
        {hours.map((h) => {
          const busy = busynessAt(h, isWeekend);
          const isCurrent = h === currentHour;
          const barHeight = Math.max(4, Math.round((busy / 10) * 32));
          return (
            <div
              key={h}
              title={`${h}:00`}
              style={{
                flex: 1,
                height: barHeight,
                borderRadius: '3px 3px 0 0',
                background: isCurrent
                  ? rush.level === 'high'
                    ? '#c5221f'
                    : rush.level === 'medium'
                      ? '#f59e0b'
                      : '#188038'
                  : '#dadce0',
                transition: 'height 0.2s',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>

      {/* Hour labels */}
      <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
        {hours.map((h) => (
          <div
            key={h}
            style={{
              flex: 1,
              fontSize: 8,
              textAlign: 'center',
              color: h === currentHour ? '#1a73e8' : '#9aa0a6',
              fontWeight: h === currentHour ? 700 : 400,
            }}
          >
            {h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weather card (compact horizontal)
// ---------------------------------------------------------------------------

// Same photo map as mcp-app.tsx
const WEATHER_PHOTOS_MEAL: Array<[string, string]> = [
  ['thunder', 'photo-1429552077091-836152271555'],
  ['storm',   'photo-1429552077091-836152271555'],
  ['snow',    'photo-1491002052546-bf38f186af56'],
  ['sleet',   'photo-1491002052546-bf38f186af56'],
  ['rain',    'photo-1519692933481-e162a57d6721'],
  ['drizzle', 'photo-1519692933481-e162a57d6721'],
  ['fog',     'photo-1495107334309-fcf20504a5ab'],
  ['mist',    'photo-1495107334309-fcf20504a5ab'],
  ['haze',    'photo-1495107334309-fcf20504a5ab'],
  ['cloud',   'photo-1534088568595-a066f410bcda'],
  ['overcast','photo-1534088568595-a066f410bcda'],
  ['clear',   'photo-1507003211169-0a1dd7228f2d'],
  ['sunny',   'photo-1507003211169-0a1dd7228f2d'],
];

function getWeatherPhotoUrlMeal(conditions: string): string | null {
  const c = conditions.toLowerCase();
  for (const [key, id] of WEATHER_PHOTOS_MEAL) {
    if (c.includes(key)) {
      return `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;
    }
  }
  return null;
}

function WeatherCard({ w }: { w: WeatherSnapshot }) {
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

// ---------------------------------------------------------------------------
// Restaurant card (individual)
// ---------------------------------------------------------------------------

interface CardProps {
  rec: Recommendation;
  app: App;
  index: number;
  total: number;
}

function RestaurantCard({ rec, app, index, total }: CardProps) {
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
      {/* Header banner — real photo when available, gradient fallback */}
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
        {/* Name + rating */}
        <div className="name-row">
          <div className="name">{rec.name}</div>
          <div className="rating-pill">
            <span className="star" style={{ color: '#fbbc04' }}>
              ★
            </span>
            <span className="rating-number">{rec.rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Stars row */}
        <div style={{ color: '#fbbc04', fontSize: 13, letterSpacing: 1 }}>
          {renderStars(rec.rating)}
        </div>

        {/* Status + distance */}
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

        {/* Address */}
        <div className="address-row">
          <span className="address-icon">📍</span>
          <span className="address">{rec.address}</span>
        </div>

        {/* Popular times */}
        <div className="divider" />
        <PopularTimes />

        {/* Travel advisory */}
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

        {/* Action buttons */}
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

// ---------------------------------------------------------------------------
// Carousel
// ---------------------------------------------------------------------------

interface CarouselProps {
  recommendations: Recommendation[];
  app: App;
}

function Carousel({ recommendations, app }: CarouselProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const total = recommendations.length;

  const prev = useCallback(() => setActiveIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setActiveIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prev, next]);

  if (total === 0) return null;

  return (
    <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
      {/* Navigation arrows */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="carousel-arrow carousel-arrow-left"
            aria-label="Previous"
          >
            ‹
          </button>
          <button onClick={next} className="carousel-arrow carousel-arrow-right" aria-label="Next">
            ›
          </button>
        </>
      )}

      {/* Card track */}
      <div style={{ overflow: 'hidden', borderRadius: 16 }}>
        <div
          style={{
            display: 'flex',
            transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: `translateX(-${activeIdx * 100}%)`,
          }}
        >
          {recommendations.map((rec, i) => (
            <div key={rec.placeId ?? i} style={{ minWidth: '100%', flexShrink: 0 }}>
              <RestaurantCard rec={rec} app={app} index={i} total={total} />
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div className="carousel-dots">
          {recommendations.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`carousel-dot ${i === activeIdx ? 'active' : ''}`}
              aria-label={`Go to result ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root app component
// ---------------------------------------------------------------------------

function MealApp() {
  const [data, setData] = useState<MealData | null>(null);
  const [inputArgs, setInputArgs] = useState<InputArgs>({});
  const [refreshing, setRefreshing] = useState(false);

  const { app, error } = useApp({
    appInfo: { name: 'Meal Recommendation App', version: '2.0.0' },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = async (input) => {
        setInputArgs((input.arguments as InputArgs) ?? {});
      };
      app.ontoolresult = async (result) => {
        const parsed = parseMealData(result);
        if (parsed) setData(parsed);
      };
      app.ontoolcancelled = (params) => {
        console.info('Tool cancelled:', params.reason);
      };
      app.onerror = console.error;
    },
  });

  const handleRefresh = useCallback(async () => {
    if (!app || !inputArgs.cuisine) return;
    setRefreshing(true);
    try {
      const result = await app.callServerTool({
        name: 'recommend_meal',
        arguments: { ...inputArgs },
      });
      const parsed = parseMealData(result);
      if (parsed) setData(parsed);
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [app, inputArgs]);

  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    if (ctx?.toolResult) {
      const parsed = parseMealData(ctx.toolResult as CallToolResult);
      if (parsed) setData(parsed);
    }
  }, [app]);

  if (error)
    return (
      <div className="status" style={{ color: '#c5221f' }}>
        Error: {error.message}
      </div>
    );

  if (!app || !data)
    return <div className="status">{!app ? 'Connecting…' : 'Finding restaurants…'}</div>;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f3f4',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 16,
      }}
    >
      {data.weather && <WeatherCard w={data.weather} />}
      <Carousel recommendations={data.recommendations} app={app} />
      {inputArgs.cuisine && (
        <button
          className="btn btn-secondary"
          style={{ marginTop: 4 }}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Searching…' : '🔄 Search again'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MealApp />
  </StrictMode>
);
