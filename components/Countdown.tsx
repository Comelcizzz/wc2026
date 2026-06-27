'use client';
import { useEffect, useState } from 'react';
import { publicConfig } from '@/lib/publicConfig';

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  const s = Math.floor(ms / 1000);
  return {
    ms,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

export default function Countdown({ deadline }: { deadline: string }) {
  const target = new Date(deadline).getTime();
  const [t, setT] = useState<ReturnType<typeof diff> | null>(null);

  useEffect(() => {
    setT(diff(target));
    const i = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(i);
  }, [target]);

  const locked = !!t && t.ms <= 0;
  const hoursLeft = t ? t.ms / 3_600_000 : Infinity;
  const urgent = !!t && !locked && hoursLeft < 1; // < 1h: bright red + shake
  const soon = !!t && !locked && !urgent && hoursLeft < 24; // < 24h: deeper red
  const tierClass = locked ? '' : urgent ? ' urgent' : soon ? ' soon' : ' warm';

  const deadlineStr = t
    ? new Date(deadline).toLocaleString('en-US', {
        timeZone: publicConfig.timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : '--';

  return (
    <div className={`countdown-wrap${tierClass}`}>
      <div className="countdown-label">Picks lock in</div>
      {locked ? (
        <div className="countdown-locked">PICKS ARE LOCKED</div>
      ) : (
        <div className="countdown-digits">
          {[
            { n: t?.days, u: 'Days' },
            { n: t?.hours, u: 'Hours' },
            { n: t?.mins, u: 'Min' },
            { n: t?.secs, u: 'Sec' },
          ].map((c) => (
            <div className="cd-cell" key={c.u}>
              <div className="cd-num">{c.n == null ? '--' : String(c.n).padStart(2, '0')}</div>
              <div className="cd-unit">{c.u}</div>
            </div>
          ))}
        </div>
      )}
      <div className="countdown-deadline">Deadline: {deadlineStr}</div>
    </div>
  );
}
