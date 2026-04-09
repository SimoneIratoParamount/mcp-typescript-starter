/**
 * "Popular times" bar chart (heuristic busyness).
 */

import { busynessAt, getRushStatus } from './rush';

export function PopularTimes() {
  const now = new Date();
  const currentHour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const rush = getRushStatus();
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  return (
    <div style={{ marginTop: 2 }}>
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
