// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Element, Event, EventEmitter, Prop } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { Map, Popup, Subscription } from "maplibre-gl";
import { listenLayerReady } from "../../utils/maplibre";
import { LanguageDataService } from "../../data/language/language-data-service";

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


/**
 * (INTERNAL) render map layer
 */
@Component({
  tag: 'noi-map-layer-base-odh',
  styleUrl: 'noi-map-layer-base-odh.css',
  shadow: false,
})
export class NoiMapLayerBaseOdhComponent implements StencilComponent {

  static _uid_seed = 0;
  private _uid = -1;


  uid(name: string) {
    return 'base-odh-' + name + '-' + this._uid;
  }

  private map: Map = null;

  @Element() el: HTMLElement;

  /**
   */
  @Prop({mutable: false})
  sourceLayer: string = '';

  /**
   */
  @Prop({mutable: false})
  additional: string = '';

  /**
   *
   */
  @Event() popup: EventEmitter<{ checked: boolean }>;

  /**
   * Emitted when layer data is loading
   */
  @Event() layerLoading: EventEmitter<boolean>;

  private _subscriptions: Subscription[] = [];

  private languageService = LanguageDataService.getInstance();

  constructor() {
    this._uid = NoiMapLayerBaseOdhComponent._uid_seed++;
  }


