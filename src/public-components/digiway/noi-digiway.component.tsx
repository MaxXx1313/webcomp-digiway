// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, Element, forceUpdate, h, Host, Prop, State, Watch } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";
import { getLayoutClass, resolveLayoutAuto, ViewLayout } from "../../utils/breakpoints";
import { SelectOption } from "../../blocks/select/select.component";
import { LanguageDataService } from "../../data/language/language-data-service";
import { getAssetPath } from "../../utils/asset-path";


interface DataLayerOption extends SelectOption {
  forceGrayscale: boolean;
}

type MapSourceOption = SelectOption;

/**
 * @internal
 */
type BaseMapType = 'tirol' | 'osm';

/**
 * Consolidated web-component to show Open Data Hub data imported within the Digiway project
 *
 * @part sidebar - Sidebar
 * @part map - Map
 * @part legend-container - Legend container
 * @part legend - Legend
 * @part popup - Map popup dialog
 */
@Component({
  tag: 'noi-digiway',
  styleUrl: 'noi-digiway.css',
  shadow: true,
})
export class NoiDigiwayComponent implements StencilComponent {

  /**
   * Layout appearance
   */
  @Prop({mutable: true})
  layout: ViewLayout = 'auto';

  /**
   * Base map layer
   */
  @Prop({mutable: true})
  baseMap: 'osm' | 'tirol' = 'tirol';

  /**
   * Pass latitude, longitude and zoomlevel separated by "," if map should be centered an a specific gps point
   */
  @Prop({mutable: true})
  centermap: string;

  /**
   * Language
   * @default 'en'
   */
  @Prop({mutable: true})
  language = 'en';

  @State()
  layoutResolved: ViewLayout;

  @Element()
  el: HTMLElement;

  @State()
  isMenuOpened = false;

  private modes: MapSourceOption[] = [
    {value: 'tirol', text: 'map.base.tirol'},
    {value: 'osm', text: 'map.base.osm'},
  ];
  private modesTranslated: MapSourceOption[] = [];
  // private subModes: SelectOption[] = [
  //   {value: 'tyrol', text: 'Tyrol', icon: 'bicycle'},
  //   {value: 'osm', text: 'Open Street Map', icon: 'hiking'},
  //   {value: 'hk-mt', text: 'Mountain Trails', icon: 'hiking'},
  // ];


  private dataLayers: DataLayerOption[] = [
    {value: 'layer-closures', text: 'map.layer.route-closures', icon: 'pointer-off', forceGrayscale: false},
    {value: 'layer-exposure', text: 'map.layer.risk-exposure', icon: 'context', forceGrayscale: true},
    // {value: 'layer-poi', text: 'map.layer-poi', icon: 'group'},
  ];

  private poiDataLayers: DataLayerOption[] = [
    {value: 'layer-poi-culture', text: 'map.layer.poi-culture', forceGrayscale: false},
    {value: 'layer-poi-services', text: 'map.layer.poi-services', forceGrayscale: false},
    {value: 'layer-poi-summer', text: 'map.layer.poi-summer', forceGrayscale: false},
    {value: 'layer-poi-winter', text: 'map.layer.poi-winter', forceGrayscale: false},
    {value: 'layer-poi-wellness', text: 'map.layer.poi-wellness', forceGrayscale: false},
    {value: 'layer-poi-other', text: 'map.layer.poi-other', forceGrayscale: false},
  ];

  // private contentLayers: SelectOption[] = [
  //   {value: 'layer-3', text: 'Context Data', icon: 'context'},
  //   {value: 'layer-4', text: 'Weather predictions', icon: 'weather-alert'},
  //   {value: 'layer-5', text: 'Real-time weather data', icon: 'weather-time'},
  //   {value: 'layer-6', text: 'Points of interest', icon: 'pointer-alert'},
  //   {value: 'layer-7', text: 'Gastronomy locations', icon: 'fork-spoon'},
  // ];

  @State()
  mapMode: MapSourceOption = this.modes[0];

  @State()
  layersActive = [];

  @State()
  layersLoading = [];

  private _isGrayscaleMap = false;

  private sizeObserver: ResizeObserver = null;
  readonly languageService = LanguageDataService.getInstance();

  @Watch('layout')
  _layoutChanged() {
    this.layoutResolved = resolveLayoutAuto(this.el.offsetWidth, this.layout);
  }

  @Watch('baseMap')
  _baseMapChanged() {
    this.setBaseMap(this.baseMap);
  }

  @Watch('language')
  onLanguageChanged() {
    this.languageService.useLanguage(this.language)
      .then(this._onLanguageChanged.bind(this));
  }

