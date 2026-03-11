/**
 * MCP-UI resource builder for the get_weather tool.
 * Returns a UIResource (text/html) rendered as a sandboxed card by the client.
 */

import { createUIResource } from '@mcp-ui/server';
import type { WeatherResult } from './openweather.js';

// ---------------------------------------------------------------------------
// Condition → emoji + gradient
// ---------------------------------------------------------------------------

interface ConditionTheme {
  emoji: string;
  gradient: string;
}

function getTheme(conditions: string): ConditionTheme {
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
  // Clear / sunny
  return { emoji: '☀️', gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' };
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildWeatherHtml(weather: WeatherResult): string {
  const { emoji, gradient } = getTheme(weather.conditions);
  const city = escapeHtml(weather.location);
  const cityJson = JSON.stringify(weather.location);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${gradient};
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: rgba(255,255,255,0.18);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 28px;
    padding: 36px 28px 28px;
    width: 100%;
    max-width: 300px;
    text-align: center;
    color: #fff;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25);
  }
  .city {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    opacity: 0.9;
  }
  .emoji {
    font-size: 72px;
    line-height: 1;
    margin: 18px 0 12px;
    display: block;
  }
  .temp {
    font-size: 72px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -2px;
  }
  .unit {
    font-size: 28px;
    font-weight: 300;
    vertical-align: super;
    letter-spacing: 0;
  }
  .conditions {
    font-size: 17px;
    font-weight: 400;
    text-transform: capitalize;
    opacity: 0.88;
    margin-top: 10px;
  }
  .divider {
    border: none;
    border-top: 1px solid rgba(255,255,255,0.3);
    margin: 22px 0;
  }
  .stats {
    display: flex;
    justify-content: space-around;
  }
  .stat-value {
    font-size: 20px;
    font-weight: 600;
  }
  .stat-label {
    font-size: 11px;
    opacity: 0.75;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-top: 3px;
  }
  .refresh {
    margin-top: 24px;
    background: rgba(255,255,255,0.22);
    border: 1px solid rgba(255,255,255,0.35);
    color: #fff;
    padding: 9px 26px;
    border-radius: 100px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    letter-spacing: 0.3px;
  }
  .refresh:hover { background: rgba(255,255,255,0.35); }
</style>
</head>
<body>
<div class="card">
  <div class="city">${city}</div>
  <span class="emoji">${emoji}</span>
  <div class="temp">${weather.temperature}<span class="unit">°C</span></div>
  <div class="conditions">${escapeHtml(weather.conditions)}</div>
  <hr class="divider">
  <div class="stats">
    <div>
      <div class="stat-value">${weather.humidity}%</div>
      <div class="stat-label">Humidity</div>
    </div>
    <div>
      <div class="stat-value">${weather.windSpeed} m/s</div>
      <div class="stat-label">Wind</div>
    </div>
  </div>
  <button class="refresh" onclick="refresh()">↻ Refresh</button>
</div>
<script>
  function refresh() {
    window.parent.postMessage({
      type: 'tool',
      payload: { toolName: 'get_weather', params: { city: ${cityJson} } }
    }, '*');
  }
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build an MCP-UI UIResource for a weather result.
 * Returns a content item `{ type: 'resource', resource: { ... } }` that
 * MCP-UI-capable clients will render as an interactive weather card.
 */
export async function buildWeatherUiResource(weather: WeatherResult) {
  return createUIResource({
    uri: `ui://weather/${encodeURIComponent(weather.location)}`,
    content: { type: 'rawHtml', htmlString: buildWeatherHtml(weather) },
    encoding: 'text',
  });
}
