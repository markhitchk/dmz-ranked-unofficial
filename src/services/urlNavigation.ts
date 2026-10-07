export function normalizeBrowserUrlInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function formatCollapsedBrowserUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '');
    let path = parsed.pathname || '';
    if (path === '/') path = '';
    else if (path.endsWith('/')) path = path.slice(0, -1);
    return `${host}${path}${parsed.search}${parsed.hash}`;
  } catch {
    return trimmed.replace(/^https?:\/\//i, '');
  }
}

export function isDmzRankedUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      (host === 'dmzranked.com' || host.endsWith('.dmzranked.com'))
    );
  } catch {
    return false;
  }
}
