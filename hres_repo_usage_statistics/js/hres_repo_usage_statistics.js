/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.registerTable({
    name: "repoObjectTotals",
    columns: {outputRef: { type:"ref", indexed:true, indexedWith: ["year", "month"] }},
    findRowsToUpdate(output) {
        return [{}];
    },
    filter(object) {
        return object.isKindOfTypeAnnotated("hres:annotation:repository-item");
    }
});

var OutputStandaloneEntities = P.hresCombinedApplicationStandaloneEntities();

var ResearcherStandaloneEntities = P.hresCombinedApplicationStandaloneEntities({
    researcher: function(context) {
        return (context === "list") ? [this.object_ref] : this.object_ref;
    }
});

P.registerTable({
    name: "repositoryResearcherTotals",
    columns: {
        department: { type:"ref", indexed:true, indexedWith: ["year", "month"], nullable: true },
        school: { type:"ref", indexed:true, indexedWith: ["year", "month"], nullable: true },
        faculty: { type:"ref", indexed:true, indexedWith: ["year", "month"], nullable: true },
        researcher: { type:"ref", indexed:true, indexedWith: ["year", "month"] }
    },
    findRowsToUpdate(output) {
        let keys = [];
        O.withoutPermissionEnforcement(() => {
            let objectEntities = OutputStandaloneEntities.constructEntitiesObject(output);
            let researchers = objectEntities.researcher_refList;
            _.each(researchers, (r) => {
                let researcherEntities = ResearcherStandaloneEntities.constructEntitiesObject(r);
                let key = { 
                    researcher: r
                };
                if(researcherEntities.faculty_refMaybe) {
                    key.faculty = researcherEntities.faculty_ref;
                }
                if(researcherEntities.department_refMaybe) {
                    key.department = researcherEntities.department_ref;
                }
                if(researcherEntities.school_refMaybe) {
                    key.school = researcherEntities.school_ref;
                }
                keys.push(key);
            });
        });
        return keys;
    },
    filter(object) {
        return object.isKindOfTypeAnnotated("hres:annotation:repository-item") &&
            object.first(A.Researcher);
    }
});

P.registerTable({
    name: "repositoryFacultyTotals",
    columns: {
        faculty: { type:"ref", indexed:true, indexedWith: ["year", "month"]}
    },
    findRowsToUpdate(output) {
        let keys = [];
        O.withoutPermissionEnforcement(() => {
            let objectEntities = OutputStandaloneEntities.constructEntitiesObject(output);
            let faculties = objectEntities.faculty_refList;
            _.each(faculties, (f) => {
                let key = { 
                    faculty: f
                };
                keys.push(key);
            });
        });
        return keys;
    },
    filter(object) {
        return object.isKindOfTypeAnnotated("hres:annotation:repository-item");
    }
});

P.registerTable({
    name: "repositoryDepartmentTotals",
    columns: {
        department: { type:"ref", indexed:true, indexedWith: ["year", "month"]},
        faculty: { type:"ref", indexed:true, indexedWith: ["year", "month"], nullable: true }
    },
    findRowsToUpdate(output) {
        let keys = [];
        O.withoutPermissionEnforcement(() => {
            let objectEntities = OutputStandaloneEntities.constructEntitiesObject(output);
            let departments = objectEntities.department_refList;
            _.each(departments, (d) => {
                let key = {department: d};
                let department = d.load();
                if(department.first(A.Parent)) {
                    let f = department.first(A.Parent);
                    key.faculty = f;
                }
                keys.push(key);
            });
        });
        return keys;
    },
    filter(object) {
        return object.isKindOfTypeAnnotated("hres:annotation:repository-item");
    }
});

P.registerTable({
    name: "repositorySchoolTotals",
    columns: {
        department: { type:"ref", indexed:true, indexedWith: ["year", "month"], nullable: true },
        school: { type:"ref", indexed:true, indexedWith: ["year", "month"]},
        faculty: { type:"ref", indexed:true, indexedWith: ["year", "month"], nullable: true }
    },
    findRowsToUpdate(output) {
        let keys = [];
        O.withoutPermissionEnforcement(() => {
            let objectEntities = OutputStandaloneEntities.constructEntitiesObject(output);
            let schools = objectEntities.school_refList;
            _.each(schools, (s) => {
                let key = {school: s};
                let school = s.load();
                if(school.first(A.Parent)) {
                    let d = school.first(A.Parent);
                    key.department = d;
                    let department = d.load();
                    if(department.first(A.Parent)){
                        let f = department.first(A.Parent);
                        key.faculty = f;
                    }
                }
                keys.push(key);
            });
        });
        return keys;
    },
    filter(object) {
        return object.isKindOfTypeAnnotated("hres:annotation:repository-item");
    }
});
