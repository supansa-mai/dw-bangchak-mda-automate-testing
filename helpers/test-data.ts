import { randomInt } from 'crypto';

/** Prefix of every record the tests create, so they can be found and cleaned up (companies can't be deleted) */
export const AUTO_PREFIX = 'AUTO';

const NOUNS = [
  'Lotus',
  'River',
  'Falcon',
  'Harbor',
  'Mountain',
  'Orchid',
  'Tiger',
  'Horizon',
  'Bamboo',
  'Delta',
  'Phoenix',
  'Meadow',
  'Lagoon',
  'Cedar',
  'Peak',
  'Valley',
  'Island',
  'Garden',
  'Star',
  'Bridge',
  'Ocean',
  'Forest',
  'Eagle',
  'Coral',
  'Amber',
  'Jade',
  'Summit',
  'Crystal',
  'Sunrise',
  'Comet',
  'Pearl',
  'Maple',
  'Atlas',
  'Orbit',
  'Nova',
  'Zenith',
  'Lion',
  'Willow',
  'Canyon',
  'Glacier',
];
const INDUSTRIES = [
  'Energy',
  'Power',
  'Holdings',
  'Resources',
  'Trading',
  'Logistics',
  'Petroleum',
  'Solutions',
  'Industries',
  'Ventures',
];
// No B, so the suffix can never spell a search keyword the tests use (BCP, BBG)
const SUFFIX_LETTERS = 'ACDEFGHIJKLMNOPQRSTUVWXYZ';

const pick = <T>(values: readonly T[]) => values[randomInt(0, values.length)];

/** Random capital letters without B, e.g. "UIOM" */
export function randomLetters(length: number) {
  return Array.from({ length }, () => pick([...SUFFIX_LETTERS])).join('');
}

/**
 * A short readable name unique per call, e.g. "AUTO Star Power UIOM", or "AUTO Parent Star Power UIOM" with a label.
 * 40 nouns x 10 industries x 25^4 letters = about 156 million names
 */
export function uniqueName(label?: string) {
  return [AUTO_PREFIX, label, pick(NOUNS), pick(INDUSTRIES), randomLetters(4)].filter(Boolean).join(' ');
}
