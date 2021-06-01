/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var SHERPA_CREDENTIAL_NAME = O.application.config["hres_repo_embargoes:sherpa_api_credential_name"] || "Sherpa API Key";

var interpolatePhrasesFromValues = function(context, field) {
    if(!context) { return; }
    let value = context[field];
    let phrases = context[field+"_phrases"];
    if(!value || !phrases) { return; }
    return _.chain(phrases).
        // Will use i18n for any translations so get English only phrases
        filter((phrase) => phrase.language === "en").
        // Value can be single or a list of values
        filter((phrase) => phrase.value === value || _.contains(value, phrase.value)).
        pluck("phrase").
        value();
};

var doesRuleApplyToHaplo = function(context) {
    let validLocations = ["institutional_repository", "any_repository", "any_website"];
    return _.any(validLocations, (validLocation) => _.contains(context.location.location, validLocation));
};

var interpolateLocations = function(context) {
    if(!context.location) { return; }
    let locations = interpolatePhrasesFromValues(context.location, "location");
    let namedRepositories = context.location.named_repository;
    return _.map(locations, (location) => {
        if(location === "Named Repository") {
            location += " (" + namedRepositories.join(", ") + ")";
        }
        return location;
    });
};

var interpolateEmbargo = function(context) {
    let embargo = context.embargo;
    if(!embargo) { return; }
    return embargo.amount + " " + interpolatePhrasesFromValues(context.embargo, "units")[0];
};

var interpolateLicenses = function(context) {
    if(!context.license) { return; }
    return _.chain(context.license).
        map((license) => interpolatePhrasesFromValues(license, "license")).
        flatten().
        value();
};

// Defaults to English
var findObjectWithCurrentLocaleMaybe = function(list) {
    return _.find(list, (entry) => entry.language === O.currentUser.localeId) ||
        _.find(list, (entry) => entry.language === "en");
};

var interpolatePublisherDeposit = function(context) {
    if(!context.publisher_deposit) { return; }
    return _.map(context.publisher_deposit, (repository) => {
        let metadata = repository.repository_metadata;
        return {
            name: findObjectWithCurrentLocaleMaybe(metadata.name).name,
            url: metadata.url
        };
    });
};

var interpolatePrerequisites = function(context) {
    if(!context.prerequisites) { return; }
    return {
        rules: interpolatePhrasesFromValues(context.prerequisites, "prerequisites"),
        subjects: context.prerequisites.prerequisite_subjects,
        funders: _.map(context.prerequisites.prerequisite_funders || [], (funder) => {
            let metadata = funder.funder_metadata;
            return {
                name: findObjectWithCurrentLocaleMaybe(metadata.name).name,
                url: findObjectWithCurrentLocaleMaybe(metadata.url).url
            };
        })
    };
};

var parseResponse = function(json, results, forVersion) {
    let additionalInformationURLs = [];
    let availableVersions = [];
    _.chain(json.items).
        pluck("publisher_policy").
        first(). // Pluck returns [policies[]] so take first element
        each((policy) => {
            _.each(policy.urls, url => additionalInformationURLs.push(url));
            _.each(policy.permitted_oa, (rule) => {
                // Default to first article version
                if(!forVersion && rule.article_version) { forVersion = rule.article_version[0]; }
                let versions = _.map(rule.article_version || [], (version, i) => {
                    return {
                        code: version,
                        display: interpolatePhrasesFromValues(rule, "article_version")[i] + " version",
                        selected: version === forVersion
                    };
                });
                availableVersions = availableVersions.concat(versions);
                if(!forVersion || _.contains(rule.article_version, forVersion)) {
                    results.policies.push({
                        haploApplicable: doesRuleApplyToHaplo(rule),
                        location: interpolateLocations(rule),
                        embargo: interpolateEmbargo(rule),
                        license: interpolateLicenses(rule),
                        copyrightOwner: interpolatePhrasesFromValues(rule, "copyright_owner"),
                        // Should only have one value for additional_oa_fee
                        additionalFee: _.first(interpolatePhrasesFromValues(rule, "additional_oa_fee")),
                        publisherDeposit: interpolatePublisherDeposit(rule),
                        prerequisites: interpolatePrerequisites(rule),
                        conditions: rule.conditions,
                        notes: rule.public_notes
                    });
                }
            });
        });

    results.availableVersions = _.uniq(availableVersions, (version) => version.code) || [];
    results.additionalInformationURLs = _.uniq(additionalInformationURLs, (url) => url.url);
};

var QUERY_STRING_TO_ATTRIBUTE = {
    "issn": A.Issn,
    "title": A.Journal
};

P.respondAfterHTTPRequest("GET", "/api/hres-repo-embargoes/sherpa-romeo", [
    {pathElement:0, as:"object"},
    {parameter:"done", as:"string", optional:true},
    {parameter:"forVersion", as:"string", optional:true}
], {
    setup(data, E, output, keysDoneStr, forVersion) {
        let keysDoneIn = (keysDoneStr||'').split(',');
        let keysDoneOut = [];   // rebuild to avoid trusting input
        let apiKey = O.keychain.credential(SHERPA_CREDENTIAL_NAME).secret;
        if(!apiKey) {
            throw new Error(SHERPA_CREDENTIAL_NAME + " not set up, this is required for embargoes to run");
        }
        let queries = [];
        let firstKey;
        _.each(QUERY_STRING_TO_ATTRIBUTE, (desc, key) => {
            let v = output.first(desc);
            if(v && (-1 === keysDoneIn.indexOf(key))) {
                let search;
                if(key === "issn") {
                    search = v.toString();
                } else {
                    search = O.isRef(v) ? v.load().title : v.toString();
                }
                if(!firstKey) { firstKey = key; }
                queries.push([key, "equals", search]);
            } else {
                keysDoneOut.push(key);
            }
        });

        if(queries.length > 0) {
            data.more = (queries.length > 1);
            data.done = keysDoneOut.concat(firstKey);
            data.key = firstKey;
            data.object = output.ref.toString();
            data.forVersion = forVersion;
            let http = O.httpClient("https://v2.sherpa.ac.uk/cgi/retrieve").
                queryParameter("item-type", "publication").
                queryParameter("api-key", apiKey.Secret).
                queryParameter("format", "Json").
                queryParameter("filter", JSON.stringify(queries));
            return http;
        }
    },
    process(data, client, result) {
        let results = {
            policies: []
        };
        if(result.successful) {
            parseResponse(result.body.readAsJSON(), results, data.forVersion);
        }
        return {
            object: data.object,
            more: data.more,
            key: data.key,
            done: data.done,
            policies: _.chain(results.policies).
                // Descending order
                sortBy((policy) => !policy.haploApplicable).
                map((policy, i) => {
                    policy.option = i+1;
                    return policy;
                }).
                value(),
            additionalInformationURLs: results.additionalInformationURLs,
            tabs: _.map(results.availableVersions, (version) => {
                return {
                    href: "/do/hres-repo-embargoes/sherpa-information/" + data.object,
                    parameters: { forVersion: version.code },
                    label: version.display,
                    selected: version.selected
                };
            }) 
        };
    },
    handle(data, result, E, output) {
        if(!data) {
            data = {
                more: false,
                policies: []
            };
        }
        E.response.body = JSON.stringify({ render: P.template("sherpa-policies").render(data) });
        E.response.kind = 'json';
    }
});