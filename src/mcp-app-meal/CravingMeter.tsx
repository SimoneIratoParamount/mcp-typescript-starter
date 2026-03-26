/**
 * Craving level meter (1–100, Giovanni at 100).
 */

export function CravingMeter({ level }: { level: number }) {
  const isGiovanni = level === 100;
  const filled = Math.round((level / 100) * 5);
  const fires = '🔥'.repeat(filled) + '🫥'.repeat(5 - filled);

  const label =
    isGiovanni ? "Giovanni's level" :
    level >= 80 ? 'Very hungry' :
    level >= 51 ? 'Properly hungry' :
    level >= 26 ? 'Mildly hungry' :
                  'Barely peckish';

  const color =
    isGiovanni ? '#c5221f' :
    level >= 80 ? '#ea4335' :
    level >= 51 ? '#f59e0b' :
    level >= 26 ? '#34a853' :
                  '#70757a';

  const bg =
    isGiovanni ? '#fce8e6' :
    level >= 80 ? '#fdecea' :
    level >= 51 ? '#fef3c7' :
    level >= 26 ? '#e6f4ea' :
                  '#f1f3f4';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#3c4043' }}>Craving level</span>
        <span style={{ fontSize: 18, letterSpacing: 2 }}>{fires}</span>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 100,
          color, background: bg,
          ...(isGiovanni ? { animation: 'none', fontStyle: 'italic' } : {}),
        }}>
          {isGiovanni ? '🔥 ' : ''}{label}
        </span>
        <span style={{ fontSize: 11, color: '#9aa0a6' }}>{level} / 100</span>
      </div>
    </div>
  );
}
