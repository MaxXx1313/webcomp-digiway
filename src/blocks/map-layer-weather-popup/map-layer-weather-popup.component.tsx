// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, h, Host, Prop } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { MapGeoJSONFeature } from "maplibre-gl";
import { WeatherForecast } from "../../data/noi/WeatherForecase";


/**
 * (INTERNAL) render map popup
 */
@Component({
  tag: 'noi-map-layer-weather-popup',
  styleUrl: 'map-layer-weather-popup.css',
  shadow: false,
})
export class MapLayerWeatherPopupComponent implements StencilComponent {

  @Prop()
  feature?: MapGeoJSONFeature;

  /**
   */
  async connectedCallback() {

  }

  disconnectedCallback() {

  }

  render() {
    // const data = JSON.parse(this.feature.properties?.data) as WeatherForecast;
    //
    // const iconName = this.feature.properties['icon_name'];
    // const pointDescription = __getDailyMeasurement(data.sdatatypes["qualitative-forecast"]?.tmeasurements || [])?.mvalue;
    // const pointName = data.smetadata.nameEn;

    const pointName  ='AAA';

    // helpers, to make template more clear
    // const t = languageService.translate.bind(languageService);
    // const num = (_num: | number | undefined) => formatNumber(_num, languageService.currentLanguage);


    return (
      <Host>
        <div class="popup__header">
          <noi-icon name="map-point"></noi-icon>
          <div>{pointName}</div>
        </div>
        <div>Hello world</div>
      </Host>
    );
  }
}
