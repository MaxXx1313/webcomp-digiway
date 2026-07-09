// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Element, Event, EventEmitter, Prop } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { Map, Popup, Subscription } from "maplibre-gl";
import { listenLayerReady } from "../../utils/maplibre";
import { sanitizeText } from "../../utils/html";

const HOST = 'https://geo.api.opendatahub.testingmachine.eu';

// Default styles
const defaultStyles = {
  polygons: {
    'fill-color': [
      'case', ['boolean', ['feature-state', 'hover'], false],
      '#0055CC',   // hovered - darker blue
      '#0080FF'    // normal
    ],
    'fill-opacity': [
      'case', ['boolean', ['feature-state', 'hover'], false],
      0.7,   // hovered
      0.4    // normal
    ],
    'fill-outline-color': [
      'case', ['boolean', ['feature-state', 'hover'], false],
      '#FFFFFF',   // hovered - white outline to pop
      '#004080'    // normal
    ]
  },
  lines: {
    'line-color': '#404040',
    'line-width': [
      'interpolate', ['linear'], ['zoom'],
      8, ['case', ['boolean', ['feature-state', 'hover'], false], 5, 1],
      12, ['case', ['boolean', ['feature-state', 'hover'], false], 5, 2],
      16, ['case', ['boolean', ['feature-state', 'hover'], false], 5, 4],
      20, ['case', ['boolean', ['feature-state', 'hover'], false], 5, 6]
    ],
    'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1.0, 0.8]
  },
  unclusteredpoints: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      0, ['case', ['boolean', ['feature-state', 'hover'], false], 14, 8],
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
  }
};

export interface LayerConfig {
  markerIconSVG?: string;
  isLineInteractive?: boolean;
  sourceLayer: string;
  additional: string;
  center?: [number, number];
  zoom?: number;
}

export interface PopupDefinition {
  title?: {
    icon?: string;
    text?: string;
  },
  body: Array<{
    type: 'name' | 'description' | 'section';
    // 'text' is for 'name' and 'description'
    text?: string;
    // 'section' is for 'section'
    section?: {
      name: string;
      value: string;
    };
  }>;
}

let _uid_seed = 0;

/**
 * (INTERNAL) render map layer
 */
@Component({
  tag: 'noi-map-layer-base-odh',
  styleUrl: 'noi-map-layer-base-odh.css',
  shadow: false,
})
export class NoiMapLayerBaseOdhComponent implements StencilComponent {

  private _uid = -1;


  uid(name: string) {
    return 'base-odh-' + name + '-' + this._uid;
  }

  private map: Map = null;

  @Element() el: HTMLElement;

  /**
   */
  @Prop({mutable: false})
  config!: LayerConfig;

  /**
   */
  @Prop({mutable: false})
  popupStructure?: ((feature: any, featureType: string) => PopupDefinition | string);

  /**
   * Emitted when layer data is loading
   */
  @Event() layerLoading: EventEmitter<boolean>;

  private _subscriptions: Subscription[] = [];

  private tileSource: string = '';
  private _popup?: Popup;

  constructor() {
    this._uid = (_uid_seed++);
  }

  componentWillLoad() {
  }


