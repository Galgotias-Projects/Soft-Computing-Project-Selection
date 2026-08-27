const json = (status, body) => Response.json(body, { status });

export default async (request) => {
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!scriptUrl || !secret) {
    return json(503, { ok: false, error: 'Registration is not configured yet. Please contact the course coordinator.' });
  }

  try {
    const payload = await request.json();
    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, secret }),
    });
    const raw = await upstream.text();
    // Apps Script can prefix JSON with an XSSI guard. Keep a short, non-sensitive
    // server-side trace so a deployment or access-page response can be diagnosed.
    const normalized = raw.trim().replace(/^\)\]\}'\s*/, '');
    console.info('Apps Script response', {
      status: upstream.status,
      contentType: upstream.headers.get('content-type'),
      redirected: upstream.redirected,
      finalUrl: upstream.url,
      preview: normalized.slice(0, 300),
    });
    let result;
    try {
      result = JSON.parse(normalized);
    } catch {
      return json(502, {
        ok: false,
        error: 'The registration service returned an invalid response. Please contact the course coordinator.',
      });
    }

    return json(result.ok ? 200 : 400, result);
  } catch (error) {
    console.error('Registration proxy failed:', error);
    return json(502, { ok: false, error: 'Unable to reach the registration service. Please try again.' });
  }
};
