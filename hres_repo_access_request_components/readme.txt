title: Repo Access Requests
--


h2. Overview

Repository items sometimes need a managed release process before the files can be released to non-authors. This is typically because the files are either under embargo from a publisher, or contain sensitive data that must be redacted.

The @hres_repo_access_request_components@ plugin provides a set of workflow features that can be composed together by a consuming implementation plugin to produce access request workflows for both internal and public users.

h2. Concepts


h3. Requestor

The person who asks for the file. Note this does not have to be a system "user":https://docs.haplo.org/dev/plugin/interface/security-principal (but does have to  have @name@, @nameFirst@, and @email@ properties).

h3. Source

Where the access request came from (eg. publication or internal)

h3. Audience

The intended audience for a request. Configurable in code on a per-client basis.

Stored on the released "file":https://docs.haplo.org/dev/plugin/interface/file and "WorkUnit":https://docs.haplo.org/dev/plugin/interface/work-unit as tags.

Expected values are @external@ or @internal@.

h3. Action

The preparation action that has been done to the file.

A controlled list which is configurable in code, and stored on the released "file":https://docs.haplo.org/dev/plugin/interface/file as a file tag.

h3. Preparation notes

Free text notes from data preparer about what they did. Stored on the released "file":https://docs.haplo.org/dev/plugin/interface/file as a file tag.