<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: CC0-1.0
-->
# noi-map-layer-weather



<!-- Auto Generated Below -->


## Overview

(INTERNAL) render map layer

## Properties

| Property   | Attribute | Description                | Type   | Default     |
| ---------- | --------- | -------------------------- | ------ | ----------- |
| `viewDate` | --        | View date for weather data | `Date` | `undefined` |


## Events

| Event          | Description                        | Type                   |
| -------------- | ---------------------------------- | ---------------------- |
| `layerLoading` | Emitted when layer data is loading | `CustomEvent<boolean>` |


## Dependencies

### Used by

 - [noi-digiway](../../public-components/digiway)

### Depends on

- [noi-map-layer-weather-popup](../map-layer-weather-popup)

### Graph
```mermaid
graph TD;
  noi-map-layer-weather --> noi-map-layer-weather-popup
  noi-map-layer-weather-popup --> noi-icon
  noi-map-layer-weather-popup --> noi-button
  noi-map-layer-weather-popup --> noi-spinner
  noi-digiway --> noi-map-layer-weather
  style noi-map-layer-weather fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
