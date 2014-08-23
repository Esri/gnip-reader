var request = require('request'),
    util = require('util'),
    _ = require('lodash'),
    moment = require('moment');


// For Gnip settings, see:
//    http://support.gnip.com/apis/search_api/api_reference.html#SearchRequests
var gnipTimeFormat = 'YYYYMMDDHHmm',
    gnipDefaultPagesize = 100, // Gnip default as of 2014.08.23
    gnipMinPagesize = 10,      // Gnip min as of 2014.08.23
    gnipMaxPagesize = 500;     // Gnip max as of 2014.08.23


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

  function limitPageSize(options) {
    if (options.hasOwnProperty('maxResults') &&
        {}.toString.call(options.maxResults) === '[object Number]' &&
        Math.round(options.maxResults) === options.maxResults) {
      options.maxResults = Math.min(gnipMaxPagesize, Math.max(gnipMinPagesize, options.maxResults));
    }
  }

  function getPageSize(options) {
    if (options.hasOwnProperty('maxResults') &&
        {}.toString.call(options.maxResults) === '[object Number]' &&
        Math.round(options.maxResults) === options.maxResults) {
      return options.maxResults;
    } else {
      return gnipDefaultPagesize;
    }
  }

  function optimizePagesize(options, numberRequested) {
    if (!options.hasOwnProperty('maxResults')) {
      options.maxResults = Math.max(gnipMinPagesize, Math.min(gnipMaxPagesize, numberRequested));
    }
  }


  function parseOptions(options) {
    if ({}.toString.call(options) === '[object String]') {
      options = {
        query: options
      };
    } else {
      parseDates(options);
      limitPageSize(options);
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

  this.fullSearch = function(optionsOrQuery, maxRecords, pageCallback, finalCallback) {
    var totalRecords = [],
        uniqueIds = [],
        pageNumber = 0;

    if ({}.toString.call(pageCallback) !== '[object Function]') {
      // The caller must specify a page callback, even if it just returns true.
      // This is to ensure that the caller consciously burns through their 
      // Gnip allowance, and not by omission or mistake.
      return finalCallback('You must provide a pageCallback() function, ' +
                    'which must return true to load the next page of records, ' +
                    'or false to stop loading.', null);
    }

    if (maxRecords !== null &&
        {}.toString.call(maxRecords) !== '[object Number]' ||
        Math.round(maxRecords) !== maxRecords ||
        maxRecords < 1) {
      return finalCallback('You must provide an integer maxRecord value (or null to retrieve all records)', null);
    }

    var options = parseOptions(optionsOrQuery);
    optimizePagesize(options, maxRecords);

    doQuery(options, false, false, function loadNextPage(err, pageData, morePages) {
      if (!err) {
        pageNumber += 1;
        var duplicates = _.remove(pageData, function(gnipRecord) {
          return _.contains(uniqueIds, gnipRecord.id);
        });
        if (duplicates.length > 0) {
          console.log('Page ' + pageNumber + ' had ' + duplicates.length + ' duplicate(s)');
          console.log(_.pluck(duplicates, 'id'));
        }
        totalRecords = totalRecords.concat(pageData);
        uniqueIds = uniqueIds.concat(_.pluck(pageData, 'id'));

        var continueRequested = pageCallback(pageData, pageNumber);
        var finished = true;

        if (morePages && continueRequested && maxRecords > totalRecords.length) {
          finished = false;
          if (maxRecords - totalRecords.length < getPageSize(options)) {
            // Don't get more tweets than we asked for
            options.maxResults = maxRecords - totalRecords.length;
          }
          doQuery(options, false, true, loadNextPage);
        }

        if (finished) {
          return finalCallback(null, totalRecords);
        }
      } else {
        return finalCallback(err, totalRecords);
      }
    });
  };

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
