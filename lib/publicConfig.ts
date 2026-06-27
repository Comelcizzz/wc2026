// Client-safe config. Only NEXT_PUBLIC_* vars are available in the browser.
export const publicConfig = {
  timezone: process.env.NEXT_PUBLIC_TIMEZONE || 'America/Toronto',
};