  _onLanguageChanged() {
    this.modesTranslated = this.modes.map(m => ({...m, text: this.languageService.translate(m.text)}));
    forceUpdate(this.el)
  }

  _watchSize() {
    if (typeof window.ResizeObserver === 'function') {
      this.sizeObserver = new ResizeObserver(() => {
        this._layoutChanged();
      });
      this.sizeObserver.observe(this.el);
    } else {
      console.warn('ResizeObserver is not supported');
    }
  }

  _unwatchSize() {
    if (this.sizeObserver) {
      this.sizeObserver.unobserve(this.el);
      this.sizeObserver = null;
    }
  }

  connectedCallback() {
    this._layoutChanged();
    this._baseMapChanged();
    this.onLanguageChanged();
    this._watchSize();
  }

  disconnectedCallback() {
    this._unwatchSize();
  }

  _toggleMenu() {
    this.isMenuOpened = !this.isMenuOpened;
  }

  async setBaseMap(baseMapId: BaseMapType) {
    console.log('[noi-digiway] setBaseMap', baseMapId);
    this.mapMode = this.modes.find(m => m.value === baseMapId) || this.modes[0];
  }


  activateLayer(layer: string, isActive: boolean) {
    if (isActive) {
      if (!this.layersActive.includes(layer)) {
        this.layersActive.push(layer);
        this.layersActive = [...this.layersActive];

        // also set loading here to avoid blink
        this._setLayerLoading(layer, true);
      }
    } else {
      this.layersActive = this.layersActive.filter(l => l !== layer);

      // also clear loading state in case it's still loading
      this._setLayerLoading(layer, false);
    }

    // recalculate _isGrayscaleMap
    this._isGrayscaleMap = this.layersActive.find(l => !!this.dataLayers.find(dl => dl.value === l)?.forceGrayscale);
  }

  _setLayerLoading(layer: string, isLoading: boolean) {
    if (isLoading) {
      this.layersLoading.push(layer);
      this.layersLoading = [...this.layersLoading];
    } else {
      this.layersLoading = this.layersLoading.filter(l => l !== layer);
    }
  }

  render() {
    return (
      <Host class={getLayoutClass(this.layoutResolved)}>
        <div class="sidebar-collapsed">
          <div class="menu-button-wrapper">
            <button class="menu-button" onClick={() => this._toggleMenu()}>
              <noi-icon name="menu"></noi-icon>
            </button>
          </div>
        </div>
        {this._renderSidebar()}
        <noi-map part="map" centermap={this.centermap}>
          {this.mapMode.value === 'osm'
            ? <noi-map-base-osm variant={this._isGrayscaleMap ? 'grayscale' : 'color'}></noi-map-base-osm>
            : <noi-map-base-tirol variant={this._isGrayscaleMap ? 'grayscale' : 'color'}></noi-map-base-tirol>
          }

          {this.layersActive.includes('layer-exposure')
            ? <noi-map-layer-risk-exposure
              onLayerLoading={(e) => this._setLayerLoading('layer-exposure', e.detail)}></noi-map-layer-risk-exposure>
            : ''}
          {this.layersActive.includes('layer-closures')
            ? <noi-map-layer-announcements
              onLayerLoading={(e) => this._setLayerLoading('layer-closures', e.detail)}></noi-map-layer-announcements>
            : ''}
          {this.layersActive.includes('layer-poi')
            ? <noi-map-layer-cycling-roads
              onLayerLoading={(e) => this._setLayerLoading('layer-poi', e.detail)}></noi-map-layer-cycling-roads>
            : ''}
        </noi-map>
        {this._renderLegend()}
        <div class={this.isMenuOpened ? "sidebar-backdrop open" : "sidebar-backdrop"}
             onClick={() => this._toggleMenu()}></div>
      </Host>
    );
  }


