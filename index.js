var request = require('request'),
    util = require('util'),
    _ = require('lodash'),
    moment = require('moment');

var gnipTimeFormat = 'YYYYMMDDHHmm';

function GnipReader(usernameOrAuthKey, password, accountName, stream, maxResults) {
  stream = stream || 'prod';

  // Object properties
  var options = {
    accountName: accountName,
    stream: stream
  };

  if ({}.toString.call(password) === '[object String]') {
    options.username = usernameOrAuthKey;
    options.password = password;
  } else {
    options.gnipAuthKey = usernameOrAuthKey;
  }

  var templateUrl = util.format('https://search.gnip.com/accounts/%s/search/%s%s.json', options.accountName, options.stream),
      countSuffix = '/counts';

  this.nextKey = null;
  this.maxResults = maxResults || null;

  var self = this;

  function overridableOptions() {
    var overridables = {};
    if (self.maxResults) {
      overridables.maxResults = self.maxResults;
    }
    return overridables;
  }

  function gnipDate(date) {
    return moment(date).format(gnipTimeFormat);
  }

  function parseDates(options) {
    var dateKeys = ['fromDate', 'toDate'];
    _.forEach(dateKeys, function(dateKey) {
      if (_.has(options, dateKey)) {
        var parsedValue = null;
        switch ({}.toString.call(options[dateKey])) {
          case '[object Object]':
            if (moment.isMoment(options[dateKey])) {
              parsedValue = options[dateKey];
            }
            break;
          case '[object String]':
            // Is this a Gnip date?
            var m = moment(options[dateKey], 'YYYYMMDDHHmm');
            if (!m.isValid()) {
              // If not, is it a normal date string?
              m = moment(options[dateKey]);
              if (!m.isValid()) {
                // That's no good. Abort.
                throw options[dateKey] + ' is not a valid string for ' + dateKey + '!';
              }
            }
            parsedValue = m.toDate();
            break;
          case '[object Date]':
            parsedValue = options[dateKey];
          break;
        }
        if (parsedValue !== null) {
          options[dateKey] = gnipDate(parsedValue);
        } else {
          delete options[dateKey];
        }
      }
    });
  }

  function parseOptions(options) {
    if ({}.toString.call(options) === '[object String]') {
      options = {
        query: options
      };
    } else {
      parseDates(options);
    }
    return options;
  }

  function buildOptions(additionalPayload, getEstimate) {
    var authPayload = (options.gnipAuthKey !== undefined) ? {
      headers: {
        'authorization': 'Basic ' + options.gnipAuthKey
      }
    } : {
      auth: {
        'user': options.username, 
        'pass': options.password
      }
    };
    return _.merge({
      url: util.format(templateUrl, (getEstimate === true)?countSuffix:''),
      gzip: true,
      json: true
    }, authPayload, additionalPayload);
  }

  function doQuery(optionsOrQuery, getEstimate, useNext, callback) {
    // Get parameters based off 1) instance defaults, 2) passed overrides, and 3) required values.
    var nextParameters = useNext&&self.nextKey?{next: self.nextKey}:{},
        gnipParameters = _.merge(overridableOptions(),
    parseOptions(optionsOrQuery),
    nextParameters,
    {
      'publisher': 'twitter',
    });

    // Prepare them for sending to Gnip
    var requestOptions = buildOptions({
      form: JSON.stringify(gnipParameters)
    }, getEstimate);

    // And send them
    request.post(requestOptions, function(err, response, body) {
      if (!err && response.statusCode == 200) {
        // Store the next key so the user can get more records
        self.nextKey = body.hasOwnProperty('next')?body.next:null;
        callback(null, body.results, self.nextKey !== null);
      } else {
        // Parse the error that gets returned. It will likely be in the body: 
        // http://support.gnip.com/apis/search_api/api_reference.html
        var gnipErr = {
          statusCode: response.statusCode,
          url: requestOptions.url,
          parameters: requestOptions.form,
          error: err?err:body?body.error:'Unknown Error'
        };
        callback(gnipErr, null, null);
      }
    });
  }

  this.search = function(optionsOrQuery, callback) {
    doQuery(optionsOrQuery, false, false, callback);
  };

  this.next = function(optionsOrQuery, callback) {
    doQuery(optionsOrQuery, false, true, callback);
  };

  this.estimate = function(optionsOrQuery, callback) {
    doQuery(optionsOrQuery, true, false, callback);
  };
}

module.exports = exports = GnipReader;
