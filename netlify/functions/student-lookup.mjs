const json = (status, body) => Response.json(body, { status });

export default async (request) => {
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!scriptUrl || !secret) {
    return json(503, { ok: false, error: 'Student verification is not configured yet. Please contact the course coordinator.' });
  }

  try {
    const { identifier } = await request.json();
    const cleanedIdentifier = String(identifier || '').trim().replace(/\s/g, '').toUpperCase();
    if (!cleanedIdentifier) {
      return json(400, { ok: false, error: 'Enter an Enrollment No./PRN or admission number.' });
    }

    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      // Apps Script occasionally leaves a reused upstream connection open.
      // Request a self-contained response for reliable serverless invocations.
      headers: {
        'content-type': 'text/plain;charset=utf-8',
        connection: 'close',
        'accept-encoding': 'identity',
      },
      body: JSON.stringify({ action: 'lookupStudent', identifier: cleanedIdentifier, secret }),
    });
    const raw = await upstream.text();
    const normalized = raw.trim().replace(/^\)\]\}'\s*/, '');
    let result;
    try {
      result = JSON.parse(normalized);
    } catch {
      return json(502, { ok: false, error: 'The student-verification service returned an invalid response. Please contact the course coordinator.' });
    }

    return json(result.ok ? 200 : 400, result);
  } catch (error) {
    console.error('Student lookup proxy failed:', error);
    return json(502, { ok: false, error: 'Unable to verify the student right now. Please try again.' });
  }
};
