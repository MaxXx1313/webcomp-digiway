// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Element, Event, EventEmitter } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { Map, MapGeoJSONFeature, Popup, Subscription } from "maplibre-gl";
import {
  enableHoverEffect,
  FontIconPaintParams,
  getFontIconData,
  listenLayerReady,
  loadIconFont
} from "../../utils/maplibre";
import { WeatherForecastService } from "../../data/noi/weather-forecast-service";
import { GeoJSON, Point } from "geojson";
import { WeatherForecast, WeatherForecastMeasurementType } from "../../data/noi/WeatherForecase";
import { Measurement } from "../../data/noi/types-v1-common";
import { base64String } from "../map-layer-base-odh/icon-font";


const ICON_FONT_NAME = 'noi-digiway-weather-icons';
const ICON_FONT_URL = `url(${base64String}) format('woff')`;

// TODO: icons is not finished for this component
const ICON_FONT_ICONS = {
  'bicycle': '\ue800',
  'closure': '\ue801',
  'frequency': '\ue802',
  'weather-prediction': '\ue803',
  'weather-real-time': '\ue804',
  'poi': '\ue805',
  'transport': '\ue806',
  'gastronomy': '\ue807',
  'map': '\ue808',
  'mountain-trails': '\ue809',
  'hiking': '\ue80a',
  'trekking': '\ue80b',
} as const;


// Default styles
const defaultStyles = {
  unclusteredpoints: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      0, ['case', ['boolean', ['feature-state', 'hover'], false], 16, 14],
      10, ['case', ['boolean', ['feature-state', 'hover'], false], 17, 15],
      14, ['case', ['boolean', ['feature-state', 'hover'], false], 19, 17],
      18, ['case', ['boolean', ['feature-state', 'hover'], false], 21, 19]
    ],
    'circle-color': [
      'case', ['boolean', ['feature-state', 'hover'], false],
      '#FF6600',   // hovered
      '#004D71'    // normal
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#FFFFFF',
    'circle-opacity': 0.8
  },
} as const;


// 'iconFontStyles' is not a part of maplibre
const iconFontStyles: FontIconPaintParams = {
  "icon-font": ICON_FONT_NAME,
  'icon-color': '#FFFFFF',
  "icon-size": 18,
  "icon-text": '',
};


/**
 * (INTERNAL) render map layer
 */
@Component({
  tag: 'noi-map-layer-weather',
  styleUrl: 'noi-map-layer-weather.css', // no value produces error in the bundle
  shadow: false,
})
export class NoiMapLayerWeatherComponent implements StencilComponent {

  private map!: Map;

  @Element() el!: HTMLElement;

  /**
   * Emitted when layer data is loading
   */
  @Event() layerLoading!: EventEmitter<boolean>;

  private _subscriptions: Subscription[] = [];

  private weatherService = new WeatherForecastService();

  private _popup?: Popup;
  private _popupFeatureId?: string | number;

  /**
   */
  async connectedCallback() {
    // 1. Find the parent map element in the DOM tree
    const mapParent = this.el.closest('noi-map') as HTMLNoiMapElement;

    if (!mapParent) {
      console.error('[noi-map-base-tyrol-euregio] must be a child of my-map');
      return;
    }

    try {
      // 2. Safely wait for the map instance to be initialized by the parent
      this.map = await mapParent.getMapAsync();

      // 3. Add this layer to the map library instance
      this.initLayer();
    } catch (error) {
      console.error('Failed to get map instance:', error);
    }
  }

  disconnectedCallback() {
    // Clean up the layer if the HTML element is removed from the DOM
    if (this.map) {
      this.destroyLayer();
    }
  }


