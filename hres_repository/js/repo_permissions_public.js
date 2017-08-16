/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

/*
    These permissions are intended for setting up public access via service users, for
    std_publisher publications and various API implementations.

    In requirements:

        group hres:group:example-api-service
            title: Example API Service

        group hres:group:public-repository-access
            member hres:group:example-api-service

        service-user hres:service-user:example-api
            title: Example API Access
            group hres:group:example-api-service

    First statement creates a group for this particular API/publication.
    Second adds this group as a member of the general public access group, which
    gives the service user the permission to read all relevant objects.
    Third creates the actual service user.
*/

P.hook('hUserPermissionRules', function(response, user) {
    if(user.isMemberOf(Group.PublicRepositoryAccess)) {
        response.rules.rule(Label.CONCEPT, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(Label.STRUCTURE, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(Label.AcceptedIntoRepository, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.Person, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.Organisation, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.ResearchInstitute, O.STATEMENT_ALLOW, O.PERM_READ);
    }
});
