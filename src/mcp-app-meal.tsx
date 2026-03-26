/**
 * Restaurant Recommendation MCP App UI — entry (Vite: INPUT=mcp-app-meal.html).
 * Google Maps–inspired carousel using @modelcontextprotocol/ext-apps React SDK.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MealApp } from './mcp-app-meal/MealApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MealApp />
  </StrictMode>
);
