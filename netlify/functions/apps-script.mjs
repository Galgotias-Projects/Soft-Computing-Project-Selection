import https from 'node:https';

const MAX_REDIRECTS = 3;

function request(urlValue, method, body, redirects = 0) {
  const url = new URL(urlValue);

  return new Promise((resolve, reject) => {
    const requestBody = method === 'GET' ? '' : body;
    const requestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method,
      agent: false,
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-encoding': 'identity',
        connection: 'close',
        ...(requestBody ? {
          'content-type': 'text/plain;charset=utf-8',
          'content-length': Buffer.byteLength(requestBody),
        } : {}),
      },
    };

    const upstream = https.request(requestOptions, (response) => {
      const status = response.statusCode || 502;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location && redirects < MAX_REDIRECTS) {
        response.resume();
        const nextUrl = new URL(location, url).toString();
        const preserveMethod = status === 307 || status === 308;
        resolve(request(nextUrl, preserveMethod ? method : 'GET', preserveMethod ? body : '', redirects + 1));
        return;
      }

      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => resolve({ status, raw }));
      response.on('error', reject);
    });

    upstream.setTimeout(12000, () => upstream.destroy(new Error('Apps Script did not respond in time.')));
    upstream.on('error', reject);
    if (requestBody) upstream.write(requestBody);
    upstream.end();
  });
}

export function postToAppsScript(scriptUrl, payload) {
  return request(scriptUrl, 'POST', JSON.stringify(payload));
}
