// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Element, Event, EventEmitter } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { Map, MapGeoJSONFeature, MapMouseEvent, Popup, Subscription } from "maplibre-gl";
import {
  enableHoverEffect,
  FontIconPaintParams,
  getFontIconData,
  listenLayerReady,
  loadIconFont
} from "../../utils/maplibre";
import { WeatherForecastService } from "../../data/noi/weather-forecast-service";
import { GeoJSON, GeoJsonProperties } from "geojson";
import { WeatherForecast } from "../../data/noi/WeatherForecase";
import { Measurement } from "../../data/noi/types-v1-common";
import { createPopupBodyHTML } from "../../utils/maplibre-popup";
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
      0, ['case', ['boolean', ['feature-state', 'hover'], false], 14, 9],
      10, ['case', ['boolean', ['feature-state', 'hover'], false], 14, 10],
      14, ['case', ['boolean', ['feature-state', 'hover'], false], 14, 12],
      18, ['case', ['boolean', ['feature-state', 'hover'], false], 14, 14]
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
    const forecastDataTmp = forecastData.slice(0, 1); // FIXME: debug

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
        properties: _preparePointProperties(point),
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
      console.log('(debug) Clicked polygons:', feature);
      this.createFeaturePopup(feature, e.lngLat);
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


  createFeaturePopup(feature: MapGeoJSONFeature, lngLat: MapMouseEvent['lngLat']) {
    const featureId = feature.id;
    if (this._popupFeatureId === featureId) {
      return; // same popup is already opened by another event
    }
    this._popupFeatureId = featureId;
    this._popup = new Popup()
      .setLngLat(lngLat)
      .setHTML(createPopupBodyHTML(null, feature, feature.layer.type))
      .addTo(this.map);
    this._popup.on('close', () => {
      this._popupFeatureId = undefined;
    });
  }

}


/**
 *
 */
function _preparePointProperties(point: WeatherForecast): GeoJsonProperties {
  const now = new Date();
  const description = __getDailyMeasurement(point.sdatatypes["qualitative-forecast"]?.tmeasurements || [])?.mvalue;
  return {
    'air-temperature-current': __getRelevantMeasurement(point.sdatatypes["forecast-air-temperature"]?.tmeasurements || [], now)?.mvalue,
    'air-temperature-min': __getDailyMeasurement(point.sdatatypes["forecast-air-temperature-min"]?.tmeasurements || [])?.mvalue,
    'air-temperature-max': __getDailyMeasurement(point.sdatatypes["forecast-air-temperature-max"]?.tmeasurements || [])?.mvalue,
    'wind-direction-current': __getRelevantMeasurement(point.sdatatypes["forecast-wind-direction"]?.tmeasurements || [], now)?.mvalue,
    'wind-speed-current': __getRelevantMeasurement(point.sdatatypes["forecast-wind-speed"]?.tmeasurements || [], now)?.mvalue,
    'precipitation-probability-current': __getRelevantMeasurement(point.sdatatypes["forecast-precipitation-probability"]?.tmeasurements || [], now)?.mvalue,
    'precipitation-probability-daily': __getDailyMeasurement(point.sdatatypes["forecast-precipitation-probability"]?.tmeasurements || [])?.mvalue,
    'precipitation-current': __getRelevantMeasurement(point.sdatatypes["forecast-precipitation-sum"]?.tmeasurements || [], now)?.mvalue,
    'precipitation-daliy': __getDailyMeasurement(point.sdatatypes["forecast-precipitation-sum"]?.tmeasurements || [])?.mvalue,
    'sunshine-duration': __getDailyMeasurement(point.sdatatypes["forecast-sunshine-duration"]?.tmeasurements || [])?.mvalue,
    icon: description, // TODO: get by description
    // data: point.sdatatypes, // TODO: add later?
  };
}

/**
 */
function __getRelevantMeasurement(measurements: Measurement[], now: Date = new Date()) {

  // sort in 'desc' order
  // note: date is JS-date format which is sorted correctly as a string
  const measurementSorted = measurements
    .filter(m => m.mperiod !== 86400) // filter-out daily measurements
    .sort((a, b) => b.mvalidtime.localeCompare(a.mvalidtime));

  // find first record having less than current time
  return measurementSorted.find(m => {
    const d = new Date(m.mvalidtime);
    return d < now;
  }) || null;
}


/**
 */
function __getDailyMeasurement(measurements: Measurement[]) {

  const measurementDaily = measurements
    .filter(m => m.mperiod === 86400);

  if (measurementDaily.length > 1) {
    console.warn('Too many daily measurements:', measurements);
  }
  return measurementDaily[0];
}
//
// function _getIcon(description: string) {
//   ICON_FONT_ICONS
// }
