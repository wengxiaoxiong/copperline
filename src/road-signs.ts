import type { RoadEdge } from "./generation";
export const STREET_NAMES = [
  "SIERRA ROAD", "VISTA DRIVE", "CEDAR STREET", "SUNSET BOULEVARD", "MARKET STREET", "PALM STREET", "HARBOR ROAD", "OCEAN DRIVE",
  "CYPRESS AVENUE", "WEST COAST AVENUE", "COPPER AVENUE", "MAGNOLIA AVENUE", "PALM AVENUE", "RIVERSIDE AVENUE", "MARINA AVENUE", "DOCKSIDE AVENUE", "EAST BAY AVENUE",
];
// The authored main grid shares a name across consecutive road segments.
// Diagonal connectors get their origin's avenue; the ocean ring has its own name.
export function roadSignIndex(road: RoadEdge) {
  if(road.a>=63 && road.b>=63)return 7;
  const a=road.points[0],b=road.points[road.points.length-1];
  return Math.abs(a.x-b.x)>Math.abs(a.z-b.z) ? Math.min(7,Math.floor(Math.min(road.a,road.b)/9)) : 8+Math.min(8,road.a%9);
}
export const ROAD_NOTICES = [
  ["SPEED LIMIT", "30"], ["NO PARKING", "FIRE LANE"], ["PEDESTRIAN", "CROSSING"],
];
