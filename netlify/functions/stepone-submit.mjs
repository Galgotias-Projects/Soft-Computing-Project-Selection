import { postToAppsScript } from './apps-script.mjs';

const DEADLINE = Date.parse('2026-09-26T23:59:59+05:30');
const REPOSITORY_URL = /^https:\/\/github\.com\/([A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?)\/([A-Za-z\d._-]+)\/?$/i;
const json = (status, body) => Response.json(body, {
  status,
  headers: {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  },
});

async function publicRepositoryExists(owner, repository) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'GU-Soft-Computing-Step-One',
    },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error('GitHub verification is temporarily unavailable. Please try again in a few minutes.');

  const details = await response.json();
  return !details.private && !details.archived;
}

export default async (request) => {
  if (request.method === 'OPTIONS') return json(204, {});
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });
  if (Date.now() > DEADLINE) {
    return json(403, { ok: false, error: 'The Step 1 submission deadline has passed. Please contact the course coordinator.' });
  }

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!scriptUrl || !secret) {
    return json(503, { ok: false, error: 'Step 1 submission is not configured yet. Please contact the course coordinator.' });
  }

  try {
    const payload = await request.json();
    const admissionNumber = String(payload?.admissionNumber || '').trim().replace(/\s/g, '').toUpperCase();
    const repositoryUrl = String(payload?.repositoryUrl || '').trim().replace(/\/+$/, '');
    const match = REPOSITORY_URL.exec(repositoryUrl);
    if (!/^\d{2}[A-Z]{2,8}\d{5,8}$/.test(admissionNumber)) {
      return json(400, { ok: false, error: 'Enter a valid team leader admission number.' });
    }
    if (!match) {
      return json(400, { ok: false, error: 'Enter the full repository URL, for example https://github.com/owner/repository.' });
    }

    const repositoryExists = await publicRepositoryExists(match[1], match[2]);
    if (!repositoryExists) {
      return json(400, { ok: false, error: 'That GitHub repository could not be found as an active public repository. Check the link and its visibility.' });
    }

    const upstream = await postToAppsScript(scriptUrl, { action: 'submitStepOne', admissionNumber, repositoryUrl, secret });
    const normalized = upstream.raw.trim().replace(/^\)\]\}'\s*/, '');
    const result = JSON.parse(normalized);
    return json(result.ok ? 200 : (upstream.status >= 500 ? 502 : 400), result);
  } catch (error) {
    console.error('Step 1 submission failed:', error);
    return json(502, { ok: false, error: 'Unable to submit Step 1 right now. Please try again.' });
  }
};
