export function formatCustomerName(name: string): string {
  return name
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('es-CL')
    .replace(
      /(^|[\s'’-])(\p{L})/gu,
      (_, separator: string, letter: string) =>
        separator + letter.toLocaleUpperCase('es-CL'),
    );
}
