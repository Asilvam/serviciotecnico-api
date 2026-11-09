export function catalogKey(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('es');
}
export function prefixPattern(value: string): string {
  return '^' + catalogKey(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
