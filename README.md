# GitHub Latest Links

Generate stable links for a GitHub profile README that always redirect to a user's latest public commit, issue, and pull request.

The project has two parts:

- A static generator page for GitHub Pages
- A Cloudflare Worker that resolves dynamic links and redirects to GitHub

## What It Does

Given a GitHub username, the generator creates links like:

- `https://your-worker.workers.dev/u/octocat/latest/commit`
- `https://your-worker.workers.dev/u/octocat/latest/issue`
- `https://your-worker.workers.dev/u/octocat/latest/pr`

Those links can be pasted into a profile README once and never updated again.

Example:

```md
If you want to know what I am working on, this is my [latest commit](https://your-worker.workers.dev/u/octocat/latest/commit?back=https%3A%2F%2Fgithub.com%2Foctocat), [latest issue](https://your-worker.workers.dev/u/octocat/latest/issue?back=https%3A%2F%2Fgithub.com%2Foctocat), and [latest PR](https://your-worker.workers.dev/u/octocat/latest/pr?back=https%3A%2F%2Fgithub.com%2Foctocat).
```

## How It Works

- `latest PR`: GitHub Search API, most recently updated public PR by author
- `latest issue`: GitHub Search API, most recently updated public issue by author
- `latest commit`: the newest commit found in the user's recent public `PushEvent`s
- If nothing is found, the Worker renders a small no-result page with a `Go back` button

## Project Structure

- `index.html`: GitHub Pages generator UI
- `styles.css`: black-and-white site styling
- `script.js`: generator logic and copy actions
- `worker/src/index.js`: Cloudflare Worker
- `worker/wrangler.toml`: Worker config

## Deploy

### 1. Deploy the Worker

1. Create a Cloudflare Worker project from the `worker/` folder.
2. Update `worker/wrangler.toml` with your Worker name.
3. Add a GitHub token as a secret:

   ```bash
   cd worker
   npx wrangler secret put GITHUB_TOKEN
   ```

4. Deploy:

   ```bash
   npx wrangler deploy
   ```

The token only needs read access to public GitHub data.

### 2. Deploy the Generator Page

1. Put this repo on GitHub.
2. Enable GitHub Pages for the repository.
3. Serve from the root.
4. Open the site at `https://<user>.github.io/<repo>/`.
5. Enter your Worker URL in the generator.

## Local Development

Worker:

```bash
cd worker
npm install
npm run dev
```

Static page:

- Open `index.html` directly, or
- Serve the repo with any static server

## Notes

- The Worker uses `workers.dev` by default.
- `latest commit` is based on recent public activity, which is the most practical public signal for "what I'm working on now".
- The `back` query parameter is optional. If present, it powers the no-result page button.
