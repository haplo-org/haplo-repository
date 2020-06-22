/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.db.table("downloadedFiles", {
    url: { type:"text" },
    digest: { type:"text", nullable:true },
    error: { type:"text", nullable:true }
});

var END_POINT = O.application.config["hres_repo_jisc_pub_router:end_point"];
var PAGE_SIZE = 100; // max page size

var ensureSafeHarvest = function() {
    if(!END_POINT) {
        throw new Error("No JISC pub router end point specified.");
    }
    let lastImport = P.data.jiscPubRouterOverrideSince || P.data.jiscPubRouterLastImport;
    if(!lastImport) {
        throw new Error("No date of last import, please run the first import manually.");
    }
    if(isNaN(new Date(lastImport))) {
        throw new Error("Invalid last import date.");
    }
    if(new XDate(lastImport).diffDays(new XDate()) < 1) {
        throw new Error("Attempting to import from before the last import.");
    }
};

var requestPage = function(pageNumber) {
    ensureSafeHarvest();
    let since = P.data.jiscPubRouterOverrideSince || P.data.jiscPubRouterLastImport;
    let client = O.httpClient(END_POINT).
        method("GET").
        queryParameter("since", since).
        queryParameter("pageSize", PAGE_SIZE.toString());
    if(pageNumber) {
        client.queryParameter("page", pageNumber.toString());
    }
    client.request(jiscCallback);

    delete P.data.jiscPubRouterOverrideSince;
    P.data.jiscPubRouterLastImport = new XDate().toString("yyyy-MM-dd");
};

P.implementService("hres:repository:harvest-source:jisc-pub-router", function() {
    requestPage();
});

var jiscCallback = P.callback("get-notifications", function(data, client, result) {
    if(result.successful) {
        let json = result.body.readAsJSON();
        let notifications = json.notifications;
        const hasLinksToDownload = _.some(notifications, n => ((n.links && n.links.length) && _.some(n.links, l => !!l.url)));
        if(!hasLinksToDownload) {
            harvest(json);
        } else {
            O.background.run("hres_repo_jisc_pub_router:download_files_then_harvest", json);
        }
        let pageNumber = parseInt(json.page);
        if(parseInt(json.total, 10) - (pageNumber * parseInt(json.pageSize)) > 0) {
            requestPage(pageNumber + 1);
        } else {
            // no more requests needed, reset since dates
            P.data.jiscPubRouterOverrideSince = null;
            P.data.jiscPubRouterLastImport = new XDate().toString("yyyy-MM-dd");
        }
    } else {
        throw new Error("Get notifications returned error - "+result.errorMessage);
    }
});

P.backgroundCallback("download_files_then_harvest", function(data) {
    let notifications = data.notifications;
    let linksRemaining = [];
    _.each(notifications, n => {
        let hasPdfs = false;
        _.each(n.links, link => {
            // JISC don't have any providers that only provide a zip, if we need to import zip files
            // this will need a platform update and use of the client PubRouter API key
            if(link.url && link.format === "application/pdf") {
                linksRemaining.push(link.url);
                hasPdfs = true;
            }
        });
        if(n.links && !hasPdfs) {
            // throw new Error("No PDF formatted links for notification with id: "+n.id);
        }
    });
    data.linksRemaining = _.uniq(linksRemaining);
    if(data.linksRemaining[0]) {
        O.httpClient(data.linksRemaining[0]).request(Download, data);
    } else {
        harvest(data);
    }
});

var Download = P.callback("download", function(data, client, response) {
    let url = data.linksRemaining[0];
    data.linksRemaining.shift();
    let q = P.db.downloadedFiles.select().where("url", "=", url);
    let row;
    if(q.count()) {
        row = q[0];
    } else {
        row = P.db.downloadedFiles.create({});
    }
    if(!row.digest) {
        row.url = url;
        let file, error;
        if(response.successful) {
            try {
                file = O.file(response.body);
                row.digest = file.digest;
            } catch(e) {
                error = e.message;
            }
        } else {
            error = response.errorMessage;
        }
        if(error) {
            row.error = error;
        }
        row.save();
    }
    // determine next link
    if(data.linksRemaining.length) {
        O.httpClient(data.linksRemaining[0]).request(Download, data);
    } else {
        harvest(data);
    }
});

