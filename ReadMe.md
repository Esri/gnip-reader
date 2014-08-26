gnip-reader
===========

A simple node package to read gnip records from a Gnip Search URL.

## Requirements
* [node.js](http://nodejs.org)
* A Gnip account.

## Usage
Initialize a `GnipReader` object with `username`, `password`, `account name`, and `stream name`.

For example, if your account name is `FooInc` and your stream name is `test`, your query URL will be `https://search.gnip.com/accounts/FooInc/search/test.json`. Create your `GnipReader` like this:

``` JavaScript
var GnipReader = require('gnip-reader');
var myReader = new GnipReader('foo@fooinc.com', 'bar', 'FooInc', 'test');
```

### Querying Gnip

Call `.fullSearch(query, recordLimit, pageCallback(gnipRecords, pageNumber), finalCallback(err, allRecords))` to retrieve records page-by-page.

* `query` can either be a simple string as specified [here](http://support.gnip.com/apis/powertrack/rules.html) or an object providing parameters as specified [here](http://support.gnip.com/apis/search_api/api_reference.html#SearchRequests).
* `recordLimit` is the max total number of records you want to retrieve matching the query. Pass `null` to keep paging until the query results are exhausted (or until `pageCallback()` stops paging - see below). Use this to avoid burning through your Gnip allowance (tweets and requests).
* `pageCallback()` should return `true` to get more records, or `false` to stop paging.
    * `gnipRecords` is an array of raw Gnip records for this page.
    * `pageNumber` starts at 1.
* `finalCallback()` when retrieving has completed. `allRecords` will contain all the records retrieved up to that point. Unless an error caused the retrieval to complete, `err` will be `null`.

For example, the following will return all mentions of 'esri' in the past 30 days:
``` JavaScript
myReader.fullSearch('esri', null, function(data, pageNum) {
  console.log(data.length + ' records in page ' + pageNum);
  return true; 
}, function(err, allData) {
  if (!err) {
    console.log('Got ' + allData.length + ' records!');
  } else {
    console.error(err);
  }
});
```

`.fullSearch()` will optimize page sizes according to published Gnip ranges (currently 10...500 records per page) and any value passed into `recordLimit`. It will attempt to minimize requests, and if possible minimize tweets requested.

`.fullSearch()` will also detect duplicate tweets (by id) across pages. If you use `.search()` and `.next()` manually (see below), duplicates are not detected automatically.

### Manual query and paging
If for some reason fullSearch doesn't cut it for you, you can use `.search()` and `.next()` to page through results manually.

#### Initial query
Call `.search(query, callback(err, gnipRecords, moreRecordsAvailable))` to retrieve records for a given query.

* `query` can either be a simple string as specified [here](http://support.gnip.com/apis/powertrack/rules.html) or an object providing parameters as specified [here](http://support.gnip.com/apis/search_api/api_reference.html#SearchRequests).
* `callback()` should be a function that accepts 3 parameters:
    * `err`: An error object (or null). See below.
    * `gnipRecords`: An array of Gnip records as described [here](http://support.gnip.com/sources/twitter/data_format.html#SamplePayloads) (or null if `err` is not null).
    * `moreRecordsAvailable`: `true` if there are more records to retrieve for this query. `false` otherwise.

For example:

``` JavaScript
myReader.search('esri', function(err, gnipRecords, moreRecords) {
  if (err) {
    console.error(err);
  } else {
    console.log('Got ' + gnipRecords.length + ' Gnip Records. There are ' + 
                (moreRecords?'':'no ') + 'more records.');
  }
});
```

#### Get subsequent pages
If `moreRecordsAvailable` is `true`, you can get pages of subsequent records with `.next()`, which takes the same parameters as `.search()`.

**Note:** As specified by Gnip, the `query` should not be modified between calls to `.search()` and `.next()` or between calls to `.next()` and `.next()`.

``` JavaScript
myReader.search('esri', function(err, gnipRecords, moreRecords) {
  if (!err) {
    console.log('Got ' + gnipRecords.length + ' Gnip Records. There are ' + 
                (moreRecords?'':'no ') + 'more records.');
    if (moreRecords) {
      var count = 2,
          totalRecords = gnipRecords;

      var getMoreRecords = function() {
        myReader.next('esri', function(err, gnipRecords, moreRecords) {
          if (!err) {
            console.log('Page ' + count++ + ': ' + gnipRecords.length + ' more records');
            totalRecords = totalRecords.concat(gnipRecords);
            if (moreRecords) {
              getMoreRecords();
            } else {
              console.log('Got a total of ' + totalRecords.length + ' records!');
            }
          } else {
            console.error('Error geting page ' + --count + '. Aborting: ' + err);
          }
        });
      };

      // Kick off loading additional pages…
      getMoreRecords();
    }
  } else {
    console.error(err);
  }
});
```

Or, using [Async.js](https://github.com/caolan/async)…

``` JavaScript
var async = require('async');

myReader.search('esri', function(err, gnipRecords, moreRecords) {
  if (err) {
    console.error(err);
  } else {
    console.log('Got ' + gnipRecords.length + ' Gnip Records. There are ' + 
                (moreRecords?'':'no ') + 'more records.');
    if (moreRecords) {
      var count = 2,
          totalRecords = gnipRecords;

      async.whilst(
        function() { return moreRecords; },
        function(callback) {
          myReader.next('esri', function(err, gnipRecords, getAnotherPage) {
            if (!err) {
              console.log('Page ' + count++ + ': ' + gnipRecords.length + 
                          ' more records');
              totalRecords = totalRecords.concat(gnipRecords);
              moreRecords = getAnotherPage;              
            }
            callback(err);
          });
        },
        function(err) {
          if (err) {
            console.error('Error geting page ' + --count + '. Aborting: ' + err);
          } else {
            console.log('Got a total of ' + totalRecords.length + ' records!');
          }
        }
      );
    }
  }
});
```

### Getting record count estimates
Call `.estimate(query, callback(err, gnipEstimates))` to retrieve time-partitioned counts for the query.

* `query` can either be a simple string as specified [here](http://support.gnip.com/apis/powertrack/rules.html) or an object providing parameters as specified [here](http://support.gnip.com/apis/search_api/api_reference.html#SearchRequests).
* `callback()` should be a function that accepts 2 parameters:
    * `err`: An error object (or null). See below.
    * `gnipEstimates`: An array of Gnip Estimates as described [here](http://support.gnip.com/apis/search_api/api_reference.html#CountRequests) (or null if `err` is not null).

``` JavaScript
myReader.estimate('esri', function(err, gnipEstimates) {
  if (err) {
    console.error(err);
  } else {
    console.log('Got ' + gnipEstimates.length + ' Gnip Estimates.');
  }
});
```

##Query format
A `query` parameter to `.search()`, `.next()`, and `.estimate()` can be a single-line string as described [here](http://support.gnip.com/apis/powertrack/rules.html), or an object with parameters as described [here](http://support.gnip.com/apis/search_api/api_reference.html#SearchRequests).

Note that `fromDate` and `toDate` can be one of the following:

* A JavaScript `Date` object.
* A [moment-js](http://momentjs.com) `moment`.
* A string in the Gnip date format 'YYYYMMDDHHmm'.
* A string that can be [parsed by moment-js](http://momentjs.com/docs/#/parsing/string/) to a valid date.

Here is a sample complex query that searches for 'esri' today, and returns pages of 10 records at a time:

``` JavaScript
var moment = require('moment');

var startTime = moment().startOf('day');
var endTime = new Date();

var complexQuery = {
  query: 'esri', 
  maxResults: 10, 
  fromDate: startTime, 
  toDate: endTime
};
```

##Error format
Errors are an object of the following structure:

``` JavaScript
{ 
  statusCode: <int>,
  url: <searchStreamUrl>,
  parameters: <stringifiedJSON>,
  error: { // As returned from Gnip
    message: <ErrorString>,
    sent: <UTCTimeString>
  }
}
```

For example:

``` JavaScript
{ 
  statusCode: 422,
  url: 'https://search.gnip.com/accounts/FooInc/search/test.json',
  parameters: '{"query":"esri","maxResults":10,"fromDate":"201408190000","toDate":"201408200000","publisher":"twitter"}',
  error: { 
    message: 'Could not accept your search request: Invalid date for query parameter \'toDate\'. Can\'t ask for activities from the future.\n',
    sent: '2014-08-19T22:22:49+00:00'
  }
}
```

##Known Limitations
* If `fromDate` and `toDate` are strings and fail to parse, an exception is thrown.
* In edge-cases, while paging manually with `.search()` and `.next()`, [Gnip can return duplicate records](http://support.gnip.com/apis/search_api/api_reference.html#SearchRequests) across pages. `gnip-reader` does not detect these duplicates. Duplicates are detected (by id) and removed when using `.fullSearch()`.

## Resources

* [node.js documentation](http://nodejs.org/api/)
* [Gnip Documentation](http://support.gnip.com/sources/twitter/data_format.html) (incomplete - not all the attributes that are returned are described in this documentation).

###Dependencies
gnip-reader makes use of the following amazing packages:

* [Request-JS](https://github.com/mikeal/request)
* [Moment-JS](http://momentjs.com)
* [LoDash](http://lodash.com)

## Issues

Find a bug or want to request a new feature?  Please let us know by submitting an Issue.

## Contributing

Anyone and everyone is welcome to contribute. 

## Licensing
Copyright 2014 Esri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A copy of the license is available in the repository's [license.txt](license.txt) file.
[](Esri Tags: NodeJS REST Gnip)
[](Esri Language: JavaScript)