  async connectedCallback() {
    // 1. Find the parent map element in the DOM tree
    const mapParent = this.el.closest('noi-map') as HTMLNoiMapElement;

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
    console.log('[noi-map-layer-base-odh] Removing layer from map');

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
      this.map.removeLayer(this.uid('unclustered-icons'));

      this.map.removeImage(this.uid('marker-icon'));
      this.map.removeSource(this.uid('vector-tiles'));
    }
  }

  private tileSource: string = '';

  /**
   *
   */
  initLayer() {

    // private SOURCE_LAYER = 'spatialdata';
    // private additional = '?source=dservices3.arcgis.com&tagfilter=radrouten_tirol';

    this.tileSource = `${HOST}/api/tiles/${this.sourceLayer}/{z}/{x}/{y}.pbf${this.additional}`;

    console.log(`[noi-map-layer-base-odh] Adding layer to map`);
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
      'source-layer': this.sourceLayer,
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
      'source-layer': this.sourceLayer,
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
      'source-layer': this.sourceLayer,
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
      'source-layer': this.sourceLayer,
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
      'source-layer': this.sourceLayer,
      filter: ['all',
        ['==', ['geometry-type'], 'Point'],
        ['!=', ['get', 'cluster'], true]
      ],
      paint: defaultStyles.unclusteredpoints as any,
    });
    // ICON LAYER ON TOP OF CIRCLES
    this.map.addLayer({
      id: this.uid('unclustered-icons'),
      type: 'symbol',
      source: this.uid('vector-tiles'),
      'source-layer': this.sourceLayer,
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


    // Create an image element from your SVG
    const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 14" width="13" height="14">
<path fill="#000" transform="translate(-0.397277 -0.432251)" d="M1.3377938 1.2524521L1.9222034 1.7225218L12.257004 10.035315L12.841413 10.505384L11.901274 11.674204L11.316864 11.204134L10.098348 10.222855C9.4767561 11.037601 8.5610418 12.180302 7.3460169 13.658503L6.8045034 14.317308L6.2202716 13.696073C3.0523477 10.3275 1.4521582 7.7488637 1.4521582 5.8268242C1.4521582 5.0637822 1.6158494 4.324369 1.9239701 3.6489837L0.98206413 2.891341L0.39765453 2.4212713L1.3377938 1.2524521ZM2.9521582 5.8268242C2.9521582 7.103796 4.1292086 9.1241398 6.5072241 11.789603L6.7321582 12.040264L6.8603897 11.883761C7.7523637 10.789391 8.4431534 9.9206095 8.9298134 9.2817011L3.1462195 4.6324973C3.0187449 5.0123882 2.9521582 5.4143958 2.9521582 5.8268242ZM6.9667921 0.43226403C9.7213211 0.43226403 11.952158 2.6788723 11.952158 5.4475727C11.952158 5.9758482 11.828241 6.5473938 11.587657 7.1651077C11.546609 7.2705007 11.50212 7.3773484 11.454201 7.485673L10.082424 6.8788548C10.121344 6.790874 10.157173 6.704824 10.189927 6.6207271C10.367165 6.1656585 10.452158 5.7736406 10.452158 5.4475727C10.452158 3.5049431 8.8905191 1.9322641 6.9667921 1.9322641C6.2197981 1.9322641 5.5100574 2.1690013 4.9191732 2.6025107C4.8417072 2.6593447 4.7665629 2.7193809 4.6939421 2.7824502L3.7103741 1.6499337C3.8139961 1.5599401 3.9212539 1.474247 4.0318694 1.3930925C4.8778 0.77246583 5.8977275 0.43226403 6.9667921 0.43226403Z"/>
<path fill="#000" transform="translate(0.657227 -0.432251)" d="M1.3987546 2.7417667L2.6127763 3.6227612C2.1500471 4.2604079 1.8976545 5.0238657 1.8976545 5.8268242C1.8976545 7.103796 3.0747049 9.1241398 5.4527206 11.789603L5.6776547 12.040264L5.8058863 11.883761C7.1544714 10.229171 8.0431747 9.0902481 8.4618168 8.4818001L8.5240107 8.3901396L9.7712984 9.2233696C9.2867079 9.9487696 8.1327972 11.418393 6.291513 13.658503L5.75 14.317308L5.1657677 13.696073C1.9978441 10.3275 0.39765453 7.7488637 0.39765453 5.8268242C0.39765453 4.7045021 0.75178492 3.6332989 1.3987546 2.7417667ZM5.9122882 0.43226403C8.6668177 0.43226403 10.897655 2.6788723 10.897655 5.4475727C10.897655 5.9758482 10.773738 6.5473938 10.533154 7.1651077C10.492105 7.2705007 10.447616 7.3773484 10.399697 7.485673L9.0279207 6.8788548C9.0668402 6.790874 9.1026697 6.704824 9.1354237 6.6207271C9.3126612 6.1656585 9.3976545 5.7736406 9.3976545 5.4475727C9.3976545 3.5049431 7.8360157 1.9322641 5.9122882 1.9322641C5.1652946 1.9322641 4.455554 2.1690013 3.8646698 2.6025107C3.7872033 2.6593447 3.712059 2.7193809 3.6394386 2.7824502L2.6558704 1.6499337C2.7594924 1.5599401 2.8667505 1.474247 2.977366 1.3930925C3.8232961 0.77246583 4.843224 0.43226403 5.9122882 0.43226403Z"/>
<path fill="#000" transform="translate(1.05488 2.30952)" d="M1.0011001 0L2.2151215 0.88099468C1.7523925 1.5186411 1.5 2.2820992 1.5 3.0850575C1.5 4.3620296 2.6770504 6.3823733 5.0550661 9.0478363L5.2800002 9.2984972L5.4082317 9.1419945C6.7568169 7.4874039 7.6455202 6.3484817 8.0641623 5.7400331L8.1263561 5.6483727L9.3736439 6.4816027C8.8890533 7.2070026 7.7351432 8.6766262 5.8938584 10.916737L5.3523455 11.575542L4.7681131 10.954306C1.6001896 7.5857339 0 5.0070972 0 3.0850575C0 1.9627355 0.35413042 0.89153218 1.0011001 0Z"/>
<path fill="#000" transform="translate(3.3131 0)" d="M3.2564178 0C6.0109468 0 8.2417841 2.2466083 8.2417841 5.0153084C8.2417841 5.5435843 8.1178665 6.1151295 7.8772831 6.7328434C7.836235 6.8382368 7.7917452 6.9450846 7.7438269 7.0534091L6.3720503 6.4465909C6.4109693 6.3586102 6.4467993 6.2725601 6.4795527 6.1884632C6.6567903 5.7333946 6.7417841 5.3413768 6.7417841 5.0153084C6.7417841 3.072679 5.1801453 1.5 3.2564178 1.5C2.509424 1.5 1.7996836 1.7367374 1.2087992 2.1702466C1.1313329 2.2270806 1.0561886 2.2871168 0.98356807 2.3501861L0 1.2176696C0.10362186 1.1276761 0.21087988 1.0419829 0.32149541 0.96082854C1.1674256 0.34020182 2.1873534 0 3.2564178 0Z"/>
<path fill="#000" transform="translate(-0.397277 0.387937)" d="M1.3377938 0.43226403L1.9222034 0.90233368L12.257004 9.215127L12.841413 9.6851959L11.901274 10.854015L11.316864 10.383945L0.98206413 2.0711527L0.39765453 1.6010832L1.3377938 0.43226403Z"/>
<path fill="#000" transform="translate(0.000377655 0.8202)" d="M0.94013929 0L1.5245489 0.47006965L11.859349 8.7828627L12.443758 9.2529325L11.503619 10.421751L10.919209 9.9516821L0.58440953 1.6388887L0 1.1688191L0.94013929 0Z"/>
<path fill="#000" transform="translate(5.11544 3.72476)" d="M1.3976545 0.43226403C1.9499393 0.43226403 2.3976545 0.87997931 2.3976545 1.4322641C2.3976545 1.9845488 1.9499393 2.4322641 1.3976545 2.4322641C0.84536982 2.4322641 0.39765453 1.9845488 0.39765453 1.4322641C0.39765453 0.87997931 0.84536982 0.43226403 1.3976545 0.43226403Z"/>
<path fill="#000" transform="translate(5.5131 4.15702)" d="M1 0C1.5522847 0 2 0.44771525 2 1C2 1.5522847 1.5522847 2 1 2C0.44771525 2 0 1.5522847 0 1C0 0.44771525 0.44771525 0 1 0Z"/>
</svg>
`;
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;

    const img = new Image(13, 14); // Set desired width and height
    img.src = svgDataUrl;
    img.onload = () => {
      // Add the image to the map style with a unique ID
      this.map.addImage(this.uid('marker-icon'), img, {sdf: true, pixelRatio: 1});
    };

    console.log(`[noi-map-layer-base-odh] Successfully registered ${this.uid("vector-tiles")} source.`);


    ///////// Click handlers
    const _polygonsClick = this.map.on('click', this.uid('polygons'), (e) => {
      const feature = e.features[0];
      console.log('(debug) Clicked polygons:', feature);
      new Popup()
        .setLngLat(e.lngLat)
        .setHTML(createDebugPopup(feature, 'Polygon'))
        .addTo(this.map);
    });
    this._subscriptions.push(_polygonsClick);


    const _pointClick = this.map.on('click', this.uid('unclusteredpoints'), (e) => {
      const feature = e.features[0];
      console.log('(debug) Clicked unclusteredpoints:', feature);
      new Popup()
        .setLngLat(e.lngLat)
        .setHTML(this.createPopup(feature/*, 'Point'*/))
        .addTo(this.map);
    });
    this._subscriptions.push(_pointClick);

    // 'lines' should come after 'unclusteredpoints', so we can skip it if point is clicked
    // const _linesClick = this.map.on('click', uid('lines'), (e) => {
    //   const feature = e.features[0];
    //   console.log('(debug) Clicked lines:', feature);
    //   new Popup()
    //     .setLngLat(e.lngLat)
    //     .setHTML(createDebugPopup(feature, 'Line'))
    //     .addTo(this.map);
    // });
    // this._subscriptions.push(_linesClick);

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
    // ['unclusteredpoints', 'polygons', 'lines', 'clusters'].forEach(layerName => {
    ['unclusteredpoints', 'polygons', 'clusters'].forEach(layerName => {
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
            {source: source, sourceLayer: this.sourceLayer, id: hoveredIds[layerName]},
            {hover: false}
          );
        }

        // Set new hover
        hoveredIds[layerName] = featureId;
        this.map.setFeatureState(
          {source: source, sourceLayer: this.sourceLayer, id: hoveredIds[layerName]},
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
            {source: source, sourceLayer: this.sourceLayer, id: hoveredIds[layerName]},
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

  // Feature popup helper
  createPopup(feature/*, featureType*/) {
    const props = feature.properties;
    // const icon = getAssetPath('route-closures-icon.svg');

    let data = props.data;
    try {
      data = JSON.parse(props.data);
    } catch (e) {
      console.warn(e);
    }
    console.log('[DEBUG] Parsed data:', data);

    const name = data['Mapping']?.['tirol.mapservices.eu']?.['name'];

    const lang = this.languageService.currentLanguage;
    const description = data['Mapping']?.['tirol.mapservices.eu']?.[`publicDescription.${lang}`]
      || data['Mapping']?.['tirol.mapservices.eu']?.['publicDescription.en']
      || data['Mapping']?.['tirol.mapservices.eu']?.['description']
      || data['Mapping.tirol.mapservices.eu.description'];

    return `<div class="noi-map-layer-announcements-popup" part="popup">
    <div class="popup__header">
      <noi-icon class="popup__header-icon" name="route-closures" alt="icon"></noi-icon>
      <div>${this.languageService.translate('map.cycling-roads')}</div>
    </div>`

      + (name
        ? `<div class="popup__name">${name}</div>`
        : '')

      + (description
        ? `<div class="popup__description">${sanitizeText(description)}</div>`
        : '')

      + (data['StartTime']
        ? `<div class="popup__section">
          <div class="popup__section-name">${this.languageService.translate('route-closures.start-time')}</div>
          <div class="popup__section-value">${data['StartTime']}</div>
        </div>`
        : '')

      + (data['EndTime']
        ? `<div class="popup__section">
          <div class="popup__section-name">${this.languageService.translate('route-closures.end-time')}</div>
          <div class="popup__section-value">${data['EndTime']}</div>
        </div>`
        : '')
      + `
  </div>`;
  }

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


function sanitizeText(innerHtml: string) {
  // 1. Create a temporary element (not a text node)
  const tempElement = document.createElement('div');

// 2. Insert your HTML string
  tempElement.innerHTML = innerHtml;

// 3. Extract clean text with no styles or tags
  const cleanText = tempElement.textContent || "";
  return cleanText;
}
