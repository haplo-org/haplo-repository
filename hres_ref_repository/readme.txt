title: REF Repository requirements
--

An output will be compliant with the post-2014 REF if:

All three of the following apply:

1) The Author Accepted Manuscript or Publisher's Version of the file is deposited in a public repository no later than 3 months from the date of acceptance.

2) Any embargo set is less than the max allewd (24 months for outputs in REF panels A and B, 48 for outputs in panels C and D)

3) The REF required metadata is present.

Or if a REF Exception is registered.

#h3. Implementation

This is done here by:

1) Storing the date an acceptable form of the file was deposited. The @"hres_repository:notify:published"@ is implemented and stores the first date (and version of the file) that this happens.

This is available through @P.getFirstFileDeposit(output)@

2) REF Unit of Assessment objects should have a Ref Panel object as their parent. This is used to calculate whether the embargo (if present) is too long.

3) The object is audited for the required metadata.

As well as providing an interface to reguster REFG exceptions during the deposit workflow. 

Note that the metadata requirements can be satisfied at any time before the audit in 2021.
