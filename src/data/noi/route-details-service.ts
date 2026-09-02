// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildUrl } from "../../utils/url";
import { AbortHandler } from "./fetch.util";
import { RouteDetails } from "./route-details";

// origin is used to track usage and traffic patterns
const ORIGIN = 'webcomp-brennerlec';

export class RouteDetailsService {


  /**
   */
  getDetails(pointId: string, cb: (err: Error | null, data?: RouteDetails) => void): AbortHandler {

    const controller = new AbortController();
    const signal = controller.signal;

    // id: "urn:siat.provincia.tn.it:elementi_cicloviari_v:via001_23"
    fetch(buildUrl(`https://tourism.api.opendatahub.com/v1/SpatialData/${pointId}`, {
      origin: ORIGIN,
      limit: -1,
    }), {signal})
      .then(response => response.json() as Promise<RouteDetails>)
      .then(data => {
        cb(null, data);
      })
      .catch(err => {
        console.error(err);
        cb(err);
      });

    return controller;
  }


}
