const json = (status, body) => Response.json(body, { status });
const GITHUB_USERNAME = /^[A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?$/;
const githubChecks = new Map();

async function githubUserExists(username) {
  const key = username.toLowerCase();
  if (githubChecks.has(key)) return githubChecks.get(key);

  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'GU-Soft-Computing-Project-Selection',
    },
  });

  if (response.status === 404) {
    githubChecks.set(key, false);
    return false;
  }
  if (!response.ok) throw new Error('GitHub verification is temporarily unavailable. Please try again in a few minutes.');

  githubChecks.set(key, true);
  return true;
}

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
    const members = payload?.team?.members;
    if (!Array.isArray(members) || members.length < 3 || members.length > 4) {
      return json(400, { ok: false, error: 'A team must contain 3 or 4 members.' });
    }

    const usernames = [...new Set(members.map((member) => String(member?.github || '').trim()))];
    if (usernames.length !== members.length || usernames.some((username) => username.length < 2 || !GITHUB_USERNAME.test(username))) {
      return json(400, { ok: false, error: 'Each member needs a distinct, valid GitHub username (not a profile link).' });
    }

    const githubResults = await Promise.all(usernames.map(async (username) => ({ username, exists: await githubUserExists(username) })));
    const missingGitHubUser = githubResults.find((result) => !result.exists);
    if (missingGitHubUser) {
      return json(400, { ok: false, error: `GitHub user “${missingGitHubUser.username}” could not be found. Enter the exact public GitHub username.` });
    }

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
