/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.CanViewRequest = O.action("hresrepodemo_request_a_copy:view_request").
    title("View Request a Copy").
    allow("group", Group.RepositoryEditors);
