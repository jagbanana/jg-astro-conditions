# JGAstroConditions - Astronomy Weather Dashboard

A WordPress plugin that provides a visual dashboard for astronomy and astrophotography weather conditions. Users can check cloud cover, seeing conditions, wind, humidity, temperature, and dew point for their location over a 7-day period.

## Features

- Visual dashboard with color-coded condition indicators
- 7-day forecast with hourly data
- Location detection or manual location entry
- Key metrics for astronomy:
  - Cloud cover
  - Seeing conditions
  - Wind speed
  - Humidity
  - Temperature
  - Dew point
- Responsive design for mobile and desktop
- Timeline view for tracking conditions over multiple days

## Installation

1. Download the latest release from the GitHub repository
2. Upload the plugin folder to your WordPress site's `/wp-content/plugins/` directory
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Use the shortcode `[astro_weather_dashboard]` in any post or page

## Usage

Add the dashboard to any post or page using the shortcode:
```shortcode
[astro_weather_dashboard]

You can also specify default coordinates:
```shortcode
[astro_weather_dashboard latitude="45.5155" longitude="-122.6789"]

## Requirements

WordPress 5.0 or higher
PHP 7.2 or higher
Modern web browser with JavaScript enabled

## Credits
This plugin uses the following services and libraries:

Open-Meteo API for weather data
OpenStreetMap Nominatim for geocoding
React for the timeline view
jQuery UI for controls