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
