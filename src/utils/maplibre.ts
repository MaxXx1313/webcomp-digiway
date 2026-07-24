// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Map, Subscription } from "maplibre-gl";

/**
 *
 */
export function listenLayerReady(map: Map, sourceId: string, cb: () => void): Subscription {
  const _loadEvent = map.on('sourcedata', (e) => {
    if (
      e.sourceId === sourceId
      && e.sourceDataType !== 'metadata'
      && map.isSourceLoaded(sourceId)
    ) {
      console.log(`🎉 Layer loaded: ${sourceId}`);
      _loadEvent.unsubscribe();
      cb();
    }
  });
  return _loadEvent;
}

/**
 *
 */
export function enableHoverEffect(map: Map, hoverLayerId: string | string[], hoverFeatureState = 'hover') {

  const hoveredIds: { [layerName: string]: string | null } = {};
  const _subscriptions: Subscription[] = [];

  // Hover effects
  const hoverTargets: string[] = Array.isArray(hoverLayerId) ? hoverLayerId : [hoverLayerId];

  for (const layerName of hoverTargets) {

    const layerDef = map.getLayer(layerName);
    if (!layerDef) {
      throw new Error('enableHoverEffect: layer not found:' + layerName);
      ///////
    }

    //
    const _layerEnter = map.on('mouseenter', layerName, (e) => {
      map.getCanvas().style.cursor = 'pointer';

      const featureId = e.features![0]?.id as string;
      // console.log('mouseenter', featureId, e);

      if (featureId == null) {
        // guard
        console.warn('enableHoverEffect: no featureId:' + e.features);
        return;
      }

      // Clear previous hover on this layer
      if (hoveredIds[layerName]) {
        map.setFeatureState(
          {source: layerDef.source, sourceLayer: layerDef.sourceLayer, id: hoveredIds[layerName]},
          {[hoverFeatureState]: false},
          // {hover: false},
        );
      }

      // Set new hover
      hoveredIds[layerName] = featureId;
      map.setFeatureState(
        {source: layerDef.source, sourceLayer: layerDef.sourceLayer, id: hoveredIds[layerName]},
        {[hoverFeatureState]: true},
      );
    });
    _subscriptions.push(_layerEnter);

    //
    const _layerLeave = map.on('mouseleave', layerName, () => {
      map.getCanvas().style.cursor = '';

      // Clear hover on this layer
      if (hoveredIds[layerName]) {
        map.setFeatureState(
          {source: layerDef.source, sourceLayer: layerDef.sourceLayer, id: hoveredIds[layerName]},
          {[hoverFeatureState]: false},
        );
        hoveredIds[layerName] = null;
      }
    });
    _subscriptions.push(_layerLeave);
  }

  return {
    unsubscribe: () => {
      for (const subscription of _subscriptions) {
        subscription.unsubscribe();
      }
    },
  } as Subscription;
}

/**
 */
export interface FontIconPaintParams {
  'icon-text': string,
  'icon-font': string,
  'icon-size': number, // in px
  'icon-color': string,
  // 'scale'?: number,
}

/**
 */
export function getFontIconData(paint: FontIconPaintParams) {
  const iconSize = paint["icon-size"];
  // Layout target boundaries
  const scale = 1; // 4x multiplier ensures sharp sub-pixel anti-aliasing

  // Create an offscreen rendering surface
  const canvas = document.createElement('canvas');
  canvas.width = iconSize * scale;
  canvas.height = iconSize * scale;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // FORCE CRITICAL BROWSER ANTI-ALIASING ENGINE HINTS
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear background canvas space completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply scaling and text rendering layout details
    ctx.font = `${iconSize * scale}px "${paint["icon-font"]}"`;
    ctx.fillStyle = paint["icon-color"];  // '#FFFFFF'; // Target paint color
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Render the exact hex string character ('\ue0c8' = Material Pin Marker)
    ctx.fillText(paint["icon-text"], canvas.width / 2, canvas.height / 2);

    // 4. FIX: Safely extract ImageData from the canvas.
    // This bypasses type errors and ensures MapLibre gets pure pixel data.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    return imageData as ImageData;
  } else {
    return null
  }
}

/**
 *
 */
export async function loadIconFont(fontName: string, url: string) {

  // TypeScript's internal DOM type definitions have a historical gap regarding the FontFaceSet interface, so we use 'any'
  const documentFonts = document.fonts as any;

  // 1. Check if another instance of your icon component already registered this font
  const isAlreadyLoaded = Array.from(documentFonts.values()).some(
    (font: any) => font.family === fontName
  );

  if (isAlreadyLoaded) {
    console.debug(`[loadIconFont] - already loaded:`, fontName);
    return;
  }

  console.log(`[loadIconFont] loading font:`, fontName);

  // 2. Instantiate and load the font directly into memory
  const iconFontFace = new FontFace(fontName, url);

  const fontLoadResult = await iconFontFace.load();
  console.debug(`[loadIconFont] loaded:`, fontName, fontLoadResult);

  // Inject it into document.fonts so the entire page (and all shadow roots) can use it
  documentFonts.add(iconFontFace);
}