  async connectedCallback() {
    // 1. Find the parent map element in the DOM tree
    const mapParent = this.el.closest('noi-map') as HTMLNoiMapElement;

    this.el.setAttribute('data-id', this._uid + '');

    if (!mapParent) {
      console.error('[noi-map-layer-base-odh] must be a child of my-map');
      return;
    }

    this.layerLoading.emit(true);

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

  /**
   *
   */
  destroyLayer() {
    console.log(`[noi-map-layer-base-odh] Removing layer from map (${this._uid})`);

    for (const subscription of this._subscriptions) {
      subscription.unsubscribe();
    }
    this._subscriptions = [];

    // Cleanup source when HTML element gets removed from DOM
    if (this.map && this.map.getSource(this.uid('vector-tiles'))) {
      // Must remove dependent layers first before removing the source
      this.map.removeLayer(this.uid('polygons'));
      this.map.removeLayer(this.uid('lines'));
      this.map.removeLayer(this.uid('clusters'));
      this.map.removeLayer(this.uid('cluster-count'));
      this.map.removeLayer(this.uid('unclusteredpoints'));

      if (this.config.markerIconSVG) {
        this.map.removeLayer(this.uid('unclustered-icons'));
        this.map.removeImage(this.uid('marker-icon'));
      }
      this.map.removeSource(this.uid('vector-tiles'));
    }

    this._popup?.remove();
  }


  /**
   *
   */
  initLayer() {
    const sourceLayer = this.config.sourceLayer;
    const additional = this.config.additional;

    // private SOURCE_LAYER = 'spatialdata';
    // private additional = '?source=dservices3.arcgis.com&tagfilter=radrouten_tirol';

    this.tileSource = `${HOST}/api/tiles/${sourceLayer}/{z}/{x}/{y}.pbf${additional}`;

    console.log(`[noi-map-layer-base-odh] Adding layer to map (${this._uid})`);
    const sourceId = this.uid('vector-tiles');


    // 1. Start listening to incoming source updates
    const _loadEvent = listenLayerReady(this.map, sourceId, () => {
      this.layerLoading.emit(false);
    });
    this._subscriptions.push(_loadEvent);

    // Register your vector tile configuration
    this.map.addSource(this.uid('vector-tiles'), {
      type: 'vector',
      tiles: [this.tileSource],
      minzoom: 0,
      maxzoom: 22,
      promoteId: 'id' // Promotes your 'id' data property to the native feature.id hook
    });

    // Register layers
    this.map.addLayer({
      id: this.uid('polygons'),
      type: 'fill',
      source: this.uid('vector-tiles'),
      'source-layer': sourceLayer,
      filter: ['any',
        ['==', ['geometry-type'], 'Polygon'],
        ['==', ['geometry-type'], 'MultiPolygon']
      ],
      paint: defaultStyles.polygons as any,
    });

    this.map.addLayer({
      id: this.uid('lines'),
      type: 'line',
      source: this.uid('vector-tiles'),
      'source-layer': sourceLayer,
      filter: ['any',
        ['==', ['geometry-type'], 'LineString'],
        ['==', ['geometry-type'], 'MultiLineString']
      ],
      paint: defaultStyles.lines as any,
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      }
    });

    // CLUSTER CIRCLES
    this.map.addLayer({
      id: this.uid('clusters'),
      type: 'circle',
      source: this.uid('vector-tiles'),
      'source-layer': sourceLayer,
      filter: ['all',
        ['==', ['geometry-type'], 'Point'],
        ['==', ['get', 'cluster'], true]
      ],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          2, 12,
          10, 18,
          50, 28,
          200, 40
        ],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          2, '#66c2ff',
          10, '#3399ff',
          50, '#0066cc',
          200, '#003366'
        ],
        'circle-opacity': 0.85
      }
    });

    // CLUSTER COUNT LABEL
    this.map.addLayer({
      id: this.uid('cluster-count'),
      type: 'symbol',
      source: this.uid('vector-tiles'),
      'source-layer': sourceLayer,
      filter: ['all',
        ['==', ['geometry-type'], 'Point'],
        ['==', ['get', 'cluster'], true]
      ],
      layout: {
        'text-field': ['get', 'count'],
        'text-size': 14
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // SINGLE POINTS
    this.map.addLayer({
      id: this.uid('unclusteredpoints'),
      type: 'circle',
      source: this.uid('vector-tiles'),
      'source-layer': sourceLayer,
      filter: ['all',
        ['==', ['geometry-type'], 'Point'],
        ['!=', ['get', 'cluster'], true]
      ],
      paint: defaultStyles.unclusteredpoints as any,
    });


    // ICON LAYER ON TOP OF CIRCLES
    if (this.config.markerIconSVG) {
      this.map.addLayer({
        id: this.uid('unclustered-icons'),
        type: 'symbol',
        source: this.uid('vector-tiles'),
        'source-layer': sourceLayer,
        filter: ['all',
          ['==', ['geometry-type'], 'Point'],
          ['!=', ['get', 'cluster'], true]
        ],
        layout: {
          'icon-image': this.uid('marker-icon'), // Matches the ID
          'icon-size': 1.0,               // Adjust scale if needed
          'icon-allow-overlap': true,     // Prevents icon from hiding when crowded
          'icon-ignore-placement': true
        },
        paint: defaultStyles.icon as any,
      });

      const svgDataUrl = `data:image/svg+xml;base64,${btoa(this.config.markerIconSVG)}`;

      const img = new Image(13, 14); // Set desired width and height
      img.src = svgDataUrl;
      img.onload = () => {
        // Add the image to the map style with a unique ID
        this.map.addImage(this.uid('marker-icon'), img, {sdf: true, pixelRatio: 1});
      };
    }
    console.log(`[noi-map-layer-base-odh] Successfully registered ${this.uid("vector-tiles")} source.`);

    this.resetPosition();

    ///////// Click handlers
    const _polygonsClick = this.map.on('click', this.uid('polygons'), (e) => {
      const feature = e.features[0];
      console.log('(debug) Clicked polygons:', feature);
      this._popup = new Popup()
        .setLngLat(e.lngLat)
        .setHTML(createDebugPopup(feature, 'polygons'))
        .addTo(this.map);
    });
    this._subscriptions.push(_polygonsClick);


    const _pointClick = this.map.on('click', this.uid('unclusteredpoints'), (e) => {
      const feature = e.features[0];
      console.log('(debug) Clicked unclusteredpoints:', feature);
      this._popup = new Popup()
        .setLngLat(e.lngLat)
        .setHTML(this.createPopup(feature, 'unclusteredpoints'))
        .addTo(this.map);
    });
    this._subscriptions.push(_pointClick);

    // 'lines' should come after 'unclusteredpoints', so we can skip it if point is clicked
    if (this.config.isLineInteractive) {
      const _linesClick = this.map.on('click', this.uid('lines'), (e) => {
        const feature = e.features[0];
        console.log('(debug) Clicked lines:', feature);
        this._popup = new Popup()
          .setLngLat(e.lngLat)
          .setHTML(this.createPopup(feature, 'line'))
          .addTo(this.map);
      });
      this._subscriptions.push(_linesClick);
    }

    const _clusterClick = this.map.on('click', this.uid('clusters'), (e) => {
      const feature = e.features[0] as any;
      console.log('(debug) Clicked clusters:', feature);
      this.map.easeTo({
        center: feature.geometry.coordinates,
        zoom: this.map.getZoom() + 2
      });
    });
    this._subscriptions.push(_clusterClick);


    const hoveredIds = {
      lines: null,
      unclusteredpoints: null,
      polygons: null,
      clusters: null,
    };

    // Hover effects
    let hoverTargets = ['unclusteredpoints', 'polygons', 'clusters'];
    if (this.config.isLineInteractive) {
      hoverTargets = ['unclusteredpoints', 'polygons', 'lines', 'clusters'];
    }
    // ['unclusteredpoints', 'polygons', 'lines', 'clusters'].forEach(layerName => {
    // ['unclusteredpoints', 'polygons', 'clusters'].forEach(layerName => {
    hoverTargets.forEach(layerName => {
      const layer = this.uid(layerName);
      const source = this.uid('vector-tiles');

      //
      const _layerEnter = this.map.on('mouseenter', layer, (e) => {
        this.map.getCanvas().style.cursor = 'pointer';

        const featureId = e.features[0]?.id;
        // console.log('mouseenter', featureId, e);

        if (featureId == null) return; // guard

        // Clear previous hover on this layer
        if (hoveredIds[layerName] !== null) {
          this.map.setFeatureState(
            {source: source, sourceLayer: sourceLayer, id: hoveredIds[layerName]},
            {hover: false}
          );
        }

        // Set new hover
        hoveredIds[layerName] = featureId;
        this.map.setFeatureState(
          {source: source, sourceLayer: sourceLayer, id: hoveredIds[layerName]},
          {hover: true}
        );
      });
      this._subscriptions.push(_layerEnter);

      //
      const _layerLeave = this.map.on('mouseleave', layer, () => {
        this.map.getCanvas().style.cursor = '';

        // Clear hover on this layer
        if (hoveredIds[layerName] !== null) {
          this.map.setFeatureState(
            {source: source, sourceLayer: sourceLayer, id: hoveredIds[layerName]},
            {hover: false}
          );
          hoveredIds[layerName] = null;
        }
      });
      this._subscriptions.push(_layerLeave);
    });

    // Click anywhere for debug
    const _debugClick = this.map.on('click', (e) => {
      const features = this.map.queryRenderedFeatures(e.point);
      console.log('[DEBUG] All features at click:', features);
      console.log('[DEBUG] Vector features:', features.filter(f => f.source === 'vector-tiles'));
    });
    this._subscriptions.push(_debugClick);
  }

  resetPosition() {
    if (this.config.center || this.config.zoom) {
      this.map.flyTo({
        center: this.config.center ?? undefined,
        zoom: this.config.zoom ?? undefined,
      });
    }
  }

  // Feature popup helper
  createPopup(feature, featureType) {
    const fn = this.popupStructure || createDebugPopup;
    const structure = fn(feature, featureType);
    if (typeof structure === 'string') {
      return structure;
    } else {
      return _popupBuilder(structure);
    }
  }

}

/**
 */
function _popupBuilder(def: PopupDefinition): string {

  let popupContent = '';
  if (def.title) {

    let popupTitleContent = '';
    if (def.title?.icon) {
      popupTitleContent += `<noi-icon class="popup__header-icon" name="${def.title.icon}" alt="icon"></noi-icon>`;
    }
    if (def.title?.text) {
      popupTitleContent += `<div>${def.title.text}</div>`;
    }

    popupContent += `<div class="popup__header">${popupTitleContent}</div>`;
  }

  for (const bDef of def.body) {

    if (bDef.type === 'name') {
      popupContent += `<div class="popup__name">${bDef.text}</div>`;
    }
    if (bDef.type === 'description') {
      popupContent += `<div class="popup__description">${sanitizeText(bDef.text)}</div>`;
    }
    if (bDef.type === 'section') {
      if (bDef.section?.value === null || bDef.section?.value === undefined) {
        continue;
      }
      popupContent += `<div class="popup__section">
          <div class="popup__section-name">${bDef.section.name}</div>
          <div class="popup__section-value">${bDef.section.value}</div>
        </div>`;
    }
  }
  return `<div class="noi-map-popup" part="popup">${popupContent}</div>`;
}

// Feature popup helper
function createDebugPopup(feature, featureType) {
  const props = feature.properties;
  let html = `<strong>${featureType} Feature</strong><br>`;
  html += `<strong>ID:</strong> ${props.id}<br>`;

  if (featureType === 'Line') {
    html += `<strong>Type:</strong> ${feature.geometry.type}<br>`;
  }

  // Alle flachen Properties auÃŸer count & cluster
  Object.keys(props).forEach(key => {
    if (['id', 'count', 'cluster'].includes(key)) return;
    // Wenn es die 'data' Spalte ist, dann parse JSON
    if (key === 'data' && props.data) {
      try {
        const data = JSON.parse(props.data);
        Object.keys(data).forEach(k => {
          html += `<strong>${k}:</strong> ${data[k]}<br>`;
        });
      } catch (e) {
        html += `<strong>Data:</strong> ${props.data}<br>`;
      }
    } else {
      html += `<strong>${key}:</strong> ${props[key]}<br>`;
    }
  });

  return html;
}