var objectsToSave;
// this only works where these items don't need to be found via a query in a later harvest
var saveLater = function(object) {
    if(!object.ref) {
        object.preallocateRef();
    }
    let refKey = object.ref.toString();
    objectsToSave[refKey] = object;
};

var harvest = function(json) {
    objectsToSave = {};
    let errors = [];
    let harvest = _.map(json.notifications, n => {
        let notificationResult, object, embargo;
        try {
            notificationResult = createObject(n);
            object = notificationResult.object;
            embargo = notificationResult.embargo;
        } catch(e) {
            errors.push("Notification id: "+n.id+", "+e);
        }
        if(!object) { return {}; }
        let identifier = n.id;
        return {
            object: object,
            identifier: identifier || null,
            source: "jisc_publications_router",
            subSource: n.provider.agent,
            embargo: embargo
        };
    });
    harvest = _.filter(harvest, h => !_.isEmpty(h));
    if(errors.length) {
        let totalNotifications = json.notifications.length;
        O.reportHealthEvent("There were errors when creating items for the latest JISC Publications Router harvest. "+
            harvest.length+"/"+totalNotifications+" items queued for harvest.\n"+
            errors.join("\n"));
    }

    _.each(objectsToSave, o => o.save());
    O.service("hres_repo_harvest_sources:push_updates_from_source", harvest);
};

var OUTPUT_STATUS_MAP = {
    "accepted": "hres:list:output-status:in-press",
    "published": "hres:list:output-status:published"
};

var LICENSE_MAP = {
    "cc by": "hres:list:license:cc-by",
    "cc by-sa": "hres:list:license:cc-by-sa",
    "cc by-nc": "hres:list:license:cc-by-nc",
    "cc by-nd": "hres:list:license:cc-by-nd",
    "cc by-nc-sa": "hres:list:license:cc-by-nc-sa",
    "cc by-nc-nd": "hres:list:license:cc-by-nc-nd"
};

var DATE_TYPE_MAP = {
    "epub": [A.PublicationDates, Q.Online],
    "ppub": [A.PublicationDates, Q.Print],
    "accepted": [A.PublicationProcessDates, Q.Accepted],
    "pub-electronic": [A.PublicationDates, Q.Online]
};

var normalise = function(text) {
    return text.toLowerCase().replace(/[^a-z]/,"");
};
var normalisedTitleLists = O.refdict();
var normalisedTitleList = function(type) {
    let list = normalisedTitleLists.get(type);
    if(!list) {
        let objects = O.query().link(type, A.Type).execute();
        list = {};
        _.each(objects, obj => {
            let normalisedTitle = normalise(obj.title);
            if(!list[normalisedTitle]) {
                list[normalisedTitle] = obj;
            }
        });
        normalisedTitleLists.set(type, list);
    }
    return list;
};
var matchOnNormalisedTitle = function(title, type) {
    return normalisedTitleList(type)[normalise(title)];
};
var updateNormalisedTitleLists = function(object) {
    let type = object.firstType();
    let list = normalisedTitleList(type);
    let nTitle = normalise(object.title);
    if(!list[nTitle]) {
        list[nTitle] = object;
        normalisedTitleLists.set(type, list);
    }
};

