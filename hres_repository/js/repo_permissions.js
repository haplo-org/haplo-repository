/* Haplo Research Manager                             http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:descriptive_object_labelling:setup", function(type) {
    P.REPOSITORY_TYPES.forEach(function(outputType) {
        type(outputType, {
            selfLabelling: true,
            labels: [Label.ActivityRepository, Label.RepositoryItem],
            labelsFromLinked: [
                [A.Author, A.ResearchInstitute],
                [A.Editor, A.ResearchInstitute]
            ],
            // Label with creator, authors and editors so they can always see their own outputs,
            // and can edit them when the output is accepted into the repository
            labelWithCreator: true,
            labelWith: [A.Author, A.Editor, A.Project]
        });
    });
    
    type(T.Project, {
        labels: [Label.ActivityRepository]
    });
    
    type(T.Journal, {
        labels: [Label.ActivityRepository]
    });
    
    type(T.Publisher, {
        labels: [Label.ActivityRepository]
    });

    type(T.ExternalEvent, {
        labels: [Label.ActivityRepository],
        labelWithCreator: true
    });

    type(T.License, {
        labels: [Label.ActivityRepository]
    });
});

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    // Accepted outputs can be read by everyone
    setup.groupPermission(Group.Everyone, "read", Label.AcceptedIntoRepository);
    setup.groupPermission(Group.Everyone, "read", T.Journal);
    setup.groupPermission(Group.Everyone, "create", T.ExternalEvent);
    setup.groupPermission(Group.Everyone, "read", T.ExternalEvent);
    setup.groupPermission(Group.RepositoryEditors, "read-write", T.License);
    setup.groupPermission(Group.RepositoryEditors, "read-write", T.ExternalEvent);
    // Outputs editors can read and write at all times
    setup.groupPermission(Group.RepositoryEditors, "read-write", Label.RepositoryItem);
    // Setup role & permission which allows users to add outputs and then edit
    // anything that they wrote (Author labelling above) or submitted
    // (labelWithCreator above). Use an oversight role permission because there
    // will only ever be one label for this permission.
    setup.groupPermission(Group.Everyone, "create", Label.RepositoryItem);
    setup.groupPersonalRole(Group.Everyone, "Is: Repository Item Author");
    setup.roleOversightPermission("Is: Repository Item Author", "read-edit", [Label.RepositoryItem]);
    setup.roleOversightPermission("Is: Repository Item Author", "read-edit", [T.ExternalEvent]);
    setup.groupPermission(Group.ITSupport, "read", Label.ActivityRepository);
});

P.hook("hUserLabelStatements", function(response, user) {
    if(user.ref) {
        var statements = response.statements;
        
        var builder1 = O.labelStatementsBuilder();
        builder1.rule(user.ref, O.STATEMENT_ALLOW, O.PERM_UPDATE);
        var builder2 = O.labelStatementsBuilder();
        builder2.rule(Label.AcceptedIntoRepository, O.STATEMENT_ALLOW, O.PERM_UPDATE);

        var repositoryStatements = builder1.toLabelStatements().and(builder2.toLabelStatements());
        response.statements = statements.or(repositoryStatements);
    }
});

// TODO: Remove this when haplo_user_roles_permissions has been extended to check changes to object labels
// Implemented to allow people with edit permissions to edit authors and other label-controlling attributes.
P.hook("hOperationAllowOnObject", function(response, user, object, operation) {
    if((operation === "relabel") &&
        O.serviceMaybe("hres:repository:is_repository_item", object) &&
        object.labels.includes(user.ref)) {
        response.allow = true;
    }
});
