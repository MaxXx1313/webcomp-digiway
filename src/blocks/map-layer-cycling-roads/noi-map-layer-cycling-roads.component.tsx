// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Event, EventEmitter, h } from "@stencil/core";
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


  // private languageService = LanguageDataService.getInstance();

  private config: LayerConfig = {
    sourceLayer: "spatialdata",
    additional: '?source=dservices3.arcgis.com&tagfilter=radrouten_tirol',
  }

  constructor() {
  }

  render(): any {
    return (<noi-map-layer-base-odh config={this.config}
                                    onLayerLoading={(e) => this.layerLoading.emit(e.detail)}
    ></noi-map-layer-base-odh>)
  }

}

