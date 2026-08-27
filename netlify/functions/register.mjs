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
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return json(502, { ok: false, error: 'The registration service returned an invalid response.' });
    }

    return json(result.ok ? 200 : 400, result);
  } catch (error) {
    console.error('Registration proxy failed:', error);
    return json(502, { ok: false, error: 'Unable to reach the registration service. Please try again.' });
  }
};
