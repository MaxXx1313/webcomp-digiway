// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Event, EventEmitter, h } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { LanguageDataService } from "../../data/language/language-data-service";
import { LayerConfig, PopupDefinition } from "../map-layer-base-odh/noi-map-layer-base-odh.component";


/**
 * (INTERNAL) render map layer
 */
@Component({
  tag: 'noi-map-layer-announcements',
  styleUrl: 'noi-map-layer-announcements.css',
  shadow: false,
})
export class NoiMapLayerAnnouncementsComponent implements StencilComponent {


  /**
   * Emitted when layer data is loading
   */
  @Event() layerLoading: EventEmitter<boolean>;


  private languageService = LanguageDataService.getInstance();

  private config: LayerConfig = {
    markerIcon: 'closure',
    sourceLayer: "announcement",
    // additional: '?source=tirol.mapservices.eu&operationmode=pointsandtracks&displaytracksonzoomlevel=10&jsonselector=StartTime,EndTime,Mapping[\'tirol.mapservices.eu\'].description';
    additional: '?source=tirol.mapservices.eu&operationmode=pointsandtracks&displaytracksonzoomlevel=10&jsonselector=StartTime,EndTime,Mapping',
    center: [11.3, 46.9],
    zoom: 9
  }

  constructor() {
  }

  render(): any {
    return (<noi-map-layer-base-odh config={this.config}
                                    popupStructure={this.createPopup.bind(this)}
                                    onLayerLoading={(e) => this.layerLoading.emit(e.detail)}
    ></noi-map-layer-base-odh>)
  }

  ///////////////


  // Feature popup helper
  createPopup(feature/*, featureType*/): PopupDefinition {
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

    return {
      title: {
        icon: 'pointer-off',
        text: this.languageService.translate('map.layer.route-closures'),
      },
      body: [
        {type: 'name', text: name},
        {type: 'description', text: description},
        {
          type: 'section',
          section: {
            name: this.languageService.translate('route-closures.start-time'),
            value: data['StartTime'],
          },
        },
        {
          type: 'section',
          section: {
            name: this.languageService.translate('route-closures.end-time'),
            value: data['EndTime'],
          },
        },
      ],
    };

  }

}
