/**
 * Weather UI demo endpoint — returns a UIResource (text/html) for @mcp-ui/client demos.
 */

import type { Express } from 'express';
import { getWeather } from '../services/openweather';
import { buildWeatherHtml } from '../services/weather-ui';

export function registerWeatherDemoRoute(app: Express): void {
  app.get('/api/weather', async (req, res) => {
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    if (!city) {
      res.status(400).json({ error: 'city query parameter is required' });
      return;
    }
    const apiKey = process.env.OPEN_WEATHER_API_KEY;
    if (!apiKey?.trim()) {
      res.status(503).json({ error: 'OPEN_WEATHER_API_KEY not configured' });
      return;
    }
    try {
      const weather = await getWeather(city, apiKey);
      const html = buildWeatherHtml(weather);
      res.json({
        uri: `ui://weather/${encodeURIComponent(weather.location)}`,
        mimeType: 'text/html',
        text: html,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });
}
