/**
 * Restaurant results carousel with keyboard and dot navigation.
 */

import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback, useEffect, useState } from 'react';
import type { Recommendation } from './types';
import { RestaurantCard } from './RestaurantCard';

interface CarouselProps {
  recommendations: Recommendation[];
  app: App;
  cravingLevel: number;
}

export function Carousel({ recommendations, app, cravingLevel }: CarouselProps) {
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
              <RestaurantCard rec={rec} app={app} index={i} total={total} cravingLevel={cravingLevel} />
            </div>
          ))}
        </div>
      </div>

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
