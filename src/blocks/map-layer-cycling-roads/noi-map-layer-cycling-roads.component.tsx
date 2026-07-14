// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Event, EventEmitter, h, Prop } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { LayerConfig, PopupDefinition } from "../map-layer-base-odh/noi-map-layer-base-odh.component";

const _icons = {
  'bicycle': `
<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8 2C8.55222 2.00007 9 2.44776 9 3C9 3.55224 8.55222 3.99993 8 4H6.2207L5.55371 6H14.2041L10.7041 10H11.3369C11.8987 8.81755 13.1038 8 14.5 8C16.433 8 18 9.567 18 11.5C18 13.433 16.433 15 14.5 15C12.7368 15 11.2788 13.6961 11.0361 12H6.96387C6.72121 13.6961 5.2632 15 3.5 15C1.567 15 0 13.433 0 11.5C0 9.82374 1.17838 8.42268 2.75195 8.08008L4.7793 2H8ZM3.5 10C2.67157 10 2 10.6716 2 11.5C2 12.3284 2.67157 13 3.5 13C4.32843 13 5 12.3284 5 11.5C5 10.6716 4.32843 10 3.5 10ZM14.5 10C13.6716 10 13 10.6716 13 11.5C13 12.3284 13.6716 13 14.5 13C15.3284 13 16 12.3284 16 11.5C16 10.6716 15.3284 10 14.5 10ZM4.80273 8.25098C5.62103 8.57938 6.28662 9.20754 6.66309 10H8.0459L9.7959 8H4.88672L4.80273 8.25098Z" fill="#000"/>
</svg>
`,
  'mountain': `
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M17.251 15H1L6.64941 4.4082L7.93555 6.72559L10.6885 1.21973L17.251 15ZM9.1123 8.84375L10.041 10.5146L8.29297 11.4854L6.68457 8.59082L4.33398 13H14.083L10.6445 5.78027L9.1123 8.84375Z" fill="#000"/>
</svg>
`,
}

/**
 * (INTERNAL) render map layer
 */
@Component({
  tag: 'noi-map-layer-cycling-roads',
  styleUrl: 'noi-map-layer-cycling-roads.css',
  shadow: false,
})
export class NoiMapLayerCyclingRoadsComponent implements StencilComponent {

  /**
   * Emitted when layer data is loading
   */
  @Event() layerLoading: EventEmitter<boolean>;

  /**
   */
  @Prop({mutable: false})
  region!: 'tyrol' | 'bolzano-prov' | 'bolzano-int' | 'trento' | 'mountainbikeroutes' | 'mtb_percorsi_v';


  /**
   */
  @Prop({mutable: false})
  titleText?: string;
  /**
   */
  @Prop({mutable: false})
  titleIcon?: string;

  // private languageService = LanguageDataService.getInstance();

  private config: { [key: string]: LayerConfig } = {
    'tyrol': {
      markerIconSVG: _icons['bicycle'],
      isLineInteractive: true,

      sourceLayer: "spatialdata",
      additional: '?source=dservices3.arcgis.com&tagfilter=radrouten_tirol&operationmode=pointsandtracks&displaytracksonzoomlevel=10',
      center: [11.06, 47.27],
      zoom: 10
    },
    'bolzano-prov': {
      markerIconSVG: _icons['bicycle'],
      isLineInteractive: true,

      sourceLayer: "spatialdata",
      additional: '?source=civis.geoserver&tagfilter=cyclewaystyrol&operationmode=pointsandtracks&displaytracksonzoomlevel=10',
      center: [10.98, 46.88],
      zoom: 10
    },
    'bolzano-int': {
      markerIconSVG: _icons['bicycle'],
      isLineInteractive: true,

      sourceLayer: "spatialdata",
      additional: '?source=civis.geoserver&tagfilter=intermunicipalcyclingroutes&operationmode=pointsandtracks&displaytracksonzoomlevel=10',
      center: [11.35, 46.5],
      zoom: 10
    },
    'trento': {
      markerIconSVG: _icons['bicycle'],
      isLineInteractive: true,

      sourceLayer: "spatialdata",
      additional: '?source=siat.provincia.tn.it&tagfilter=elementi_cicloviari_v&operationmode=pointsandtracks&displaytracksonzoomlevel=10',
      center: [11.12, 46.07],
      zoom: 10
    },


    'mountainbikeroutes': {
      markerIconSVG: _icons['mountain'],
      isLineInteractive: true,

      sourceLayer: "spatialdata",
      additional: '?source=civis.geoserver&tagfilter=mountainbikeroutes&operationmode=pointsandtracks&displaytracksonzoomlevel=10',
      center: [11.35, 46.5],
      zoom: 10
    },
    'mtb_percorsi_v': {
      markerIconSVG: _icons['mountain'],
      isLineInteractive: true,

      sourceLayer: "spatialdata",
      additional: '?source=siat.provincia.tn.it&tagfilter=mtb_percorsi_v&operationmode=pointsandtracks&displaytracksonzoomlevel=10',
      center: [11.12, 46.07],
      zoom: 10
    },
  }

  private regionConfig!: LayerConfig;

  connectedCallback() {
    this.regionConfig = this.config[this.region];
  }

  render(): any {
    return (<noi-map-layer-base-odh config={this.regionConfig}
                                    popupStructure={this.createPopup.bind(this)}
                                    onLayerLoading={(e) => this.layerLoading.emit(e.detail)}
    ></noi-map-layer-base-odh>)
  }


  // Feature popup helper
  createPopup(feature/*, featureType*/): PopupDefinition | string {

    const description = feature.properties.data;

    return {
      title: {
        icon: this.titleIcon,
        text: this.titleText,
      },
      body: [
        {type: 'name', text: description},
      ],
    };

  }

}

