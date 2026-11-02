// CloudFront Function (viewer-request) for the default behaviour: client-side
// routes such as /movies/<id> have no file in S3, so any path whose last
// segment has no extension is served index.html. /api/* never reaches this
// function (its own behaviour routes it to the ALB); the guard is belt and braces.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.startsWith('/api/')) {
    return request;
  }

  if (uri.endsWith('/')) {
    request.uri = '/index.html';
    return request;
  }

  var last = uri.split('/').pop();
  if (last.indexOf('.') === -1) {
    request.uri = '/index.html';
  }

  return request;
}
