import type { Pool } from '../lib/model';

/* Schematic campus layout (not to scale). Coordinates are in a 900 x 520 viewBox. */

export type PointKind = 'canteen' | 'library' | 'lecture' | 'hall' | 'transit';

export interface ReturnPoint {
  id: string;
  name: string;
  short: string;
  kind: PointKind;
  x: number;
  y: number;
  weight: number; // relative share of daily returns
  pilot: boolean;
  walk: Record<string, number>; // minutes from where the student is
}

export const RETURN_POINTS: ReturnPoint[] = [
  { id: 'nsfc', name: 'North Spine Food Court', short: 'NS Food Court', kind: 'canteen', x: 548, y: 212, weight: 1.6, pilot: true, walk: { ns: 1, lib: 3, lt: 5, hall: 14 } },
  { id: 'lwn', name: 'Lee Wee Nam Library entrance', short: 'LWN Library', kind: 'library', x: 360, y: 262, weight: 1.0, pilot: true, walk: { ns: 3, lib: 1, lt: 6, hall: 12 } },
  { id: 'nsbus', name: 'North Spine bus stop (Campus Loop)', short: 'NS bus stop', kind: 'transit', x: 640, y: 140, weight: 1.25, pilot: true, walk: { ns: 3, lib: 5, lt: 4, hall: 9 } },
  { id: 'ss', name: 'South Spine Food Court', short: 'South Spine', kind: 'canteen', x: 500, y: 385, weight: 1.2, pilot: false, walk: {} },
  { id: 'hive', name: 'The Hive', short: 'The Hive', kind: 'lecture', x: 345, y: 372, weight: 0.8, pilot: false, walk: {} },
  { id: 'lt', name: 'Lecture theatre cluster', short: 'LT cluster', kind: 'lecture', x: 650, y: 330, weight: 0.7, pilot: false, walk: {} },
  { id: 'c2', name: 'Canteen 2', short: 'Canteen 2', kind: 'canteen', x: 770, y: 160, weight: 0.9, pilot: false, walk: {} },
  { id: 'c9', name: 'Canteen 9', short: 'Canteen 9', kind: 'canteen', x: 222, y: 150, weight: 0.8, pilot: false, walk: {} },
  { id: 'c11', name: 'Canteen 11', short: 'Canteen 11', kind: 'canteen', x: 140, y: 312, weight: 0.6, pilot: false, walk: {} },
  { id: 'c13', name: 'Canteen 13', short: 'Canteen 13', kind: 'canteen', x: 292, y: 452, weight: 0.5, pilot: false, walk: {} },
  { id: 'c16', name: 'Canteen 16', short: 'Canteen 16', kind: 'canteen', x: 676, y: 430, weight: 0.55, pilot: false, walk: {} },
  { id: 'hall', name: 'Hall residence lobby', short: 'Hall lobby', kind: 'hall', x: 790, y: 282, weight: 0.45, pilot: false, walk: {} },
];

export const WASH_HUB = { x: 640, y: 272, name: 'Wash hub (proposed, shared with dine-in crockery)' };

export const STUDENT_LOCATIONS = [
  { id: 'ns', label: 'North Spine' },
  { id: 'lib', label: 'Lee Wee Nam Library' },
  { id: 'lt', label: 'Lecture theatre' },
  { id: 'hall', label: 'Heading home' },
];

export interface Stall {
  id: string;
  name: string;
  where: string;
  pool: Pool;
  menu: string[];
}

export const PILOT_STALLS: Stall[] = [
  { id: 'rice', name: 'Mixed rice stall', where: 'North Spine Food Court', pool: 'halal', menu: ['Economic rice', 'Nasi lemak'] },
  { id: 'noodle', name: 'Noodle stall', where: 'North Spine Food Court', pool: 'general', menu: ['Dry noodles', 'Fishball noodles (dry)'] },
];

export const CONTAINERS = [
  { id: 'box', name: 'Rice box', size: '750 ml', note: 'Two compartments, fits economic rice' },
  { id: 'bowl', name: 'Noodle bowl', size: '900 ml', note: 'Leak-proof lid, dry noodles only in pilot' },
];
