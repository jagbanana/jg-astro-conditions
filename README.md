# JG Astro Conditions

A standalone React astronomy-weather dashboard for checking observing conditions by location.

Live version: <https://jaglab.org/astro-conditions>

## Features

- Search by city, address, landmark, or observing site
- Optional browser geolocation
- 7-day hourly forecast from Open-Meteo
- Cloud cover, estimated seeing, wind, humidity, temperature, and dew point
- Metric/imperial display toggle
- Color-coded condition dials and 7-day signal strip

## How it works

This app runs entirely in the browser:

- Weather data: [Open-Meteo](https://open-meteo.com/)
- Geocoding: [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)
- UI: React + Vite

The seeing estimate is a practical heuristic based on temperature/dew-point spread, wind speed, humidity, and temperature stability. It is intended as an observing-planning signal, not a professional meteorological model.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

The production build outputs static files to `dist/` and can be hosted on Cloudflare Pages, Netlify, GitHub Pages, or any static host.
