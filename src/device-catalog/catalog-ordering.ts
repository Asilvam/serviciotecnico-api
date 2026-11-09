import priority from './data/catalog-priority.json';
import { catalogKey } from './catalog-utils';

export function catalogName(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleUpperCase('es');
}
export function brandRank(name: string) {
  const index = priority.brands.indexOf(catalogName(name));
  return index < 0 ? priority.brands.length : index;
}
export function compareNames(a: string, b: string) {
  return catalogKey(a).localeCompare(catalogKey(b), 'es', { numeric: true });
}
export function compareBrands(a: { name: string }, b: { name: string }) {
  return brandRank(a.name) - brandRank(b.name) || compareNames(a.name, b.name);
}
