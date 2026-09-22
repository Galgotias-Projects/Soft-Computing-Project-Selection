import { postToAppsScript } from './apps-script.mjs';

const json = (status, body) => Response.json(body, {
  status,
  headers: {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  },
});

export default async (request) => {
  if (request.method === 'OPTIONS') return json(204, {});
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!scriptUrl || !secret) {
    return json(503, { ok: false, error: 'Student verification is not configured yet. Please contact the course coordinator.' });
  }

  try {
    const { admissionNumber } = await request.json();
    const identifier = String(admissionNumber || '').trim().replace(/\s/g, '').toUpperCase();
    if (!/^\d{2}[A-Z]{2,8}\d{5,8}$/.test(identifier)) {
      return json(400, { ok: false, error: 'Enter a valid admission number, for example 24SCSE1410306.' });
    }

    const upstream = await postToAppsScript(scriptUrl, { action: 'lookupStepOne', admissionNumber: identifier, secret });
    const normalized = upstream.raw.trim().replace(/^\)\]\}'\s*/, '');
    const result = JSON.parse(normalized);
    return json(result.ok ? 200 : (upstream.status >= 500 ? 502 : 400), result);
  } catch (error) {
    console.error('Step 1 lookup failed:', error);
    return json(502, { ok: false, error: 'Unable to verify the team right now. Please try again.' });
  }
};
