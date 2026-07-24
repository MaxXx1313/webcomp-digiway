// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Element, Event, EventEmitter } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { Map, MapGeoJSONFeature, MapMouseEvent, Popup, Subscription } from "maplibre-gl";
import { enableHoverEffect, listenLayerReady } from "../../utils/maplibre";
import { WeatherForecastService } from "../../data/noi/weather-forecast-service";
import { GeoJSON, GeoJsonProperties } from "geojson";
import { WeatherForecast } from "../../data/noi/WeatherForecase";
import { Measurement } from "../../data/noi/types-v1-common";
import { createPopupBodyHTML } from "../../utils/maplibre-popup";


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
  icon: {
    // You can now pass any color dynamically here!
    'icon-color': '#FFFFFF',
  },
} as const;


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
  return {
    temperature: __getRelevantMeasurement(point.sdatatypes["forecast-air-temperature"]?.tmeasurements || [], now)?.mvalue,
    icon: __getDailyMeasurement(point.sdatatypes["qualitative-forecast"]?.tmeasurements || [])?.mvalue,
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
