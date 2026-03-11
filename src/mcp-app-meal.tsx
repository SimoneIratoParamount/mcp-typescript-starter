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
// Weather card (compact horizontal)
// ---------------------------------------------------------------------------

function WeatherCard({ w }: { w: WeatherSnapshot }) {
  const { emoji, gradient } = getWeatherTheme(w.conditions);
  return (
    <div
      style={{
        background: gradient,
        borderRadius: 16,
        padding: '16px 20px',
        width: '100%',
        maxWidth: 420,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
      }}
    >
      <span style={{ fontSize: 44, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', opacity: 0.85 }}>
          {w.location}
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>
          {w.temperature}<span style={{ fontSize: 16, fontWeight: 300, verticalAlign: 'super' }}>°C</span>
        </div>
        <div style={{ fontSize: 13, textTransform: 'capitalize', opacity: 0.9, marginTop: 2 }}>
          {w.conditions}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'right', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{w.humidity}%</div>
          <div style={{ fontSize: 10, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Humidity</div>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{w.windSpeed} m/s</div>
          <div style={{ fontSize: 10, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wind</div>
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

  const openLink = useCallback((url: string) => {
    app.openLink({ url }).catch(console.error);
  }, [app]);

  const openNowText = rec.openNow ? 'Open now' : 'Closed';
  const firstHourLine = rec.openingHours?.split('\n')[0];

  return (
    <div className="card">
      {/* Header banner */}
      <div className="banner" style={{ background: gradient }}>
        <span className="banner-emoji">{emoji}</span>
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
            <span className="star" style={{ color: '#fbbc04' }}>★</span>
            <span className="rating-number">{rec.rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Stars row */}
        <div style={{ color: '#fbbc04', fontSize: 13, letterSpacing: 1 }}>
          {renderStars(rec.rating)}
        </div>

        {/* Status + distance */}
        <div className="meta-row">
          <span className={`open-badge ${rec.openNow ? 'open' : 'closed'}`}>
            {openNowText}
          </span>
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

        {/* Travel advisory */}
        {rec.travelAdvisory && (
          <>
            <div className="divider" />
            <div className="advisory-row">
              <span className="advisory-icon">
                {rec.weatherConditions?.toLowerCase().includes('rain') ? '🌧️' :
                 rec.weatherConditions?.toLowerCase().includes('snow') ? '❄️' :
                 rec.weatherConditions?.toLowerCase().includes('thunder') ? '⛈️' : '🌤️'}
              </span>
              <span className="advisory-text">{rec.travelAdvisory}</span>
            </div>
          </>
        )}

        <div className="divider" />

        {/* Action buttons */}
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={() => openLink(mapsDirectionsUrl(rec))}
          >
            ↗ Directions
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => openLink(mapsSearchUrl(rec))}
          >
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
          <button
            onClick={next}
            className="carousel-arrow carousel-arrow-right"
            aria-label="Next"
          >
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
    return (
      <div className="status">
        {!app ? 'Connecting…' : 'Finding restaurants…'}
      </div>
    );

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
  </StrictMode>,
);
