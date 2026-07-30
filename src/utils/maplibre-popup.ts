// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later


import { MapGeoJSONFeature } from "maplibre-gl";
import { sanitizeText } from "./html";

export type PopupDefinitionFn = ((feature: MapGeoJSONFeature, featureType: string) => PopupDefinition | string);

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


// Feature popup helper
export function createPopupBodyHTML(popupStructure: PopupDefinitionFn | null | undefined, feature: MapGeoJSONFeature, featureType: string) {
  const fn = popupStructure || debugPopupStructure;
  const structure = fn(feature, featureType);
  if (typeof structure === 'string') {
    return structure;
  } else {
    return _popupBuilder(structure);
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
