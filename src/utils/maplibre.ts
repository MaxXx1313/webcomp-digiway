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
