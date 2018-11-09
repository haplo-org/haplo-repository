/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.CanViewApplication = O.action("hresrepodemo_access_request:view_application").
    title("View Access Request").
    allow("group", Group.RepositoryEditors).
    allow("group", Group.DataPreparers);
