var moment = require('moment');

/// Date handling
var gnipTimeFormat = 'YYYYMMDDHHmm';
function gnipDate(date) {
  return moment(date).format(gnipTimeFormat);
}

function parseDate(inputDate) {
  var parsedValue = null;
  switch ({}.toString.call(inputDate)) {
    case '[object Object]':
      if (moment.isMoment(inputDate)) {
        parsedValue = inputDate;
      }
      break;
    case '[object String]':
      // Is this a Gnip date?
      var m = moment(inputDate, 'YYYYMMDDHHmm');
      if (!m.isValid()) {
        // If not, is it a normal date string?
        m = moment(inputDate);
        if (!m.isValid()) {
          // That's no good. Abort.
          throw inputDate + ' is not a valid string for ' + dateKey + '!';
        }
      }
      parsedValue = m.toDate();
      break;
    case '[object Date]':
      parsedValue = inputDate;
    break;
  }
  return parsedValue;
}

function parseDates(options) {
  var dateKeys = ['fromDate', 'toDate'];
  for (var i=0; i<dateKeys.length; i++) {
    var dateKey = dateKeys[i];

    if (options.hasOwnProperty(dateKey)) {
      var parsedValue = parseDate(options[dateKey]);

      if (parsedValue !== null) {
        options[dateKey] = gnipDate(parsedValue);
      } else {
        delete options[dateKey];
      }
    }
  }
}

module.exports.parseDates = parseDates;