  async initLayer() {
    console.log(`[noi-map-layer-weather] Adding layer to map`);

    //
    const _loadEvent = listenLayerReady(this.map, 'source-weather-data', () => {
      this.layerLoading.emit(false);
    });
    this._subscriptions.push(_loadEvent);

    //
    this.layerLoading.emit(true);

    // fetch weather forecast
    const forecastData = await this.weatherService.getWeatherForecastForDay(new Date());
    const forecastDataTmp = forecastData.values.slice(0, 1); // FIXME: debug

    // Convert your 2000 points into a GeoJSON FeatureCollection
    const geojsonPoints: GeoJSON = {
      type: 'FeatureCollection',
      features: forecastDataTmp.map(point => ({
        id: point.scode,
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.scoordinate.x, point.scoordinate.y] // Ensure longitude is FIRST
        },
        properties: {data: point, day: forecastData.dateFrom.toISOString()},
      })),
    };

    this.map.addSource('source-weather-data', {
      type: 'geojson',
      data: geojsonPoints
    });


    // Add a visual layer
    this.map.addLayer({
      id: 'layer-weather-data',
      type: 'circle',
      source: 'source-weather-data',
      paint: defaultStyles.unclusteredpoints as any,
    });

    loadIconFont(ICON_FONT_NAME, ICON_FONT_URL).then(() => {
      const imageData = getFontIconData({
        ...iconFontStyles,
        // "icon-text": _icons[this.config.markerIcon!],
        "icon-text": 'AAA',
      });

      if (imageData) {
        // 3. Register the crisp canvas bitmap straight into MapLibre
        this.map.addImage('weather-icon', imageData, {
          sdf: false,
        });
      }

      this.map.addLayer({
        id: 'layer-weather-icon',
        type: 'symbol',
        source: 'source-weather-data',

        layout: {
          'icon-image': 'weather-icon', // Pointing to the generated canvas
          'icon-size': 1.0,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
      });

    });

    // Hover effects
    const layerHover = enableHoverEffect(this.map, 'layer-weather-data');
    this._subscriptions.push(layerHover);

    ///////// Click handlers
    const _pointClick = this.map.on('click', 'layer-weather-data', (e) => {
      const feature = e.features![0];
      console.log('(debug) Clicked point:', feature);
      // this.createFeaturePopup(feature, e.lngLat);
      this.createFeaturePopup(feature);
    });
    this._subscriptions.push(_pointClick);

    // Click anywhere for debug
    const _debugClick = this.map.on('click', (e) => {
      const features = this.map.queryRenderedFeatures(e.point);
      console.log('[DEBUG] All features at click:', features);
    });
    this._subscriptions.push(_debugClick);
  }

  /**
   */
  destroyLayer() {
    console.log('[noi-map-layer-weather] Removing layer from map');

    this._popup?.remove();

    for (const subscription of this._subscriptions) {
      subscription.unsubscribe();
    }
    this._subscriptions = [];

    if (this.map && this.map.getSource('source-weather-data')) {
      this.map.removeLayer('layer-weather-data');
      this.map.removeLayer('layer-weather-icon');
      this.map.removeImage('weather-icon');

      this.map.removeSource('source-weather-data');
    }
  }


  // createFeaturePopup(feature: MapGeoJSONFeature, lngLat: MapMouseEvent['lngLat']) {
  createFeaturePopup(feature: MapGeoJSONFeature) {
    const featureId = feature.id;
    if (this._popupFeatureId === featureId) {
      return; // same popup is already opened by another event
    }
    this._popupFeatureId = featureId;
    this._popup = new Popup()
      // .setLngLat(lngLat) // < on mouse click point
      .setLngLat((feature.geometry as Point).coordinates as [number, number]) // < on feature center
      .setHTML(weatherPopupStructure(feature))
      .setMaxWidth('380px')
      .addTo(this.map);
    this._popup.on('close', () => {
      this._popupFeatureId = undefined;
    });
  }

}


//
// function _getIcon(description: string) {
//   ICON_FONT_ICONS
// }


