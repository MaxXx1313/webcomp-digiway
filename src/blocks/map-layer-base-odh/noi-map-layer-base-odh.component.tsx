// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Element, Event, EventEmitter, Prop } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import {
  Map,
  MapGeoJSONFeature,
  MapMouseEvent,
  Popup,
  RequestTransformFunction,
  Subscription
} from "maplibre-gl";
import { listenLayerReady } from "../../utils/maplibre";
import { sanitizeText } from "../../utils/html";
import { base64String } from "./icon-font";

const HOST = 'https://geo.api.opendatahub.testingmachine.eu';

const ICON_FONT_NAME = 'noi-digiway-map-icons';

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
};

const _icons = {
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
} as const;

export interface LayerConfig {
  markerIcon?: keyof typeof _icons,
  isLineInteractive?: boolean;
  sourceLayer: string;
  additional: string;
  center?: [number, number];
  zoom?: number;

  requestTransform?: RequestTransformFunction;
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


  /**
   */
  @Prop({mutable: false})
  config!: LayerConfig;

  /**
   */
  @Prop({mutable: false})
  popupStructure?: ((feature: MapGeoJSONFeature, featureType: string) => PopupDefinition | string);

  /**
   * Emitted when layer data is loading
   */
  @Event() layerLoading!: EventEmitter<boolean>;

  private map!: Map;

  @Element() el!: HTMLElement;

  private _mapParent!: HTMLNoiMapElement;

  private _subscriptions: Subscription[] = [];

  private tileSource: string = '';
  private tileSourceFilter: string = '';
  private _popup?: Popup;
  private _popupFeatureId?: string | number;

  constructor() {
    this._uid = (_uid_seed++);
  }

  componentWillLoad() {
  }


  async connectedCallback() {
    // 1. Find the parent map element in the DOM tree
    this._mapParent = this.el.closest('noi-map') as HTMLNoiMapElement;

    this.el.setAttribute('data-id', this._uid + '');

    if (!this._mapParent) {
      console.error('[noi-map-layer-base-odh] must be a child of my-map');
      return;
    }

    this.layerLoading.emit(true);

    try {
      // 2. Safely wait for the map instance to be initialized by the parent
      this.map = await this._mapParent.getMapAsync();

      // 3. Add this layer to the map library instance
      await this.initLayer();
    } catch (error) {
      console.error('Failed to get map instance:', error);
    }
  }


  disconnectedCallback() {
    // Clean up the layer if the HTML element is removed from the DOM
    if (this.map) {
      this.destroyLayer();
      if (this.config.requestTransform) {
        this._mapParent.setUrlTransform(this.tileSourceFilter, null);
      }
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

      if (this.config.markerIcon) {
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
  async initLayer() {
    console.log(`[noi-map-layer-base-odh] Adding layer to map (${this._uid})`);
    const sourceLayer = this.config.sourceLayer;
    const additional = this.config.additional;


    this.tileSource = `${HOST}/api/tiles/${sourceLayer}/{z}/{x}/{y}.pbf${additional}`;
    if (this.config.requestTransform) {
      this.tileSourceFilter = `${HOST}/api/tiles/${sourceLayer}/`;
      await this._mapParent.setUrlTransform(this.tileSourceFilter, this.config.requestTransform);
    }

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
    if (this.config.markerIcon) {
      this._loadIconFont().then(() => {
        // Layout target boundaries
        const targetWidth = 16;
        const targetHeight = 16;
        const scale = 1; // 4x multiplier ensures sharp sub-pixel anti-aliasing

        // Create an offscreen rendering surface
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth * scale;
        canvas.height = targetHeight * scale;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // FORCE CRITICAL BROWSER ANTI-ALIASING ENGINE HINTS
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Clear background canvas space completely
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Apply scaling and text rendering layout details
          ctx.font = `${16 * scale}px "${ICON_FONT_NAME}"`;
          ctx.fillStyle = defaultStyles.icon["icon-color"];  // '#FFFFFF'; // Target paint color
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Render the exact hex string character ('\ue0c8' = Material Pin Marker)
          ctx.fillText(_icons[this.config.markerIcon!], canvas.width / 2, canvas.height / 2);

          // 4. FIX: Safely extract ImageData from the canvas.
          // This bypasses type errors and ensures MapLibre gets pure pixel data.
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);


          // 3. Register the crisp canvas bitmap straight into MapLibre
          this.map.addImage(this.uid('marker-icon'), imageData as any, {
            sdf: false,
            pixelRatio: scale  // Shrinks the 4x vector rendering smoothly down onto screen
          });
        }

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
            'icon-image': this.uid('marker-icon'), // Pointing to the generated canvas
            'icon-size': 1.0,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: defaultStyles.icon as any,
        });

        console.log(`[noi-map-layer-base-odh] layer added: ${this.uid('unclustered-icons')}`);
      });
    }
    console.log(`[noi-map-layer-base-odh] Successfully registered ${this.uid("vector-tiles")} source.`);

