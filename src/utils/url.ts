// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 */
export function buildUrl(baseUrl: string, query?: { [key: string]: any }): string {
  if (!query) {
    return baseUrl;
  }
  const url = new URL(baseUrl);
  for (const k in query) {
    url.searchParams.append(k, query[k]);
  }
  return url.toString();
}