  _renderSidebar() {
    const logoSrc = getAssetPath('logo.svg');
    return (
      <div part="sidebar" class={this.isMenuOpened ? "sidebar open" : "sidebar"}>
        {this.layoutResolved === 'desktop'
          ? ''
          : (<div class="menu-button-wrapper">
            <button class="menu-button" onClick={() => this._toggleMenu()}>
              <noi-icon name="close"></noi-icon>
            </button>
          </div>)
        }
        <div class="menu-content">
          <img class="logo" src={logoSrc} alt="logo"/>

          <div class="menu-section-header p-bottom">
            <noi-icon name="layers"></noi-icon>
            <span>{this.languageService.translate('sidebar.base-map')}</span>
          </div>

          <noi-select class="p-bottom-small"
                      options={this.modesTranslated}
                      value={this.mapMode?.value}
                      onSelectChange={event => this.setBaseMap(event.detail as BaseMapType)}></noi-select>
          {/*<noi-select class="p-bottom-small" options={this.subModes}></noi-select>*/}

          <div class="menu-section-header p-top p-bottom">
            <noi-icon name="layers-child"></noi-icon>
            <span>{this.languageService.translate('sidebar.data-layers')}</span>
          </div>

          {this.dataLayers.map(layer =>
            <noi-checkbox class="p-bottom-small"
                          loading={this.layersLoading.includes(layer.value)}
                          checked={this.layersActive.includes(layer.value)}
                          onCheckedChange={(event) => this.activateLayer(layer.value, event.detail.checked)}>
              <div class="checkbox-content">
                <noi-icon name={layer.icon}></noi-icon>
                <span>{this.languageService.translate(layer.text)}</span>
              </div>
            </noi-checkbox>
          )}

          <noi-checkbox-group class="p-bottom-small" open={this.layersActive.includes('layer-poi')}>
            <noi-checkbox slot="main"
                          checked={this.layersActive.includes('layer-poi')}
                          onCheckedChange={(event) => this.activateLayer('layer-poi', event.detail.checked)}>
              <div class="checkbox-content">
                <noi-icon name="pointer-alert"></noi-icon>
                <span>{this.languageService.translate('map.layer.poi')}</span>
              </div>
            </noi-checkbox>

            {this.poiDataLayers.map(layer =>
              <noi-checkbox loading={this.layersLoading.includes(layer.value)}
                            checked={this.layersActive.includes(layer.value)}
                            onCheckedChange={(event) => this.activateLayer(layer.value, event.detail.checked)}>
                <div class="checkbox-content">
                  <span>{this.languageService.translate(layer.text)}</span>
                </div>
              </noi-checkbox>
            )}
          </noi-checkbox-group>

          {/*
          <div class="menu-section-header p-top p-bottom">
            <div class="checkbox-content">
              <noi-icon name="context"></noi-icon>
              <span>Context Data</span>
            </div>
          </div>


          {this.contentLayers.map(layer =>
            <noi-checkbox class="p-bottom-small">
              <div class="checkbox-content">
                <noi-icon name={layer.icon}></noi-icon>
                <span>{layer.text}</span>
              </div>
            </noi-checkbox>
          )}
          */}

          <div class="spacer"></div>

          {/*
          {this._renderWeather()}
          */}
        </div>
      </div>
    )
  }

  // _renderWeather() {
  //   return (<div class="weather">
  //     <img class="weather__icon" src="weather.png" alt="weather icon"/>
  //     <div class="weather__temperature">17°C</div>
  //     <div class="weather__content">
  //       <div class="weather__location">Bolzano - Bozen</div>
  //       <div class="weather__humidity">Humidity 58%</div>
  //     </div>
  //   </div>);
  // }

  _renderLegend() {
    const legendArr = [];
    // legendArr.push(this._renderLegend_debug());

    for (const layer of this.layersActive) {
      switch (layer) {
        case 'layer-closures':
          // no legend
          break;
        case 'layer-exposure':
          legendArr.push(this._renderLegend_riskExposure());
          break;
      }
    }
    return (<div class="legend-container" part="legend-container">{legendArr}</div>)
  }

  _renderLegend_debug() {
    return (<div class="legend">
      <div class="legend__item legend__item--debug">mapMode: {this.mapMode?.value}</div>
      <div class="legend__item legend__item--debug">layout: {this.layoutResolved}</div>
    </div>);
  }

  _renderLegend_riskExposure() {
    return (<div class="legend" part="legend">
      <div class="legend__icon" title={this.languageService.translate('map.risk-exposure')}>
        <noi-icon name="context"></noi-icon>
      </div>
      <div class="legend__item risk-level risk-level--low">
        <span>{this.languageService.translate('risk-exposure.low')}</span></div>
      <div class="legend__item risk-level risk-level--medium">
        <span>{this.languageService.translate('risk-exposure.medium')}</span></div>
      <div class="legend__item risk-level risk-level--high">
        <span>{this.languageService.translate('risk-exposure.high')}</span></div>
      <div class="legend__item risk-level risk-level--veryhigh">
        <span>{this.languageService.translate('risk-exposure.veryhigh')}</span></div>
      <div class="legend__item risk-level risk-level--extreme">
        <span>{this.languageService.translate('risk-exposure.extreme')}</span></div>
    </div>);
  }
}
