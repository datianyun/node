// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var common = require('../common');
var assert = require('assert');

var http = require('http');


var serverSockets = [];
var server = http.createServer(function(req, res) {
  if (serverSockets.indexOf(req.socket) === -1) {
    serverSockets.push(req.socket);
  }
  res.end(req.url);
});
server.listen(common.PORT);

var agent = http.Agent({
  keepAlive: true,
  maxSockets: 5,
  maxFreeSockets: 2
});

// make 10 requests in parallel,
// then 10 more when they all finish.
function makeReqs(n, cb) {
  for (var i = 0; i < n; i++)
    makeReq(i, then)

  function then(er) {
    if (er)
      return cb(er);
    else if (--n === 0)
      setTimeout(cb);
  }
}

function makeReq(i, cb) {
  agent.request({ port: common.PORT, path: '/' + i }, function(res) {
    var data = '';
    res.setEncoding('ascii');
    res.on('data', function(c) {
      data += c;
    });
    res.on('end', function() {
      assert.equal(data, '/' + i);
      cb();
    });
  }).end();
}

var closed = false;
makeReqs(10, function(er) {
  assert.ifError(er);
  assert.equal(count(agent.freeSockets), 2);
  assert.equal(count(agent.sockets), 0);
  assert.equal(serverSockets.length, 5);

  // now make 10 more reqs.
  // should use the 2 free reqs from the pool first.
  makeReqs(10, function(er) {
    assert.ifError(er);
    assert.equal(count(agent.freeSockets), 2);
    assert.equal(count(agent.sockets), 0);
    assert.equal(serverSockets.length, 8);

    agent.destroy();
    server.close(function() {
      closed = true;
    });
  });
});

function count(sockets) {
  return Object.keys(sockets).reduce(function(n, name) {
    return n + sockets[name].length;
  }, 0);
}

process.on('exit', function() {
  assert(closed);
  console.log('ok');
});
