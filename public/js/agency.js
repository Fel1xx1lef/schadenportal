// Shared helper: fetch with session auth + CSRF header
function api(url, opts = {}) {
  return fetch(url, {
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest', ...(opts.headers || {}) },
    ...opts
  }).then(async res => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.status);
    return data;
  });
}
