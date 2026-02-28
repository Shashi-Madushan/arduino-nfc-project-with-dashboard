const { getLocalDateStr } = require('./lib/date_mock.js');
console.log(getLocalDateStr(new Date()));
console.log(new Date().toISOString().slice(0, 10));
