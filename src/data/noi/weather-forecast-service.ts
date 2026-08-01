// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { WeatherForecast } from "./WeatherForecase";
import { buildUrl } from "../../utils/url";


interface WeatherForecastResponse {
  offset: number;
  limit: number;
  data: {
    WeatherForecast: {
      stations: {
        [stationId: string]: WeatherForecast;
      }
    }
  };
}

export interface MyForecastResponse {
  dateFrom: Date;
  dateTo: Date;
  values: WeatherForecast[];
}

export interface AbortableRequest<T> {
  payload$: Promise<T>,
  abort: () => void;
}

// origin is used to track usage and traffic patterns
const ORIGIN = 'webcomp-brennerlec';

export class WeatherForecastService {

  static MAX_DAYS_AHEAD = 5;

  /**
   */
  async getWeatherForecastForDay(date: Date): Promise<MyForecastResponse> {

    const range = dayRange(date);

    const predictionResponse = await fetch(buildUrl(`https://mobility.api.opendatahub.com/v2/tree/WeatherForecast/*/${range.from.toISOString()}/${range.to.toISOString()}`, {
      origin: ORIGIN,
      limit: -1,
    }));
    const predictionData = await (predictionResponse.json() as Promise<WeatherForecastResponse>);

    return {
      dateFrom: range.from,
      dateTo: range.to,
      values: Object.values(predictionData?.data?.WeatherForecast?.stations || {}) as WeatherForecast[],
    };
  }

  /**
   */
  getWeatherForecastDayStation(date: Date, scode: string): AbortableRequest<MyForecastResponse> {
    // https://mobility.api.opendatahub.com/v2/flat/WeatherForecast/*/2026-05-20T00:00:00.000Z/2026-05-20T23:59:00.000Z?limit=-1&where=scode.eq."021118"
    const controller = new AbortController();
    const signal = controller.signal;

    const range = dayRange(date);

    const predictionData$: Promise<MyForecastResponse> = fetch(buildUrl(`https://mobility.api.opendatahub.com/v2/tree/WeatherForecast/*/${range.from.toISOString()}/${range.to.toISOString()}`, {
      origin: ORIGIN,
      limit: -1,
      where: `scode.eq."${scode}"`,
    }), {signal})
      .then(predictionResponse => {
        return predictionResponse.json() as Promise<WeatherForecastResponse>;
      })
      .then(predictionData => {
        const values = Object.values(predictionData?.data?.WeatherForecast?.stations || {}) as WeatherForecast[];
        return {
          dateFrom: range.from,
          dateTo: range.to,
          values,
        } as MyForecastResponse;
      })
      .catch(e => {
        // catch the abort if you like
        if (e.name === 'AbortError') {
          return {
            dateFrom: range.from,
            dateTo: range.to,
            values: [],
          } as MyForecastResponse;
        }
        throw e;
      });

    return {
      payload$: predictionData$,
      abort: () => {
        return controller.abort();
      },
    };
  }

}

/**
 */
function dayRange(date: Date) {

  const dateFrom = new Date(date.getTime());
  dateFrom.setHours(0);
  dateFrom.setMinutes(0);
  dateFrom.setSeconds(0);
  dateFrom.setMilliseconds(0);

  const dateTo = new Date(dateFrom.getTime());
  dateTo.setDate(dateTo.getDate() + 1);
  dateTo.setMilliseconds(-1);

  return {
    from: dateFrom,
    to: dateTo,
  };

}
