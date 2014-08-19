var GnipReader = require('./index'),
    moment = require('moment'),
    async = require('async');

var username = 'your-gnip-login-email-address',
    password = 'your-gnip-login-password',
    account  = 'your-gnip-account-name',
    stream   = 'your-gnip-stream-name';

var query = 'esri';

var startTime = moment().startOf('day');
var endTime = moment(startTime).add(12, 'hours');
var complexQuery = {query: query, maxResults: 10, fromDate: startTime, toDate: endTime};


var myReader = new GnipReader(username, password, account, stream);


myReader.search(complexQuery, function(err, gnipRecords, moreRecords) {
  if (!err) {
    console.log('Got ' + gnipRecords.length + ' Gnip Records. There are ' + 
                (moreRecords?'':'no ') + 'more records.');
    if (moreRecords) {
      var count = 2,
          totalRecords = gnipRecords;

      var getMoreRecords = function() {
        myReader.next(complexQuery, function(err, gnipRecords, moreRecords) {
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

myReader.estimate(query, function(err, gnipEstimates) {
  if (err) {
    console.error(err);
  } else {
    console.log('Got ' + gnipEstimates.length + ' Gnip Estimates.');
  }
});

myReader.search(complexQuery, function(err, gnipRecords, moreRecords) {
  if (err) {
    console.error(err);
  } else {
    console.log('Got ' + gnipRecords.length + ' Gnip Records. There are ' + (moreRecords?'':'no ') + 'more records.');
    if (moreRecords) {
      var count = 2,
          totalRecords = gnipRecords;

      async.whilst(
        function() { return moreRecords; },
        function(callback) {
          myReader.next(complexQuery, function(err, gnipRecords, getAnotherPage) {
            if (!err) {
              console.log('Page ' + count++ + ': ' + gnipRecords.length + ' more records');
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
