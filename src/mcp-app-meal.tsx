/**
 * Restaurant Recommendation MCP App UI
 * Google Maps-inspired card using @modelcontextprotocol/ext-apps React SDK.
 */
import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function parseRecommendation(result: CallToolResult): Recommendation | null {
  if (result.structuredContent && 'name' in result.structuredContent) {
    return result.structuredContent as unknown as Recommendation;
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
// Restaurant card
// ---------------------------------------------------------------------------

interface CardProps {
  rec: Recommendation;
  inputArgs: InputArgs;
  app: App;
}

function RestaurantCard({ rec, inputArgs, app }: CardProps) {
  const [loading, setLoading] = useState(false);
  const { emoji, gradient } = getCuisineTheme(rec.cuisine);

  const handleFindAnother = useCallback(async () => {
    if (!inputArgs.cuisine) return;
    setLoading(true);
    try {
      await app.callServerTool({
        name: 'recommend_meal',
        arguments: { ...inputArgs },
      });
    } catch (e) {
      console.error('Find another failed:', e);
    } finally {
      setLoading(false);
    }
  }, [app, inputArgs]);

  const openNowText = rec.openNow ? 'Open now' : 'Closed';
  const firstHourLine = rec.openingHours?.split('\n')[0];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div className="card">
        {/* Header banner */}
        <div className="banner" style={{ background: gradient }}>
          <span className="banner-emoji">{emoji}</span>
          <span className="cuisine-tag">{rec.cuisine}</span>
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
            <a
              className="btn btn-primary"
              href={mapsDirectionsUrl(rec)}
              target="_blank"
              rel="noreferrer"
            >
              ↗ Directions
            </a>
            <a
              className="btn btn-secondary"
              href={mapsSearchUrl(rec)}
              target="_blank"
              rel="noreferrer"
            >
              🗺 Maps
            </a>
            {inputArgs.cuisine && (
              <button
                className="btn btn-secondary"
                onClick={handleFindAnother}
                disabled={loading}
              >
                {loading ? '…' : '🔄 Another'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root app component
// ---------------------------------------------------------------------------

function MealApp() {
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [inputArgs, setInputArgs] = useState<InputArgs>({});

  const { app, error } = useApp({
    appInfo: { name: 'Meal Recommendation App', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = async (input) => {
        setInputArgs((input.arguments as InputArgs) ?? {});
      };
      app.ontoolresult = async (result) => {
        const data = parseRecommendation(result);
        if (data) setRec(data);
      };
      app.ontoolcancelled = (params) => {
        console.info('Tool cancelled:', params.reason);
      };
      app.onerror = console.error;
    },
  });

  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    if (ctx?.toolResult) {
      const data = parseRecommendation(ctx.toolResult as CallToolResult);
      if (data) setRec(data);
    }
  }, [app]);

  if (error)
    return (
      <div className="status" style={{ color: '#c5221f' }}>
        Error: {error.message}
      </div>
    );

  if (!app || !rec)
    return (
      <div className="status">
        {!app ? 'Connecting…' : 'Finding a restaurant…'}
      </div>
    );

  return <RestaurantCard rec={rec} inputArgs={inputArgs} app={app} />;
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MealApp />
  </StrictMode>,
);
