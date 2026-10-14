// @ts-check
// Static, friend-facing copy of the signed c67b1e5 camera/CV control.
// Only this separate preview adds response-time egress protection; the frozen
// HTML/Worker/model/WASM bytes and the existing private preview are unchanged.
import baseline from './vite.phone-cv-marker.config.js';

export default {
  ...baseline,
  preview: {
    ...baseline.preview,
    port: 4195,
    headers: {
      ...baseline.preview.headers,
      // A dedicated Worker follows the CSP on its own script response, not the
      // document's. Vite preview applies these headers to every static asset.
      'Content-Security-Policy': "connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    }
  }
};
