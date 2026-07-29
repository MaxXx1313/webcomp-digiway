// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

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

export function formatTime(date: Date | string | undefined, language: string): string {
  if (date === undefined || date === null) {
    return '';
  }
  const dateSafe = (typeof date === 'string') ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(language, {
      hour: 'numeric',
      minute: '2-digit'
    }).format(dateSafe);
  } catch (error) {
    // Safe fallback to English format
    return new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(dateSafe);
  }
}