var createObject = function(notification) {
    let object = O.object();
    object.preallocateRef();
    object.appendType(T.JournalArticle);

    let metadata = notification.metadata;
    if(!metadata) { throw new Error("No metadata found"); }
    let journalCitationSpec = {};
    _.each(metadata.article, (value, key) => {
        switch(key) {
            case "title":
                object.appendTitle(value);
                break;
            case "sub_title":
                _.each(value, subtitle => {
                    object.appendTitle(subtitle, Q.Alternative);
                });
                break;
            case "page_range":
                journalCitationSpec.pageRange = value;
                break;
            case "num_pages":
                journalCitationSpec.numPages = value;
                break;
            case "abstract":
                object.append(value, A.Abstract);
                break;
            case "identifier":
                appendIdentifiers(object, value);
                break;
            case "subject":
                _.each(value, subject => {
                    object.append(subject, A.Keywords);
                });
                break;
            // keys ignored/used elsewhere
            case "type":
            case "version":
            case "language":
                break;
            case "start_page":
                journalCitationSpec.start = value;
                break;
            case "end_page":
                journalCitationSpec.end = value;
                break;
            default:
                throw new Error("Unknown article key: " + key + " with value " + JSON.stringify(value));
        }
    });

    let authors = [];
    _.each(metadata.author, (author) => {
        if(_.isEmpty(author)) { return; }
        let citation = createPersonCitation(author);
        O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, citation);
        authors.push(citation);
    });
    _.each(metadata.contributor, (contributor) => {
        if(_.isEmpty(contributor)) { return; }
        let citation = createPersonCitation(contributor);
        let desc = A.Editor;
        if(contributor.type !== "editor") {
            throw new Error("Unknown contributor type in " + JSON.stringify(contributor));
        }
        O.service("hres:author_citation:append_citation_to_object", object, desc, null, citation);
    });

    if(metadata.publication_status) {
        let statusBehaviour = OUTPUT_STATUS_MAP[metadata.publication_status.toLowerCase()];
        if(statusBehaviour) {
            object.append(O.behaviourRef(statusBehaviour), A.OutputStatus);
        }
    }
    let dateStr = "";
    if(metadata.accepted_date) {
        object.append(new Date(metadata.accepted_date), A.PublicationProcessDates, Q.Accepted);
        dateStr += "Publications router: Date " + metadata.accepted_date + " of type 'accepted_date' included in notification.\n";
    }
    let pub = metadata.publication_date;
    let pubDate;
    if(pub && pub.date) {
        let q;
        if(pub.publication_format === "print") { q = Q.Print; }
        else if(pub.publication_format === "electronic") { q = Q.Online; }
        pubDate = pub.date;
        object.append(new Date(pubDate), A.PublicationDates, q);
        let pubYear = pub.year || pubDate;
        object.append(O.datetime(new Date(pubYear), undefined, O.PRECISION_YEAR), A.Date);
        dateStr += "Publications router: Date " + pub.date + " of type 'publication_date'";
        dateStr += pub.publication_format ? " with format '" + pub.publication_format +"'" : "";
        dateStr += " included in notification\n";
    }
    _.each(metadata.funding, funding => {
        let funder = O.object().appendType(T.Funder).appendTitle(funding.name);
        let existingFunder;
        if(funding.identifier) {
            existingFunder = appendIdentifiers(funder, funding.identifier, true);
        }
        // TODO: update funder obj once FundRef support exists for identifying them
        if(!existingFunder) {
            existingFunder = matchOnNormalisedTitle(funding.name, T.Funder);
        }
        if(existingFunder) {
            funder = existingFunder;
        } else {
            saveLater(funder);
            updateNormalisedTitleLists(funder);
        }
        object.append(funder, A.Funder);
        _.each(funding.grant_numbers, gn => {
            let existingProject = matchOnNormalisedTitle(gn, T.ProjectPast);
            let project;
            if(!existingProject) {
                project = O.object().appendType(T.ProjectPast).appendTitle(gn);
                project.preallocateRef();
            } else {
                if(!existingProject.isMutable()) {
                    project = existingProject.mutableCopy();
                }
            }
            _.each(authors, a => {
                if(a.ref && !project.has(a.ref, A.Researcher)) {
                    project.append(a.ref, A.Researcher);
                }
            });
            if(!project.has(funder, A.Funder)) {
                project.append(funder, A.Funder);
            }
            if(!existingProject || !project.valuesEqual(existingProject)) {
                saveLater(project);
                if(!existingProject) { updateNormalisedTitleLists(project); }
            }
            if(!object.has(project.ref, A.Project)) {
                object.append(project, A.Project);
            }
        });
    });

    let earliestPublicationDate;
    _.each(metadata.history_date, historyDate => {
        if(_.isEmpty(historyDate)) { return; }
        let date = new Date(historyDate.date);
        let dateInfo = DATE_TYPE_MAP[historyDate.date_type];
        // date_type is a free text field so isn't completely mappable
        if(dateInfo) {
            if(!object.has(date, dateInfo[0], dateInfo[1])) {
                object.append(date, dateInfo[0], dateInfo[1]);
            }
            // need to determine earliest publication date for embargo now so end date can be calculated
            // since duration may be given in days, not months as is normal in hres_repo_embargoes
            if(metadata.embargo && dateInfo[0] === A.PublicationDates) {
                if(!earliestPublicationDate || earliestPublicationDate.getTime() > date.getTime()) {
                    earliestPublicationDate = date;
                }
            }
        }
        dateStr += "Publications router: Date " + historyDate.date + " of type '" + historyDate.date_type +
            "' included in notification\n";
    });
    if(dateStr) {
        object.append(O.text(O.T_TEXT_PARAGRAPH, dateStr), A.Notes);
    }

    let embargoEnd, embargoSpec;
    if(metadata.embargo) {
        embargoSpec = metadata.embargo;
        embargoSpec.customStart = embargoSpec.start;
        embargoEnd = embargoSpec.end;
        if(!embargoSpec.customStart && earliestPublicationDate) {
            embargoSpec.customStart = earliestPublicationDate.toString();
        }
        let embargoStart = embargoSpec.customStart;
        if(embargoSpec.duration && (!embargoStart || !embargoEnd)) {
            let duration = parseInt(embargoSpec.duration, 10);
            if(embargoStart) {
                embargoSpec.end = new XDate(embargoStart).addDays(duration).toDate();
            } else if(embargoEnd) {
                embargoSpec.customStart = new XDate(embargoEnd).addDays(-duration).toDate();
            }
         }
    }
    
    let bestLicense = _.find(metadata.license_ref, licenseInfo => {
        return licenseInfo.best;
    });
    if(bestLicense) {
        if(bestLicense.start) {
            if((bestLicense.start !== pubDate) && (bestLicense.start !== embargoEnd)) {
                throw new Error("License start date does not match publication or embargo date");
            }
        }
        if(bestLicense.type && LICENSE_MAP[bestLicense.type]) {
            let licenseBehaviour = LICENSE_MAP[bestLicense.type];
            if(bestLicense.version && (bestLicense.version === "3" || bestLicense.version === "4")) {
                licenseBehaviour += ":"+bestLicense.version;
            }
            object.append(O.behaviourRef(licenseBehaviour), A.License);
        } else if(bestLicense.url) {
            // Reporting fact license fills with license reporting sentinel object if not an existing license
            let url = O.text(O.T_IDENTIFIER_URL, bestLicense.url);
            let licenses = O.query().link(T.License, A.Type).identifier(url, A.Url).execute();
            if(licenses.length) {
                _.each(licenses, (license) => {
                    object.append(license.ref, A.License);
                });
            } else {
                object.append(url, A.License);
            }
        }
    }
    let licenseStr = "";
    _.each(metadata.license_ref, (license) => {
        licenseStr += "Publications router: License for ";
        licenseStr += metadata.article.version ? metadata.article.version+" version of " : "";
        licenseStr += "this article";
        licenseStr += license.start ? " starting on "+license.start : "";
        licenseStr += ": "+(license.url || license.title)+" included in notification\n";
    });
    if(licenseStr) {
        object.append(O.text(O.T_TEXT_PARAGRAPH, licenseStr), A.Notes);
    }

    let journal = O.object().appendType(T.Journal);
    let existingJournal;
    let publishers = [];
    _.each(metadata.journal, (value, key) => {
        switch(key) {
            case "title":
                journal.appendTitle(value);
                break;
            case "abbrev_title":
                break;
            case "volume":
                journalCitationSpec.volume = value;
                break;
            case "issue":
                journalCitationSpec.number = value;
                break;
            case "publisher":
                _.each(value, publisherTitle => {
                    let publisher = matchOnNormalisedTitle(publisherTitle, T.Publisher);
                    if(!publisher) {
                        publisher = O.object().
                            appendType(T.Publisher).
                            appendTitle(publisherTitle);
                        saveLater(publisher);
                        updateNormalisedTitleLists(publisher);
                    }
                    journal.append(publisher, A.Publisher);
                    object.append(publisher, A.Publisher);
                });
                break;
            case "identifier":
                existingJournal = appendIdentifiers(journal, value, true);
                appendIdentifiers(object, value);
                break;
            default:
                throw new Error("Unknown journal key: " + key + " with value " + JSON.stringify(value));
        }
    });
    if(journalCitationSpec.volume) {
        O.serviceMaybe("hres:journal_citation:append_citation_to_object",
            object, A.JournalCitation, undefined, journalCitationSpec);
    } else if(journalCitationSpec.pageRange) {
        object.append(journalCitationSpec.pageRange, A.PageRange);
    } else if(journalCitationSpec.start && journalCitationSpec.end) {
        object.append([journalCitationSpec.start, journalCitationSpec.end].join('-'), A.PageRange);
    } else if(journalCitationSpec.numPages) {
        object.append(journalCitationSpec.numPages, A.Pages);
    }
    if(journal.title) {
        if(!existingJournal) {
            existingJournal = matchOnNormalisedTitle(journal.title, T.Journal);
        }
        if(existingJournal) {
            if(!existingJournal.isMutable()) {
                existingJournal = existingJournal.mutableCopy();
            }
            journal.every((v,d,q) => {
                // update with all new info except the title
                if(d !== A.Title && !existingJournal.has(v,d,q)) {
                    existingJournal.append(v,d,q);
                }
            });
            saveLater(existingJournal);
            journal = existingJournal;
        } else {
            saveLater(journal);
            updateNormalisedTitleLists(journal);
        }
        object.append(journal, A.Journal);
    }

    let fileDesc = A.OutputFile;
    if(metadata.article && metadata.article.version) {
        let v = metadata.article.version.toLowerCase();
        if(v === "vor") { fileDesc = A.PublishedFile; }
        else if(v === "am") { fileDesc = A.AcceptedAuthorManuscript; }
        else { throw new Error("Unknown article version '"+v+"'"); }
    }
    _.each(notification.links, link => {
        if(!link.url) { return; }
        let q = P.db.downloadedFiles.select().where("url", "=", link.url).where("digest", "<>", null);
        if(q.count()) {
            let groupId = object.newAttributeGroup(fileDesc);
            object.append(O.file(q[0].digest).identifier(), A.File, null, groupId);
        }
    });

    return {
        object: object,
        embargo: embargoSpec
    };
};

