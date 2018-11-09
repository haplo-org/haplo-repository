/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */



// Primary button link
//
// Blocks:
//    (anonymous block) -- contents of button
// View:
//    href -- link for button
//
// std:web-publisher:template("hres:repository:common:ui:button:primary")
//   { "File access - " title }
// with href in view
//
P.webPublication.registerReplaceableTemplate(
    "hres:repository:common:ui:button:primary",
    "replaceable/ui/button-primary"
);



// Secondary button link
//
// Blocks:
//    (anonymous block) -- contents of button
// View:
//    href -- link for button
//
// std:web-publisher:template("hres:repository:common:ui:button:secondary")
//   { "File access - " title }
// with href in view
//
P.webPublication.registerReplaceableTemplate(
    "hres:repository:common:ui:button:secondary",
    "replaceable/ui/button-secondary"
);


// Generic panel
//
// Blocks:
//    (anonymous block) -- contents of panel
//    heading -- heading of panel
//
// std:web-publisher:template("hres:repository:common:ui:panel")
//   { "Panel contents" }
//   heading { "Panel heading" }
//
P.webPublication.registerReplaceableTemplate(
    "hres:repository:common:ui:panel",
    "replaceable/ui/panel"
);

