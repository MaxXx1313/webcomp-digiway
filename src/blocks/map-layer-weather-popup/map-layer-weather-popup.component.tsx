// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, h, Host, Method, State } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { MapGeoJSONFeature } from "maplibre-gl";
import { WeatherForecast } from "../../data/noi/WeatherForecase";
import { LanguageDataService } from "../../data/language/language-data-service";
import {
  _getDailyMeasurement,
  calculateDayPoints,
  DayPointForecast,
  getClearSkyType,
  getIconContent,
  getWindDirectionLabel
} from "../map-layer-weather/weather-forecast.util";
import { formatNumber, formatTime } from "../../utils/intl";


/**
 * (INTERNAL) render map popup
 */
@Component({
  tag: 'noi-map-layer-weather-popup',
  styleUrl: 'map-layer-weather-popup.css',
  shadow: false,
})
export class MapLayerWeatherPopupComponent implements StencilComponent {

  private languageService = LanguageDataService.getInstance();


  @State()
  private data?: WeatherForecast;
  private dayIso?: string;
  private dayForecast?: DayPointForecast[];

  /**
   */
  async connectedCallback() {

  }

  disconnectedCallback() {

  }

  @Method()
  async setFeature(feature: MapGeoJSONFeature) {
    this.data = JSON.parse(feature?.properties?.data) as WeatherForecast;
    this.dayIso = feature?.properties?.day as string;
    this.dayForecast = calculateDayPoints(this.data);
  }


  render() {
    if (!this.data) {
      return '';
    }

    // helpers, to make template more clear
    const t = this.languageService.translate.bind(this.languageService);
    const num = (_num: | number | undefined) => formatNumber(_num, this.languageService.currentLanguage);

    // const iconName = this.feature.properties['icon_name'];
    // const pointDescription = _getDailyMeasurement(data.sdatatypes["qualitative-forecast"]?.tmeasurements || [])?.mvalue;
    const pointName = this.data.smetadata.nameEn;

    const airTemperatureMin = _getDailyMeasurement(this.data.sdatatypes["forecast-air-temperature-min"]?.tmeasurements || [])?.mvalue;
    const airTemperatureMax = _getDailyMeasurement(this.data.sdatatypes["forecast-air-temperature-max"]?.tmeasurements || [])?.mvalue;
    const precipitationProbabilityDaily = _getDailyMeasurement(this.data.sdatatypes["forecast-precipitation-probability"]?.tmeasurements || [])?.mvalue;
    const precipitationAmountDaily = _getDailyMeasurement(this.data.sdatatypes["forecast-precipitation-sum"]?.tmeasurements || [])?.mvalue;
    const sunshineDuration = _getDailyMeasurement(this.data.sdatatypes["forecast-sunshine-duration"]?.tmeasurements || [])?.mvalue;

    return (
      <div class="noi-weather-popup" part="popup">
        <div class="popup__header">
          <noi-icon name="map-point"></noi-icon>
          <div>{pointName}</div>
        </div>
        <div class="popup__section popup__section--background">
          {t('weather.air-temperature-min')}: {num(airTemperatureMin)}℃
          &nbsp;-&nbsp;
          {t('weather.air-temperature-max')}: {num(airTemperatureMax)}℃
        </div>
        <div
          class="popup__section popup__section--hero">{formatDateCustom(this.dayIso!, this.languageService.currentLanguage)}</div>
        <div class="popup__section">{t('weather.precipitation-probability')}: {num(precipitationProbabilityDaily)}%
        </div>
        <div class="popup__section">{t('weather.precipitation-amount')}: {num(precipitationAmountDaily)}mm</div>
        <div class="popup__section">{t('weather.sunshine-duration')}: {num(sunshineDuration)}h</div>
        {this._renderTimePoint(this.dayForecast[0], sunshineDuration)}
      </div>
    );
  }

  _renderTimePoint(dp: DayPointForecast, sunshineDuration: number) {

    // helpers, to make template more clear
    const t = this.languageService.translate.bind(this.languageService);
    const num = (_num: | number | undefined) => formatNumber(_num, this.languageService.currentLanguage);

    const skyType = getClearSkyType(new Date(dp.time), sunshineDuration);

    return (<div>

      <div class="popup__table-cell">

        <div class="popup__values-group popup__values-group--no-margin">
          <div>{formatTime(dp.time, this.languageService.currentLanguage)}</div>
          <div class="noi-weather-icon"
               title={dp["qualitative-forecast"] as any}>{getIconContent(dp["qualitative-forecast"] as any, skyType)}</div>
        </div>

        <div class="popup__values-group">
          <div>{num(dp["air-temperature"])}℃</div>
        </div>

        <div class="popup__values-group">
          <div>{dp["wind-direction"]}° ({getWindDirectionLabel(dp["wind-direction"], t('weather.wind-directions'))})
          </div>
          <div>{num(dp["wind-speed"])}m/s</div>
        </div>
        <div class="popup__values-group">
          <div>{dp["precipitation-probability"]}%</div>
          <div>{num(dp["precipitation-sum"])}mm</div>
        </div>
      </div>
    </div>);

    // const dayPoints = calculateDayPoints(data);
    // let dpHtml = '';
    //
    // dpHtml += `
    //     <div class="popup__table-labels">
    //     <div class="popup__table-labels-top-1">${t('weather.hours.air-temperature')}</div>
    //     <div class="popup__table-labels-top-2">${t('weather.hours.wind')}</div>
    //     <div class="popup__table-labels-top-3">${t('weather.hours.precipitation')}</div>
    //   </div>`;
    //
    // for (const dp of dayPoints) {
    //
    //   const skyType = getClearSkyType(new Date(dp.time), sunshineDuration);
    //
    //   dpHtml += `<div class="popup__table-cell">
    //
    //     <div class="popup__values-group popup__values-group--no-margin">
    //       <div>${formatTime(dp.time, languageService.currentLanguage)}</div>
    //       <div class="noi-weather-icon" title="${dp["qualitative-forecast"]}">${getIconContent(dp["qualitative-forecast"] as any, skyType)}</div>
    //     </div>
    //
    //     <div class="popup__values-group">
    //       <div>${num(dp["air-temperature"])}℃</div>
    //     </div>
    //
    //     <div class="popup__values-group">
    //       <div>${dp["wind-direction"]}° (${getWindDirectionLabel(dp["wind-direction"], t('weather.wind-directions'))})</div>
    //       <div>${num(dp["wind-speed"])}m/s</div>
    //     </div>
    //     <div class="popup__values-group">
    //       <div>${dp["precipitation-probability"]}%</div>
    //       <div>${num(dp["precipitation-sum"])}mm</div>
    //     </div>
    //   </div>`;
    // }
    // html += `<div class="popup__table">${dpHtml}</div>`;
    //
    // return `<div class="noi-weather-popup" part="popup">${html}</div>`;
  }
}


/**
 */
function formatDateCustom(dateStr: string, locale = 'en-US') {
  if (!dateStr) {
    return '';
  }
  const date = new Date(dateStr);

  // 1. Extract the day number string
  const day = date.getDate();

  // 2. Extract the lowercase long weekday name
  const weekdayFormatter = new Intl.DateTimeFormat(locale, {weekday: 'long'});
  const weekdayName = weekdayFormatter.format(date).toLowerCase();

  // 3. Extract the lowercase long month name
  const monthFormatter = new Intl.DateTimeFormat(locale, {month: 'long'});
  const monthName = monthFormatter.format(date).toLowerCase();

  // 4. Force the precise order: [Weekday] [Day] [Month]
  return `${weekdayName} ${day} ${monthName}`;
}

