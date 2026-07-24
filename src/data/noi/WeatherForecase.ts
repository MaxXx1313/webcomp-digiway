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
 *
 */
export interface WeatherForecast extends Station {
  sdatatypes: {
    [key in WeatherForecastMeasurementType]: Datatype;
  };
}
