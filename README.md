# Local Image Converter (GitHub Pages ready)

A client-side image converter & resizer that runs entirely in the browser. Supports PSD (when `psd.js` is provided), JPG, WEBP, AVIF, PNG, multi-file upload, and stores UI options in `localStorage`.

## Features
- Resize by longest side (px)
- Convert to JPG / WEBP / AVIF / PNG
- Quality control (0–1)
- Drag & drop + file selector + multi-file queue
- Local conversion (no server)
- Options persisted in `localStorage`
- Modular ES modules + build with Vite

## PSD support
PSD rendering requires a browser-compatible PSD library (e.g. `psd.js`). For quick testing you can add a compatible `psd.min.js` into the `public/` folder (the app will check for a global `PSD`).

## Development
```bash
npm install
npm run dev
npm run build
```

Deploy `dist/` folder to GitHub Pages (or use GitHub Actions).

## Notes
- AVIF support depends on browser.
- Save location cannot be forced (browser chooses).
