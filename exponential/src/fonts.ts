import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import '@fontsource/anton/index.css';
import {continueRender, delayRender} from 'remotion';

// Block rendering until every family is actually loaded, so no frame is captured with fallback fonts.
const faces = [
  "400 40px 'Fraunces Variable'",
  "italic 400 40px 'Fraunces Variable'",
  "700 40px 'Fraunces Variable'",
  "400 40px 'Inter Variable'",
  "800 40px 'Inter Variable'",
  "400 40px 'JetBrains Mono Variable'",
  "400 40px 'Anton'",
];

let started = false;
export const ensureFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading fonts');
  Promise.all(faces.map((f) => document.fonts.load(f, 'AaBb 0123 → ✦')))
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error('Font load failed', e);
      continueRender(handle);
    });
};
