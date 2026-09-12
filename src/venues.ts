// Venue identity is world data; signs, facades and interiors consume the same name.
export const VENUES = {
  cafe: { name: "PALM & BEAN", subtitle: "COFFEE  /  BAKERY", color: "#245b50", accent: "#e7d9b7", height: 6.2, wall: 0 },
  burger: { name: "SUNSET BURGER", subtitle: "CHARGRILLED  /  SINCE 1978", color: "#b64030", accent: "#ffcd67", height: 4.8, wall: 4 },
  market: { name: "LUCKY MARKET", subtitle: "FRESH FOOD  /  OPEN 24 HOURS", color: "#346948", accent: "#f0d67e", height: 6, wall: 2 },
  records: { name: "COPPER RECORDS", subtitle: "VINYL  /  TAPES  /  LIVE MUSIC", color: "#2c3c68", accent: "#f2b38f", height: 8.4, wall: 5 },
  pharmacy: { name: "COAST PHARMACY", subtitle: "HEALTH  /  BEAUTY  /  EVERYDAY CARE", color: "#267b78", accent: "#f4f0dc", height: 6.6, wall: 0 },
  diner: { name: "OCEAN DINER", subtitle: "BREAKFAST  /  LUNCH  /  ALL DAY", color: "#bc6b43", accent: "#ffe5ba", height: 5.4, wall: 1 },
} as const;
export type Venue = keyof typeof VENUES;
export const VENUE_TYPES = Object.keys(VENUES) as Venue[];
export function venueFor(seed: number, road: number, index: number): Venue {
  return VENUE_TYPES[((Math.imul(road + 1, 31) ^ Math.imul(index + 7, 17) ^ seed) >>> 0) % VENUE_TYPES.length];
}
