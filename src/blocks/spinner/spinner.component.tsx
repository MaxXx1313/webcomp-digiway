// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, h } from "@stencil/core";

/**
 * (INTERNAL) render a apinner.
 *
 * Icons are embedded inside the component (so far).
 *
 * Icon size can be changed by 'font-size' style
 */
@Component({
  tag: 'noi-spinner',
  styleUrl: 'spinner.css',
  shadow: true,
})
export class SpinnerComponent {

  render() {
    return (<div class="ispinner">
        <div class="ispinner-blade"></div>
        <div class="ispinner-blade"></div>
        <div class="ispinner-blade"></div>
        <div class="ispinner-blade"></div>
        <div class="ispinner-blade"></div>
        <div class="ispinner-blade"></div>
        <div class="ispinner-blade"></div>
        <div class="ispinner-blade"></div>
      </div>);
  }
}
