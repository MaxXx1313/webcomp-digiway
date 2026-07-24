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

// origin is used to track usage and traffic patterns
const ORIGIN = 'webcomp-brennerlec';

export class WeatherForecastService {

  /**
   *
   */
  async getWeatherForecastForDay(date: Date) {

    const dateFrom = new Date(date.getTime());
    dateFrom.setHours(0);
    dateFrom.setMinutes(0);
    dateFrom.setSeconds(0);
    dateFrom.setMilliseconds(0);

    const dateTo = new Date(dateFrom.getTime());
    dateTo.setDate(dateTo.getDate() + 1);
    dateTo.setMilliseconds(-1);


    const predictionResponse = await fetch(buildUrl(`https://mobility.api.opendatahub.com/v2/tree/WeatherForecast/*/${dateFrom.toISOString()}/${dateTo.toISOString()}`, {
      origin: ORIGIN,
      limit: -1,
    }));
    const predictionData = await (predictionResponse.json() as Promise<WeatherForecastResponse>);

    return Object.values(predictionData?.data?.WeatherForecast?.stations || {}) as WeatherForecast[];
  }

}