    this.resetPosition();

    ///////// Click handlers
    const _polygonsClick = this.map.on('click', this.uid('polygons'), (e) => {
      const feature = e.features![0];
      console.log('(debug) Clicked polygons:', feature);
      this.createFeaturePopup(feature, e.lngLat);
    });
    this._subscriptions.push(_polygonsClick);


    const _pointClick = this.map.on('click', this.uid('unclusteredpoints'), (e) => {
      const feature = e.features![0];
      console.log('(debug) Clicked unclusteredpoints:', feature);
      this.createFeaturePopup(feature, e.lngLat);
    });
    this._subscriptions.push(_pointClick);

    // 'lines' should come after 'unclusteredpoints', so we can skip it if point is clicked
    if (this.config.isLineInteractive) {
      const _linesClick = this.map.on('click', this.uid('lines'), (e) => {
        const feature = e.features![0];
        console.log('(debug) Clicked lines:', feature);
        this.createFeaturePopup(feature, e.lngLat);
      });
      this._subscriptions.push(_linesClick);
    }

    const _clusterClick = this.map.on('click', this.uid('clusters'), (e) => {
      const feature = e.features![0] as any;
      console.log('(debug) Clicked clusters:', feature);
      this.map.easeTo({
        center: feature.geometry.coordinates,
        zoom: this.map.getZoom() + 2
      });
    });
    this._subscriptions.push(_clusterClick);


    const hoveredIds: { [event: string]: string | null } = {
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

        const featureId = e.features![0]?.id as string;
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

  createFeaturePopup(feature: MapGeoJSONFeature, lngLat: MapMouseEvent['lngLat']) {
    const featureId = feature.id;
    if (this._popupFeatureId === featureId) {
      return; // same popup is already opened by another event
    }
    this._popupFeatureId = featureId;
    this._popup = new Popup()
      .setLngLat(lngLat)
      .setHTML(this._createPopupBodyHTML(feature, feature.layer.type))
      .addTo(this.map);
    this._popup.on('close', () => {
      this._popupFeatureId = undefined;
    });
  }

  // Feature popup helper
  _createPopupBodyHTML(feature: MapGeoJSONFeature, featureType: string) {
    const fn = this.popupStructure || debugPopupStructure;
    const structure = fn(feature, featureType);
    if (typeof structure === 'string') {
      return structure;
    } else {
      return _popupBuilder(structure);
    }
  }

  async _loadIconFont() {

    // TypeScript's internal DOM type definitions have a historical gap regarding the FontFaceSet interface, so we use 'any'
    const documentFonts = document.fonts as any;

    // 1. Check if another instance of your icon component already registered this font
    const isAlreadyLoaded = Array.from(documentFonts.values()).some(
      (font: any) => font.family === ICON_FONT_NAME
    );

    if (isAlreadyLoaded) {
      console.debug(`[noi-map-layer-base-odh] _loadIconFont - already loaded`);
      return;
    }

    console.log(`[noi-map-layer-base-odh] _loadIconFont`);

    // 2. Instantiate and load the font directly into memory
    const iconFontFace = new FontFace(
      ICON_FONT_NAME,
      `url(${base64String}) format('woff2')`
    );

    const fontLoadResult = await iconFontFace.load();
    console.debug(`[noi-map-layer-base-odh] icon font loaded`, fontLoadResult);

    // Inject it into document.fonts so the entire page (and all shadow roots) can use it
    documentFonts.add(iconFontFace);
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
      if (bDef.text) {
        popupContent += `<div class="popup__description">${sanitizeText(bDef.text)}</div>`;
      }
      continue;
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
function debugPopupStructure(feature: MapGeoJSONFeature, featureType: string) {
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
