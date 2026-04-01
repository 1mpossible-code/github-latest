const form = document.querySelector('#generator-form');
const usernameInput = document.querySelector('#username');
const workerUrlInput = document.querySelector('#worker-url');
const formMessage = document.querySelector('#form-message');
const results = document.querySelector('#results');
const snippet = document.querySelector('#snippet');
const WORKER_URL_STORAGE_KEY = 'github-latest-links.worker-url';

const linkTargets = {
  commit: document.querySelector('#commit-link'),
  issue: document.querySelector('#issue-link'),
  pr: document.querySelector('#pr-link'),
};

function normalizeUsername(value) {
  return value.trim().replace(/^@/, '');
}

function normalizeWorkerUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

function isValidUsername(value) {
  return /^[a-z\d](?:[a-z\d-]{0,37})$/i.test(value);
}

function buildRoute(baseUrl, username, type) {
  const back = encodeURIComponent(`https://github.com/${username}`);
  return `${baseUrl}/u/${username}/latest/${type}?back=${back}`;
}

function buildSnippet(username, routes) {
  return `If you want to know what I am working on, this is my [latest commit](${routes.commit}), [latest issue](${routes.issue}), and [latest PR](${routes.pr}).`;
}

function setMessage(message) {
  formMessage.textContent = message;
}

async function copyText(value, successMessage) {
  await navigator.clipboard.writeText(value);
  setMessage(successMessage);
}

function loadSavedWorkerUrl() {
  const savedWorkerUrl = window.localStorage.getItem(WORKER_URL_STORAGE_KEY);

  if (savedWorkerUrl) {
    workerUrlInput.value = savedWorkerUrl;
  }
}

function saveWorkerUrl(value) {
  window.localStorage.setItem(WORKER_URL_STORAGE_KEY, value);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = normalizeUsername(usernameInput.value);
  const workerUrl = normalizeWorkerUrl(workerUrlInput.value);

  if (!isValidUsername(username)) {
    results.classList.add('is-hidden');
    setMessage('Enter a valid GitHub username.');
    usernameInput.focus();
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(workerUrl);
  } catch {
    results.classList.add('is-hidden');
    setMessage('Enter a valid Worker URL.');
    workerUrlInput.focus();
    return;
  }

  const baseUrl = parsedUrl.toString().replace(/\/+$/, '');
  saveWorkerUrl(baseUrl);

  const routes = {
    commit: buildRoute(baseUrl, username, 'commit'),
    issue: buildRoute(baseUrl, username, 'issue'),
    pr: buildRoute(baseUrl, username, 'pr'),
  };

  Object.entries(routes).forEach(([type, url]) => {
    const element = linkTargets[type];
    element.href = url;
    element.textContent = url;
  });

  snippet.value = buildSnippet(username, routes);
  results.classList.remove('is-hidden');
  setMessage('Links generated.');
});

document.querySelectorAll('[data-copy-target]').forEach((button) => {
  button.addEventListener('click', async () => {
    const targetId = button.getAttribute('data-copy-target');
    const target = document.getElementById(targetId);

    if (!target || !target.textContent) {
      return;
    }

    try {
      await copyText(target.textContent, 'Link copied.');
    } catch {
      setMessage('Copy failed.');
    }
  });
});

document.querySelector('#copy-snippet').addEventListener('click', async () => {
  if (!snippet.value) {
    return;
  }

  try {
    await copyText(snippet.value, 'Markdown copied.');
  } catch {
    setMessage('Copy failed.');
  }
});

loadSavedWorkerUrl();
