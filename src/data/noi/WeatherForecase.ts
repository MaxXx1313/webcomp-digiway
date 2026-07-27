// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Datatype, Station } from "./types-v1-common";

export type WeatherForecastMeasurementType = 'forecast-air-temperature'
  | 'forecast-air-temperature-max'
  | 'forecast-air-temperature-min'
  | 'forecast-precipitation-probability'
  | 'forecast-precipitation-sum'
  | 'forecast-sunshine-duration'
  | 'forecast-wind-direction'
  | 'forecast-wind-speed'
  | 'qualitative-forecast';


/**
 * it looks like the structure is:
 * 'sunny|cloudy|overcast'
 * 'sunny|cloudy|overcast' + 'with' + 'light'|'moderate'|'heavy' + 'snow'|'rain'
 * 'sunny|cloudy|overcast' + 'with' + 'rain and snow'
 *
 * also, few exceptions.
 *
 * So, we have:
 * - conditions: sunny|cloudy|overcast
 * - additional (can be both): snow|rain/showers
 * - additional level: light|moderate|heavy
 * - extra: thunderstorms|no-thunderstorms
 */
export type WeatherForecastIconValueType = ''
  // overall
  | 'sunny'
  | 'partly cloudy'
  | 'cloudy'
  | 'very cloudy'

  // overcast
  | 'overcast'
  | 'overcast with light rain'
  | 'overcast with moderate rain'
  | 'overcast with heavy rain' // never appeared yet

  | 'overcast with light snow'
  | 'overcast with moderate snow'
  | 'overcast with heavy snow' // never appeared yet

  | 'overcast with rain and snow'

  // cloudy
  | 'cloudy with light rain' // never appeared yet
  | 'cloudy with moderate rain'
  | 'cloudy with heavy rain' // never appeared yet
  | 'cloudy with light snow'
  | 'cloudy with moderate snow' // never appeared yet
  | 'cloudy with heavy snow'

  | 'cloudy, thunderstorms with moderate showers'
  | 'cloudy with rain and snow'
  ;

/**
 *
 */
export interface WeatherForecast extends Station<{ nameEn: string }> {
  sdatatypes: {
    [key in WeatherForecastMeasurementType]: Datatype<number>;
  } & {
    'qualitative-forecast': Datatype<WeatherForecastIconValueType>;
  };
}
