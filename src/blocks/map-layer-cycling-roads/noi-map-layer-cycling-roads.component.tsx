// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Event, EventEmitter, h } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { LanguageDataService } from "../../data/language/language-data-service";
import { sanitizeText } from "../../utils/html";


const additional = '?source=dservices3.arcgis.com&tagfilter=radrouten_tirol';

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


  private languageService = LanguageDataService.getInstance();

  constructor() {
  }

  render(): any {
    return (<noi-map-layer-base-odh sourceLayer="spatialdata"
                                    additional={additional}
                                    onLayerLoading={(e) => this.layerLoading.emit(e.detail)}
    ></noi-map-layer-base-odh>)
  }

  /**
   *
   */
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

