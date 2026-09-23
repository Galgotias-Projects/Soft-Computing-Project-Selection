async function request(scriptUrl, method, payload) {
  const body = method === 'GET' ? undefined : JSON.stringify(payload);
  const response = await fetch(scriptUrl, {
    method,
    redirect: 'follow',
    headers: {
      accept: 'application/json, text/plain, */*',
      ...(body ? { 'content-type': 'text/plain;charset=utf-8' } : {}),
    },
    body,
  });
  return { status: response.status, raw: await response.text() };
}

export function postToAppsScript(scriptUrl, payload) {
  return request(scriptUrl, 'POST', payload);
}

export function getFromAppsScript(scriptUrl) {
  return request(scriptUrl, 'GET');
}
