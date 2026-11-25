/** Server sort order is assumed case-insensitive; adjust once seen on the real page */
export function isSorted(values: string[], direction: 'asc' | 'desc') {
  const sorted = [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  if (direction === 'desc') sorted.reverse();
  return values.every((value, i) => value === sorted[i]);
}
