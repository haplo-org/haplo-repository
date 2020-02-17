/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*HaploDoc
node: /repository/hres_repo_publication_common/replaceable-templates
title: Replaceable templates
sort: 1
--

These allow you to replace the HSVT for a template in your client code, but still use common features \
for functionality. The common functionality will pass a JS view object into your template, which must \
accept the same view varibles and have the same blocks as the template you're replacing.

h3. Primary button link

The template for primary buttons within the publication.

|Blocks|(anonymous block) -- contents of button |
| View | href -- link for button |


h4. Example

<pre>
std:web-publisher:template("hres:repository:common:ui:button:primary")
   { "File access - " title }
</pre>
*/
P.webPublication.registerReplaceableTemplate(
    "hres:repository:common:ui:button:primary",
    "replaceable/ui/button-primary"
);


/*HaploDoc
node: /repository/hres_repo_publication_common/replaceable-templates
sort: 2
--

h3. Secondary button link

|Blocks|(anonymous block) -- contents of button|
|View|href -- link for button|


h4. Example

<pre>
std:web-publisher:template("hres:repository:common:ui:button:secondary")
  { "File access - " title }
</pre>
*/
P.webPublication.registerReplaceableTemplate(
    "hres:repository:common:ui:button:secondary",
    "replaceable/ui/button-secondary"
);

/*HaploDoc
node: /repository/hres_repo_publication_common/replaceable-templates
sort: 4
--

h3. Generic panel

|Blocks|(anonymous block) -- contents of panel|
||heading -- heading of panel|


h4. Example

<pre>
std:web-publisher:template("hres:repository:common:ui:panel")
  { "Panel contents" }
  heading { "Panel heading" }
</pre>
*/
P.webPublication.registerReplaceableTemplate(
    "hres:repository:common:ui:panel",
    "replaceable/ui/panel"
);

