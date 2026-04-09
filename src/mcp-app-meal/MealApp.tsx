/**
 * Root component: wires MCP app host, tool results, and refresh with browser GPS.
 */

import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback, useEffect, useState } from 'react';
import type { InputArgs, MealData } from './types';
import { useBrowserLocation } from './hooks';
import { parseMealData } from './utils';
import { WeatherCard } from './WeatherCard';
import { Carousel } from './Carousel';

export function MealApp() {
  const [data, setData] = useState<MealData | null>(null);
  const [inputArgs, setInputArgs] = useState<InputArgs>({});
  const [refreshing, setRefreshing] = useState(false);
  const browserLocation = useBrowserLocation();

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
      const args = { ...inputArgs };
      if (browserLocation.coords && !args.location) {
        args.location = `${browserLocation.coords.lat},${browserLocation.coords.lng}`;
      }
      const result = await app.callServerTool({
        name: 'recommend_meal',
        arguments: args,
      });
      const parsed = parseMealData(result);
      if (parsed) setData(parsed);
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [app, inputArgs, browserLocation.coords]);

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
      <Carousel recommendations={data.recommendations} app={app} cravingLevel={data.cravingLevel ?? 50} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <span className={`location-badge ${browserLocation.source}`}>
          <span className="location-dot" />
          {browserLocation.source === 'gps'
            ? 'Precise location'
            : browserLocation.source === 'pending'
              ? 'Locating…'
              : 'Approximate location'}
        </span>
        {inputArgs.cuisine && (
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Searching…' : '🔄 Search again'}
          </button>
        )}
      </div>
    </div>
  );
}