// Feature popup helper
function weatherPopupStructure(feature: MapGeoJSONFeature) {
  const data = JSON.parse(feature.properties?.data) as WeatherForecast;
  let html = '';

  const pointDescription = __getDailyMeasurement(data.sdatatypes["qualitative-forecast"]?.tmeasurements || [])?.mvalue;
  const pointName = data.smetadata.nameEn;

  // TODO: use icon:  <noi-icon className="popup__header-icon" name="${props.icon}" alt="icon"></noi-icon>
  html += `<div class="popup__header">
    <div>${pointDescription}</div>
    <div>${pointName}</div>
  </div>`;


  const airTemperatureMin = __getDailyMeasurement(data.sdatatypes["forecast-air-temperature-min"]?.tmeasurements || [])?.mvalue;
  const airTemperatureMax = __getDailyMeasurement(data.sdatatypes["forecast-air-temperature-max"]?.tmeasurements || [])?.mvalue;
  html += `<div class="popup__section popup__section--background">Min: ${airTemperatureMin}℃ - Max: ${airTemperatureMax}℃</div>`;

  html += `<div class="popup__section popup__section--hero">${formatDateCustom(feature.properties?.day)}</div>`;

  const precipitationProbabilityDaily = __getDailyMeasurement(data.sdatatypes["forecast-precipitation-probability"]?.tmeasurements || [])?.mvalue;
  html += `<div class="popup__section">Precipitation probability: ${precipitationProbabilityDaily}%</div>`;

  const precipitationAmountDaily = __getDailyMeasurement(data.sdatatypes["forecast-precipitation-sum"]?.tmeasurements || [])?.mvalue;
  html += `<div class="popup__section">Cumulated precipitation: ${precipitationAmountDaily}mm</div>`;

  // html += `<div class="popup__section">Wind speed: ${props["wind-speed-current"]}m/s</div>`;
  // html += `<div class="popup__section">Wind direction: ${props["wind-direction-current"]}°</div>`;

  const sunshineDuration = __getDailyMeasurement(data.sdatatypes["forecast-sunshine-duration"]?.tmeasurements || [])?.mvalue;
  html += `<div class="popup__section">Sunshine duration: ${sunshineDuration}h</div>`;

  const dayPoints = _getPointProperties(data);
  let dpHtml = '';

  dpHtml += `
      <div class="popup__table-labels">
      <div class="popup__table-labels-top-1">Air temperature</div>
      <div class="popup__table-labels-top-2">Wind</div>
      <div class="popup__table-labels-top-3">Precipitation</div>
    </div>`;

  for (const dp of dayPoints) {

    const type = getClearSkyType(new Date(dp.time), sunshineDuration);

    dpHtml += `<div class="popup__table-cell">

      <div class="popup__values-group popup__values-group--no-margin">
        <div>${formatTimeCustom(dp.time)}</div>
        <div>${dp["qualitative-forecast"]} (${type})</div>
      </div>

      <div class="popup__values-group">
        <div>${dp["air-temperature"]}℃</div>
      </div>

      <div class="popup__values-group">
        <div>${dp["wind-direction"]}° (${getWindDirectionLabel(dp["wind-direction"])})</div>
        <div>${dp["wind-speed"]}m/s</div>
      </div>
      <div class="popup__values-group">
        <div>${dp["precipitation-probability"]}%</div>
        <div>${dp["precipitation-sum"]}mm</div>
      </div>
    </div>`;
  }
  html += `<div class="popup__table">${dpHtml}</div>`;

  return `<div class="noi-weather-popup" part="popup">${html}</div>`;
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

/**
 */
function formatTimeCustom(dateStr: string) {
  if (!dateStr) {
    return '';
  }
  const date = new Date(dateStr);

  const hours = date.getHours();

  const minutes = ('0' + date.getMinutes()).slice(-2);

  return `${hours}:${minutes}`;
}


interface DayPointForecast {
  'time': string;
  'air-temperature'?: number;
  'wind-direction'?: number;
  'wind-speed'?: number;
  'precipitation-probability'?: number;
  'precipitation-sum'?: number;
  'qualitative-forecast'?: number;
}

/**
 */
function _getPointProperties(point: WeatherForecast) {
  const _uniqueDayPoints: string[] = [];

  function __collectTime(type: WeatherForecastMeasurementType) {
    for (const m of point.sdatatypes[type]?.tmeasurements) {
      if (m.mperiod === 86400) {
        // skip daily points
        continue;
      }
      if (!_uniqueDayPoints.includes(m.mvalidtime)) {
        _uniqueDayPoints.push(m.mvalidtime);
      }
    }
  }

  __collectTime('forecast-air-temperature');
  __collectTime('forecast-wind-direction');
  __collectTime('forecast-wind-speed');
  __collectTime('forecast-precipitation-probability');
  __collectTime('forecast-precipitation-sum');
  __collectTime('qualitative-forecast');

  const _uniqueDayPointsSorted = _uniqueDayPoints.sort((a, b) => a.localeCompare(b));

  function __getPointMeasurement(type: WeatherForecastMeasurementType, dp: string) {
    return (point.sdatatypes[type]?.tmeasurements || [])?.find(m => m.mvalidtime === dp);
  }

  const points: DayPointForecast[] = [];
  for (const dp of _uniqueDayPointsSorted) {
    const pointData: DayPointForecast = {
      'time': dp,
      'air-temperature': __getPointMeasurement('forecast-air-temperature', dp)?.mvalue,
      'wind-direction': __getPointMeasurement('forecast-wind-direction', dp)?.mvalue,
      'wind-speed': __getPointMeasurement('forecast-wind-speed', dp)?.mvalue,
      'precipitation-probability': __getPointMeasurement('forecast-precipitation-probability', dp)?.mvalue,
      'precipitation-sum': __getPointMeasurement('forecast-precipitation-sum', dp)?.mvalue,
      'qualitative-forecast': __getPointMeasurement('qualitative-forecast', dp)?.mvalue,
    };
    points.push(pointData);
  }
  return points;
}


/**
 */
function __getDailyMeasurement<T>(measurements: Measurement<T>[]) {

  const measurementDaily = measurements
    .filter(m => m.mperiod === 86400);

  if (measurementDaily.length > 1) {
    console.warn('Too many daily measurements:', measurements);
  }
  return measurementDaily[0];
}

/**
 * NOTE: this is not reliable way to calculate sunrize and sundown
 */
function getClearSkyType(now: Date, sunshineHours: number) {
  // 1. Establish Solar Noon for Italy based on the season
  // Summer (CEST) solar noon is around 13.25 (1:15 PM). Winter (CET) is around 12.25 (12:15 PM).
  // const solarNoon = isSummerTime ? 13.25 : 12.25;
  const solarNoon = 13.75;

  // 2. Calculate approximate sunrise and sunset using the duration
  const halfDaylight = sunshineHours / 2;
  const sunrise = solarNoon - halfDaylight;
  const sunset = solarNoon + halfDaylight;

  // 3. Get the current local hour in Italy (expressed as a decimal, e.g., 14.5 for 14:30)
  const currentHour = now.getHours() + (now.getMinutes() / 60);

  // 4. Determine if it is currently day or night
  if (currentHour >= sunrise && currentHour < sunset) {
    return 'day';
  } else {
    return 'night';
  }
}

/**
 *
 */
function getWindDirectionLabel(degrees: number | null | undefined) {
  if (degrees === null || degrees === undefined) {
    return '';
  }
  // 1. Normalize the degrees to keep them strictly between 0 and 359
  const normalizedDegrees = (degrees % 360 + 360) % 360;

  // 2. Define the 8 directions in clockwise order starting from North
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  // 3. Divide by 45 degrees per segment, and shift by half a segment (22.5°)
  // so that North centers perfectly around 0° / 360°
  const index = Math.round(normalizedDegrees / 45) % 8;

  return directions[index];
}
