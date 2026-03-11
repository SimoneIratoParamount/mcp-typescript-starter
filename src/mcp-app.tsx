/**
 * Weather MCP App UI — rendered inside the host when get_weather is called.
 * Uses @modelcontextprotocol/ext-apps React SDK.
 */
import type { App } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeatherData {
  location: string;
  temperature: number;
  unit: string;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Theme {
  emoji: string;
  gradient: string;
}

// Curated Unsplash photo IDs per weather condition (stable CDN URLs, no API key needed)
const WEATHER_PHOTOS: Array<[string, string]> = [
  ['thunder', 'photo-1429552077091-836152271555'],
  ['storm',   'photo-1429552077091-836152271555'],
  ['snow',    'photo-1491002052546-bf38f186af56'],
  ['sleet',   'photo-1491002052546-bf38f186af56'],
  ['blizzard','photo-1491002052546-bf38f186af56'],
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

function getWeatherPhotoUrl(conditions: string): string | null {
  const c = conditions.toLowerCase();
  for (const [key, id] of WEATHER_PHOTOS) {
    if (c.includes(key)) {
      return `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;
    }
  }
  return null;
}

function getTheme(conditions: string): Theme {
  const c = conditions.toLowerCase();
  if (c.includes('thunder') || c.includes('storm'))
    return { emoji: '⛈️', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' };
  if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard'))
    return { emoji: '❄️', gradient: 'linear-gradient(135deg, #83a4d4 0%, #b6fbff 100%)' };
  if (c.includes('rain'))
    return { emoji: '🌧️', gradient: 'linear-gradient(135deg, #373B44 0%, #4286f4 100%)' };
  if (c.includes('drizzle'))
    return { emoji: '🌦️', gradient: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)' };
  if (c.includes('fog') || c.includes('mist') || c.includes('haze'))
    return { emoji: '🌫️', gradient: 'linear-gradient(135deg, #8e9eab 0%, #c8d6df 100%)' };
  if (c.includes('cloud') || c.includes('overcast'))
    return { emoji: '☁️', gradient: 'linear-gradient(135deg, #616161 0%, #9bc5c3 100%)' };
  if (c.includes('wind'))
    return { emoji: '💨', gradient: 'linear-gradient(135deg, #56CCF2 0%, #2F80ED 100%)' };
  return { emoji: '☀️', gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' };
}

function parseWeather(result: CallToolResult): WeatherData | null {
  // Primary: read from structuredContent (tool returns no text to keep UI clean)
  if (result.structuredContent && 'temperature' in result.structuredContent) {
    return result.structuredContent as unknown as WeatherData;
  }
  // Fallback: JSON text (for older versions or non-UI hosts)
  const item = result.content?.find((c) => c.type === 'text');
  if (!item || item.type !== 'text') return null;
  try {
    return JSON.parse(item.text) as WeatherData;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Weather card component
// ---------------------------------------------------------------------------

interface WeatherCardProps {
  weather: WeatherData;
  inputCity: string;
  app: App;
}

function WeatherCard({ weather, inputCity, app }: WeatherCardProps) {
  const [loading, setLoading] = useState(false);
  const { emoji, gradient } = getTheme(weather.conditions);
  const photoUrl = getWeatherPhotoUrl(weather.conditions);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await app.callServerTool({ name: 'get_weather', arguments: { city: inputCity } });
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setLoading(false);
    }
  }, [app, inputCity]);

  return (
    <div
      style={{
        background: photoUrl ? `url(${photoUrl}) center/cover no-repeat` : gradient,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
      }}
    >
      {photoUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 100%)',
        }} />
      )}
      <div className="card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="card-left">
          <span className="emoji">{emoji}</span>
          <div className="temp">
            {weather.temperature}
            <span className="unit">°C</span>
          </div>
        </div>
        <div className="vdivider" />
        <div className="card-right">
          <div className="city">{weather.location}</div>
          <div className="conditions">{weather.conditions}</div>
          <div className="stats">
            <div>
              <div className="stat-value">{weather.humidity}%</div>
              <div className="stat-label">Humidity</div>
            </div>
            <div>
              <div className="stat-value">{weather.windSpeed} m/s</div>
              <div className="stat-label">Wind</div>
            </div>
          </div>
          <button className="btn" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : '↻  Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root app component
// ---------------------------------------------------------------------------

function WeatherApp() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [inputCity, setInputCity] = useState('');

  const { app, error } = useApp({
    appInfo: { name: 'Weather App', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (app) => {
      // Store the city from the tool input so refresh re-uses it
      app.ontoolinput = async (input) => {
        const city = (input.arguments as Record<string, unknown>)?.city;
        if (typeof city === 'string') setInputCity(city);
      };

      // Parse weather JSON from the tool result and render the card
      app.ontoolresult = async (result) => {
        const data = parseWeather(result);
        if (data) setWeather(data);
      };

      app.ontoolcancelled = (params) => {
        console.info('Tool cancelled:', params.reason);
      };

      app.onerror = console.error;
    },
  });

  // Read initial tool result synchronously from host context on connect
  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    if (ctx?.toolResult) {
      const data = parseWeather(ctx.toolResult as CallToolResult);
      if (data) setWeather(data);
    }
  }, [app]);

  if (error)
    return (
      <div className="status" style={{ color: '#f87171' }}>
        Error: {error.message}
      </div>
    );

  if (!app || !weather)
    return (
      <div
        className="status"
        style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', height: '100vh' }}
      >
        {!app ? 'Connecting…' : 'Loading weather…'}
      </div>
    );

  return <WeatherCard weather={weather} inputCity={inputCity} app={app} />;
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WeatherApp />
  </StrictMode>,
);
