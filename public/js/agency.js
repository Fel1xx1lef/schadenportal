// Shared helper: fetch with session auth + CSRF header
function api(url, opts = {}) {
  const { headers, ...rest } = opts;
  return fetch(url, {
    credentials: 'same-origin',
    ...rest,
    headers: { 'X-Requested-With': 'XMLHttpRequest', ...(headers || {}) }
  }).then(async res => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.status);
    return data;
  });
}
