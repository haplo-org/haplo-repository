title: Repository item duplication
module_owner: Helen
--

This plugin allows users to use existing repository items as the basis of new ones.

An example of when this is useful is when someone submits a paper, then presents the paper with a poster at a conference. The paper can be used as the basis of the additional poster and conference item repository outputs to speed up depositing.

h3(service). "hres:repository:duplication_ignore_attributes"

By default, the feature does not copy over:

* Type
* Publication Dates
* Publication Process Dates
* File
* ISSN
* ISBN
* DOI
* URL
* Page range
* PubMed ID
* Edition
* Series
* Journal citation
* License
* Accepted Author Manuscript
* Published File

If there are additional attributes it should not copy over, implement the service. To implement, modify the array that is passed in as the only argument by adding or removing attribute codes. The array will be filled with the above attribute codes, so they can be removed if you do want to copy over one or more of the above attributes in your implementation.