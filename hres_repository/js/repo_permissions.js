/* Haplo Research Manager                             http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:descriptive_object_labelling:setup", function(type) {
    P.REPOSITORY_TYPES.forEach(function(outputType) {
        type(outputType, {
            labels: [Label.ActivityRepository, Label.RepositoryItem],
            labelsFromLinked: [
                [A.Author, A.ResearchInstitute],
                [A.Editor, A.ResearchInstitute]
            ],
            // Label with creator, authors and editors so they can always see their own outputs,
            // and can edit them when the output is accepted into the repository
            labelWithCreator: true,
            labelWith: [A.Author, A.Editor]
        });
    });
});

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    // Accepted outputs can be read by everyone
    setup.groupPermission(Group.Everyone, "read", Label.AcceptedIntoRepository);
    // Outputs editors can read and write at all times
    setup.groupPermission(Group.RepositoryEditors, "read-write", Label.RepositoryItem);
    // Setup role & permission which allows users to add outputs and then edit
    // anything that they wrote (Author labelling above) or submitted
    // (labelWithCreator above). Use an oversight role permission because there
    // will only ever be one label for this permission.
    setup.groupPermission(Group.Everyone, "create", Label.RepositoryItem);
    setup.groupPersonalRole(Group.Everyone, "Is: Repository Item Author");
    setup.roleOversightPermission("Is: Repository Item Author", "read-write", [Label.RepositoryItem]);
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
