// @ts-check

// The opt-in private phone build is the only graph allowed to contact BeatSaver.
// Validate the URL before fetch: a CSP host list does not constrain paths or
// stop the browser from following a redirect to a different permitted origin.
const API_PATH = /^\/(?:search\/text\/[0-9]+|maps\/(?:latest|id\/[0-9a-zA-Z]+|hash\/[0-9a-fA-F]{40}))\/?$/u;
const ZIP_PATH = /^\/[0-9a-fA-F]{40}\.zip$/u;
const PREVIEW_PATH = /^\/[0-9a-fA-F]{40}\.mp3$/iu;

/** @param {unknown} input @param {'request' | 'preview'} kind @returns {URL} */
export function requirePrivateBeatSaverUrl(input, kind = 'request') {
  let url;
  try { url = new URL(/** @type {string | URL} */ (input)); }
  catch { throw new Error('BeatSaver URL is unavailable. Download the map ZIP and import it locally.'); }
  const path = url.pathname;
  const allowed = kind === 'preview'
    ? url.hostname === 'cfcdn.beatsaver.com' && PREVIEW_PATH.test(path) && url.search === ''
    : (url.hostname === 'api.beatsaver.com' && API_PATH.test(path)) ||
      (url.hostname === 'r2cdn.beatsaver.com' && ZIP_PATH.test(path) && url.search === '');
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '' ||
      url.hash !== '' || !allowed) {
    throw new Error('BeatSaver URL is not approved for this private build. Download the map ZIP and import it locally.');
  }
  return url;
}

/** @param {typeof fetch} fetchImpl @returns {typeof fetch} */
export function createPrivateBeatSaverFetch(fetchImpl) {
  return async (input, init) => {
    const url = requirePrivateBeatSaverUrl(input);
    // The vendor's normal transport retains its GET, Accept, AbortSignal,
    // credential/referrer policy, retry and ZIP byte/progress handling.
    // Override only redirect handling: the vendor otherwise uses 'follow',
    // which sends a request to an untrusted Location before inspecting it.
    return fetchImpl(url, { ...init, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
  };
}
