import { teamCode } from '@/lib/flags';

// Renders a real flag image (works on every OS/browser, unlike emoji flags).
// Unknown/TBD teams get a neutral grey placeholder so the bracket stays tidy.
export default function TeamFlag({
  team,
  size = 20,
  className = '',
}: {
  team?: string | null;
  size?: number;
  className?: string;
}) {
  const code = teamCode(team);
  const h = Math.round(size * 0.75);
  if (!code) {
    return (
      <span
        className={`tflag-img tflag-neutral ${className}`}
        style={{ width: size, height: h }}
        aria-hidden
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`tflag-img ${className}`}
      src={`https://flagcdn.com/${code}.svg`}
      alt=""
      width={size}
      height={h}
      loading="lazy"
      aria-hidden
    />
  );
}
