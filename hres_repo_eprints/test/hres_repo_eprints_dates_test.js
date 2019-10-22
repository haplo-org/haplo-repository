/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

t.test(function() {
    const testStrings = [
        ["26 June 2013","26 Jun 2013"],
        ["21 Feb. 2017","21 Feb 2017"],
        ["July 15, 2013","15 Jul 2013"],
        ["January, 2005","Jan 2005"],
        ["February 2012","Feb 2012"],
        ["25th September 2014","25 Sep 2014"],
        ["02/09/2014","02 Sep 2014"],
        ["01.06.15","01 Jun 2015"],
        ["12.11.2015","12 Nov 2015"],
        ["2011-06-01","01 Jun 2011"],
        ["Apr 2008","Apr 2008"],
        ["21st September - 13th November 2015","21 Sep 2015 to end of 13 Nov 2015"],
        ["18th November - 26th November 2016","18 to end of 26 Nov 2016"],
        ["16th May - 21st June, 2015","16 May 2015 to end of 21 Jun 2015"],
        ["29 Aug - 2 Sep 2011","29 Aug 2011 to end of 02 Sep 2011"],
        ["15-18 May 2011","15 to end of 18 May 2011"],
        ["22-24 Aug 2005","22 to end of 24 Aug 2005"],
        ["1-3 September 2010","01 to end of 03 Sep 2010"],
        ["04 - 07, January 2016","04 to end of 07 Jan 2016"],
        ["20-22 Aug. 2015","20 to end of 22 Aug 2015"],
        ["December 2 - 4, 2014","02 to end of 04 Dec 2014"],
        ["September 15-17, 2015","15 to end of 17 Sep 2015"],
        ["9 Jul - 14 Jul 2011", "09 to end of 14 Jul 2011"],
        ["30 June – 3 July 2008", "30 Jun 2008 to end of 03 Jul 2008"], // test en-dash too
        ["28-30 November, 2015", "28 to end of 30 Nov 2015"],
        ["24 September - 08 October 2017", "24 Sep 2017 to end of 08 Oct 2017"],
        ["2012", "2012"],
        ["15th-17th December 2015", "15 to end of 17 Dec 2015"],
        ["20130530-20130602", "30 May 2013 to end of 02 Jun 2013"],
        ["April 24 - 28th 2000", "24 to end of 28 Apr 2000"]
    ];
    let successCount = 0;
    let results = "";
    _.each(testStrings, s => {
        const parsedDate = P.parseDateString(s[0]);
        const dateString = parsedDate ? parsedDate.toString() : undefined;
        t.assert(dateString === s[1], "Got "+dateString+" for "+s[0]);
    });
});