var _matchPeopleServices;
var matchPeopleServices = function() {
    if(!_matchPeopleServices) {
        _matchPeopleServices = O.service("haplo:service-registry:query", [
            "conforms-to hres:repository:match-item-to-existing-in-list",
            "list-of people"
        ]);
    }
    return _matchPeopleServices;
};

// This may need to be moved up the plugin stack later
var INTERNAL_EMAIL_SUFFIXES = O.application.config["hres:repository:jisc_pub_router:internal_email_suffixes"] || [];

var createPersonCitation = function(data) {
    let person;
    let personCitation = {};

    if(data.organisation_name) {
        return {
            cite: data.organisation_name
        };
    }

    if(data.identifier && data.identifier.length > 0) {
        let hasNonEmailIdentifier = _.any(data.identifier, (id) => id.type !== "email");
        let email, orcid, personType = T.ExternalResearcher;
        let testPerson = O.object();
        _.each(data.identifier, id => {
            if(person) { return; }
            if(id.type === "email") {
                let emailSuffix = id.id.split("@");
                if(emailSuffix.length !== 2) { throw new Error("Invalid email for id key in "+JSON.stringify(data)); }
                emailSuffix = emailSuffix[1];
                if(_.contains(INTERNAL_EMAIL_SUFFIXES, emailSuffix)) { personType = T.ResearcherPast; }
                email = O.text(O.T_IDENTIFIER_EMAIL_ADDRESS, id.id);
                testPerson.append(email, A.Email);
            } else if(id.type === "orcid") {
                orcid = P.ORCID.create(id.id);
                testPerson.append(orcid, A.ORCID);
            } else {
                return;
            }
        });
        let matchObject;
        let allPeople = O.query().link(T.Person, A.Type).execute();
        matchPeopleServices().eachService(matcher => {
            if(matchObject) { return; }
            matchObject = O.service(matcher.name, testPerson, allPeople);
        });
        if(matchObject) { person = matchObject.mutableCopy(); }
        if(!person) {
            person = O.object();
            person.appendType(personType);
            if(!data.name || !data.name.surname || !data.name.firstname) {
                throw new Error("Missing first name and/or surname for in "+JSON.stringify(data));
            }

            // Don't create person if only identifier is external email
            if(personType == T.ExternalResearcher && !hasNonEmailIdentifier) {
                return {
                    cite: data.name.surname + ", " + data.name.firstname
                };
            }

            person.append(O.text(O.T_TEXT_PERSON_NAME, {
                first: data.name.firstname,
                last: data.name.surname
            }), A.Title);
            if(data.affiliation) {
                if(personType == T.ExternalResearcher) {
                    person.append(data.affiliation, A.InstitutionName);
                }
            }
        }
        if(email && !person.has(email, A.Email)) { person.append(email, A.Email); }
        if(orcid && !person.has(orcid, A.ORCID)) { person.append(orcid, A.ORCID); }
        if(!matchObject || !matchObject.valuesEqual(person)) {
            O.impersonating(O.SYSTEM, function() {
                person.save();
            });
        }
        personCitation.ref = person.ref;
    } else {
        if(!data.name || !data.name.surname || !data.name.firstname) {
            throw new Error("Missing first name and/or surname for in "+JSON.stringify(data));
        }
        personCitation = {
            cite: data.name.surname + ", " + data.name.firstname
        };
    }
    return personCitation;
};

