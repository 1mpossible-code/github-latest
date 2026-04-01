const CACHE_SECONDS = 300;
const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37})$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/u\/([^/]+)\/latest\/(commit|issue|pr)$/);

    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    const username = match[1];
    const type = match[2];

    if (!USERNAME_PATTERN.test(username)) {
      return new Response('Invalid GitHub username', { status: 400 });
    }

    const backUrl = getSafeBackUrl(url.searchParams.get('back'), username);

    try {
      const targetUrl = await resolveLatestUrl({ request, env, username, type });

      if (!targetUrl) {
        return renderNoResultPage({ username, type, backUrl });
      }

      return Response.redirect(targetUrl, 302);
    } catch (error) {
      return renderNoResultPage({
        username,
        type,
        backUrl,
        errorMessage: error instanceof Error ? error.message : 'Unable to resolve link.',
      });
    }
  },
};

async function resolveLatestUrl({ request, env, username, type }) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);

  if (cached) {
    const body = await cached.text();
    return body || null;
  }

  let targetUrl = null;

  if (type === 'commit') {
    targetUrl = await fetchLatestCommitUrl({ env, username });
  }

  if (type === 'issue') {
    targetUrl = await fetchLatestIssueUrl({ env, username });
  }

  if (type === 'pr') {
    targetUrl = await fetchLatestPrUrl({ env, username });
  }

  const response = new Response(targetUrl ?? '', {
    headers: {
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });

  await cache.put(cacheKey, response.clone());

  return targetUrl;
}

async function fetchLatestCommitUrl({ env, username }) {
  const events = await githubRequest(env, `/users/${username}/events/public?per_page=100`);
  const pushEvent = events.find((event) => event.type === 'PushEvent' && Array.isArray(event.payload?.commits) && event.payload.commits.length > 0);

  if (!pushEvent) {
    return null;
  }

  const latestCommit = pushEvent.payload.commits[pushEvent.payload.commits.length - 1];
  return `https://github.com/${pushEvent.repo.name}/commit/${latestCommit.sha}`;
}

async function fetchLatestIssueUrl({ env, username }) {
  const data = await githubRequest(
    env,
    `/search/issues?q=${encodeURIComponent(`author:${username} is:issue`)}&sort=updated&order=desc&per_page=1`
  );

  return data.items?.[0]?.html_url ?? null;
}

async function fetchLatestPrUrl({ env, username }) {
  const data = await githubRequest(
    env,
    `/search/issues?q=${encodeURIComponent(`author:${username} is:pr`)}&sort=updated&order=desc&per_page=1`
  );

  return data.items?.[0]?.html_url ?? null;
}

async function githubRequest(env, path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'github-latest-links',
      ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  return response.json();
}

function getSafeBackUrl(rawBackUrl, username) {
  if (!rawBackUrl) {
    return `https://github.com/${username}`;
  }

  try {
    const parsed = new URL(rawBackUrl);

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return `https://github.com/${username}`;
  }

  return `https://github.com/${username}`;
}

function renderNoResultPage({ username, type, backUrl, errorMessage }) {
  const title = `No public ${type} found`;
  const subtitle = errorMessage
    ? `The latest ${type} could not be resolved right now.`
    : `No recent public ${type} was found for @${escapeHtml(username)}.`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #050505;
        --panel: #111111;
        --text: #f5f5f5;
        --muted: #a6a6a6;
        --border: rgba(255,255,255,0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: Inter, Arial, sans-serif;
        color: var(--text);
        background: radial-gradient(circle at top, rgba(255,255,255,0.06), transparent 28%), var(--bg);
      }
      .card {
        width: min(560px, 100%);
        padding: 28px;
        border-radius: 24px;
        background: var(--panel);
        border: 1px solid var(--border);
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      }
      p {
        color: var(--muted);
        line-height: 1.6;
      }
      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 0 18px;
        border-radius: 999px;
        text-decoration: none;
        color: #050505;
        background: #f5f5f5;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <section class="card">
      <h1>${title}</h1>
      <p>${subtitle}</p>
      ${errorMessage ? `<p>${escapeHtml(errorMessage)}</p>` : ''}
      <a href="${escapeHtml(backUrl)}">Go back</a>
    </section>
  </body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
