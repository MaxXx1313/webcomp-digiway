/**
 */
export function formatNumber(num: number | string | undefined, language: string): string {
  const numSafe = (num as any) * 1;
  if (Number.isNaN(num)) {
    return '';
  }
  try {
    // Uses native browser API to format according to regional rules
    return new Intl.NumberFormat(language, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(numSafe);
  } catch (error) {
    // Fallback safely to English format if the language string is invalid
    return new Intl.NumberFormat('en', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(numSafe);
  }
}
