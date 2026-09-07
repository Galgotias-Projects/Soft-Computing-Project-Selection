import { getFromAppsScript } from './apps-script.mjs';

const json = (status, body) => Response.json(body, { status });

export default async (request) => {
  if (request.method !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return json(503, { ok: false, error: 'Live project availability is not configured yet.' });
  }

  try {
    const upstream = await getFromAppsScript(scriptUrl);
    const normalized = upstream.raw.trim().replace(/^\)\]\}'\s*/, '');
    const result = JSON.parse(normalized);
    if (!Array.isArray(result.projects)) {
      return json(502, { ok: false, error: 'The availability service returned an invalid response.' });
    }

    const projects = result.projects.map((project) => ({
      id: String(project.id || ''),
      max: Number(project.max),
      reserved: Number(project.reserved),
      remaining: Number(project.remaining),
      availability: String(project.availability || ''),
    }));

    return json(200, { ok: true, projects });
  } catch (error) {
    console.error('Project capacity proxy failed:', error);
    return json(502, { ok: false, error: 'Live project availability could not be loaded.' });
  }
};
