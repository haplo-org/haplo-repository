/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// TODO: refactor to use new Haplo platform date API instead of moment
var parseDateString = P.parseDateString = function(datesString) {
    datesString = datesString.replace(',', '');
    datesString = datesString.replace(/[–—]/, '-'); // replace en- and em-dashes with hyphen
    // try single date first
    const formats = [
        ["YYYY-MM-DD", O.PRECISION_DAY],
        ["Do MMMM YYYY", O.PRECISION_DAY],
        ["DD MMMM YYYY", O.PRECISION_DAY],
        ["D MMMM YYYY", O.PRECISION_DAY],
        ["D MMM YYYY", O.PRECISION_DAY],
        ["Do MMM YYYY", O.PRECISION_DAY],
        ["DD MMM YYYY", O.PRECISION_DAY],
        ["DD.MM.YYYY", O.PRECISION_DAY],
        ["D MMM. YYYY", O.PRECISION_DAY],
        ["DD.MM.YY", O.PRECISION_DAY],
        ["DD MMM. YYYY", O.PRECISION_DAY],
        ["DD/MM/YYYY", O.PRECISION_DAY],
        ["MMMM D YYYY", O.PRECISION_DAY],
        ["MMMM Do YYYY", O.PRECISION_DAY],
        ["MMMM DD YYYY", O.PRECISION_DAY],
        ["MMM D YYYY", O.PRECISION_DAY],
        ["MMM Do YYYY", O.PRECISION_DAY],
        ["MMM DD YYYY", O.PRECISION_DAY],
        ["YYYYMMDD", O.PRECISION_DAY],
        ["MMMM YYYY", O.PRECISION_MONTH],
        ["MMM YYYY", O.PRECISION_MONTH],
        ["YYYY", O.PRECISION_YEAR]
    ];
    let eventDate;
    _.some(formats, format => {
        const parsedDate = moment(datesString, format[0], true);
        if(parsedDate.isValid()) {
            eventDate = O.datetime(parsedDate.toDate(), undefined, format[1]);
            return true;
        }
    });

    if(!eventDate) {
        // now try a date range
        let splitTerm = "-";
        const datesParts = datesString.split(splitTerm);
        if(datesParts.length === 2) {
            const start = datesParts[0].trim();
            const end = datesParts[1].trim();
            let startDate, endDate;
            const dayFormats = _.filter(formats, f => f[1] === O.PRECISION_DAY);
            const dayFormatsList = _.map(dayFormats, f => f[0]);
            endDate = moment(end, dayFormatsList, true);
            if(endDate.isValid()) {
                startDate = moment(start, dayFormatsList, true);
                if(!startDate.isValid()) {
                    const startFormatsDayMonth = [
                        "D MMMM",
                        "Do MMMM",
                        "DD MMMM",
                        "D MMM",
                        "Do MMM",
                        "DD MMM"
                    ];
                    startDate = moment(start, startFormatsDayMonth, true);
                    if(startDate.isValid()) {
                        startDate.year(endDate.year());
                    } else {
                        startDate = moment(start, ["D", "DD", "Do"], true);
                        if(startDate.isValid()) {
                            startDate.month(endDate.month());
                            startDate.year(endDate.year());
                        }
                    }
                }
            } else {
                endDate = moment(end, ["D YYYY", "DD YYYY", "Do YYYY"], true);
                if(endDate.isValid()) {
                    startDate = moment(start, ["MMMM D", "MMMM DD"], true);
                    if(startDate.isValid()) {
                        endDate.month(startDate.month());
                        startDate.year(endDate.year());
                    }
                }
            }
            if(startDate && startDate.isValid() && endDate.isValid()) {
                eventDate = O.datetime(startDate.toDate(), endDate.toDate());
            }
        }
    }
    return eventDate;
};