var _matchOutputServices;
var matchOutputServices = function() {
    if(!_matchOutputServices) {
        _matchOutputServices = O.service("haplo:service-registry:query", [
            "conforms-to hres:repository:match-item-to-existing-in-list",
            "list-of repository-items"
        ]);
    }
    return _matchOutputServices;
};

var appendIdentifiers = function(object, identifiers, tryMatch) {
    let queryableIds = [];
    _.each(identifiers, id => {
        let value, desc;
        switch(id.type) {
            case "pii":
            case "doi":
                value = P.DOI.create(id.id);
                desc = A.DOI;
                queryableIds.push([value, desc]);
                break;
            case "issn":
            case "eissn":
            case "essn":
            case "pissn":
                value = O.text(O.T_IDENTIFIER_ISBN, id.id);
                desc = A.ISSN;
                queryableIds.push([value, desc]);
                break;
            case "pubmed":
            case "pmid":
                if("PubmedId" in A) {
                    desc = A.PubmedId;
                    value = id.id;
                }
                break;
            case "pmc":
            case "pmcid":
                if("PubMedCentralID" in A) {
                    desc = A.PubMedCentralID;
                    value = id.id;
                }
                break;
            case "nlmid":
                if("NLMID" in A) {
                    desc = A.NLMID;
                    value = id.id;
                }
                break;
            default:
                throw new Error("Unknown identifier type in " + JSON.stringify(id));
        }
        if(!value || !desc) { return; }
        if(!object.has(value, desc)) {
            object.append(value, desc);
        }
    });
    if(tryMatch) {
        let matchObject;
        if(object.isKindOfTypeAnnotated("hres:annotation:repository-item")) {
            const allRepositoryItems = O.query().
                link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).
                execute();
            matchOutputServices().eachService(matcher => {
                if(matchObject) { return; }
                matchObject = O.service(matcher.name, object, allRepositoryItems);
            });
        } else if(queryableIds.length) {
            let objQ = O.query().link(object.firstType(), A.Type).or(sq => {
                _.each(queryableIds, id => {
                    sq.identifier(id[0], id[1]);
                });
            }).execute();
            matchObject = objQ.length ? objQ[0] : undefined;
        }
        return matchObject;
    }
};

// --------------------------------------------------------------------------
// Administrative functions
// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/hres-repo-jisc-pub-router/import", [
    {"parameter":"since", as:"string", optional: true}
], function(E, since) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted."); }
    if(E.request.method === "POST") {
        if(since) {
            P.data.jiscPubRouterOverrideSince = since;
        }
        O.withoutPermissionEnforcement(() => { requestPage(); });
        return E.response.redirect("/");
    }
    E.render({
        pageTitle: "Run manual import from Publications Router",
        text: "This will harvest records into the repository from the configured Jisc Publications Router endpoint.\n"+
            "Last import ran on: "+P.data.jiscPubRouterLastImport,
        options: [{label:"Confirm"}]
    }, "std:ui:confirm");
});

P.respond("GET", "/do/hres-repo-jisc-pub-router/downloaded-files-status", [
], function(E) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted."); }
    let json = [];
    _.each(P.db.downloadedFiles.select(), file => {
        json.push({
            url: file.url,
            digest: file.digest,
            error: file.error
        });
    });
    E.response.kind = "json";
    E.response.body = JSON.stringify(json);
});
