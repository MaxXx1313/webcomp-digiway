// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Event, EventEmitter, h, Prop } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { LayerConfig } from "../map-layer-base-odh/noi-map-layer-base-odh.component";


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

  // private languageService = LanguageDataService.getInstance();

  private config: { [key: string]: LayerConfig } = {
    'tyrol': {
      sourceLayer: "spatialdata",
      additional: '?source=dservices3.arcgis.com&tagfilter=radrouten_tirol',
      // additional: '?source=dservices3.arcgis.com&tagfilter=radrouten_tirol&operationmode=pointsandtracks', // TODO: calrify
      center: [11.06, 47.27],
      zoom: 10
    },
    'bolzano-prov': {
      sourceLayer: "spatialdata",
      additional: '?source=civis.geoserver&tagfilter=cyclewaystyrol&operationmode=pointsandtracks',
      center: [10.98, 46.88],
      zoom: 10
    },
    'bolzano-int': {
      sourceLayer: "spatialdata",
      additional: '?source=civis.geoserver&tagfilter=intermunicipalcyclingroutes&operationmode=pointsandtracks&displaytracksonzoomlevel=10',
      center: [11.35, 46.5],
      zoom: 10
    },
    'trento': {
      sourceLayer: "spatialdata",
      additional: '?source=siat.provincia.tn.it&tagfilter=elementi_cicloviari_v&operationmode=pointsandtracks',
      center: [11.12, 46.07],
      zoom: 10
    },


    'mountainbikeroutes': {
      sourceLayer: "spatialdata",
      additional: '?source=civis.geoserver&tagfilter=mountainbikeroutes&operationmode=pointsandtracks&displaytracksonzoomlevel=10',
      center: [11.35, 46.5],
      zoom: 10
    },
    'mtb_percorsi_v': {
      sourceLayer: "spatialdata",
      additional: '?source=siat.provincia.tn.it&tagfilter=mtb_percorsi_v&operationmode=pointsandtracks',
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
                                    onLayerLoading={(e) => this.layerLoading.emit(e.detail)}
    ></noi-map-layer-base-odh>)
  }

}

