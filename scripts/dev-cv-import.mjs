import http from 'node:http';
import handler from '../netlify/functions/cvImport.mjs';
const server = http.createServer(async (req, res) => {
  if (req.url?.split('?')[0] !== '/.netlify/functions/cvImport') {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers,
      ...(['GET', 'HEAD'].includes(req.method) ? {} : {
        body: req,
        duplex: 'half'
      })
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({
      ok: false,
      message: 'Local CV processing failed. Check the documented setup.'
    }));
  }
});
server.listen(8889, '127.0.0.1', () => console.log('CV upload server ready at http://127.0.0.1:8889 (no document logging).'));
