// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Element, Event, EventEmitter } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { Map, Subscription } from "maplibre-gl";
import { listenLayerReady } from "../../utils/maplibre";
import { WeatherForecastService } from "../../data/noi/weather-forecast-service";
import { GeoJSON } from "geojson";

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

  constructor() {
  }


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

    // Convert your 2000 points into a GeoJSON FeatureCollection
    const geojsonPoints: GeoJSON = {
      type: 'FeatureCollection',
      features: forecastData.map(point => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.scoordinate.x, point.scoordinate.y] // Ensure longitude is FIRST
        },
        properties: point.sdatatypes,
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
      paint: {
        'circle-radius': 6,
        // Color circles dynamically based on temperature data
        'circle-color': [
          'step',
          ['get', 'temperature'],
          '#2196F3', 0,  // Blue if below 0°C
          '#4CAF50', 20, // Green if between 0°C and 20°C
          '#F44336'      // Red if above 20°C
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    });

  }

  destroyLayer() {
    console.log('[noi-map-layer-weather] Removing layer from map');

    for (const subscription of this._subscriptions) {
      subscription.unsubscribe();
    }
    this._subscriptions = [];

    if (this.map && this.map.getSource('source-weather-data')) {
      this.map.removeLayer('layer-weather-data');

      this.map.removeSource('source-weather-data');
    }
  }
}
