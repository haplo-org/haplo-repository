/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.hook('hUserPermissionRules', function(response, user) {
    if(user.isMemberOf(Group.PublicRepositoryAccess)) {
        response.rules.rule(Label.CONCEPT, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(Label.STRUCTURE, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(Label.AcceptedIntoRepository, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.Organisation, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.ResearchInstitute, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.Journal, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.ExternalEvent, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.License, O.STATEMENT_ALLOW, O.PERM_READ);

        // TODO: this is to allow projects to be linked to in researcher profile forms. However,
        // the forms system still links them to the internal record. Fix this properly
        response.rules.rule(T.Project, O.STATEMENT_ALLOW, O.PERM_READ);

        const personReadTypes = SCHEMA.getTypesWithAnnotation("hres:annotation:repository:publically-accessible-person");
        _.each(personReadTypes, (t) => response.rules.rule(t, O.STATEMENT_ALLOW, O.PERM_READ));
    }
});
