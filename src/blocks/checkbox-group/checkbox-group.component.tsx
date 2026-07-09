// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, h, Host } from "@stencil/core";
import { StencilComponent } from "../../utils/StencilComponent";

/**
 * (INTERNAL) render a checkbox group
 */
@Component({
  tag: 'noi-checkbox-group',
  styleUrl: 'checkbox-group.css',
  shadow: false,
})
export class CheckboxGroupComponent implements StencilComponent {


  render() {

    return <Host>
      <div class="checkbox-group">
        <div class="checkbox-group-main">
          <slot name="main"/>
        </div>
        <div class="checkbox-group-inner">
          <slot/>
        </div>
      </div>
    </Host>;
  }
}
