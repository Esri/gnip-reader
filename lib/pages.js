/// Page handling
// See http://support.gnip.com/apis/search_api/api_reference.html#SearchRequests
var gnipDefaultPagesize = 100, // Gnip default as of 2014.08.23
    gnipMinPagesize = 10,      // Gnip min as of 2014.08.23
    gnipMaxPagesize = 500;     // Gnip max as of 2014.08.23

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
    var num = numberRequested!==null?numberRequested:gnipMaxPagesize;
    options.maxResults = Math.max(gnipMinPagesize, Math.min(gnipMaxPagesize, num));
    console.log('Optimized page size to: ' + options.maxResults);
  }
}

module.exports.limitPageSize = limitPageSize;
module.exports.getPageSize = getPageSize;
module.exports.optimizePagesize = optimizePagesize;
