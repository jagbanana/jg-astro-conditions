import React, { useMemo, useState } from 'react'
import { ArrowLeft, Cloud, Droplets, Eye, LocateFixed, Search, Thermometer, Wind } from 'lucide-react'

const DEFAULT_LOCATION = { lat: 39.7392, lon: -104.9903, label: 'Denver, Colorado' }
const metrics = [
  { key: 'clouds', label: 'Cloud cover', icon: Cloud, unit: '%', better: 'lower' },
  { key: 'seeing', label: 'Seeing', icon: Eye, unit: '%', better: 'higher' },
  { key: 'wind', label: 'Wind', icon: Wind, unit: 'km/h', better: 'lower' },
  { key: 'humidity', label: 'Humidity', icon: Droplets, unit: '%', better: 'lower' }
]

function todayIso(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function clamp(n, min = 0, max = 100) { return Math.min(max, Math.max(min, n)) }
function fToC(c) { return (c * 9/5) + 32 }
function displayTemp(c, units) { return `${(units === 'imperial' ? fToC(c) : c).toFixed(1)}°${units === 'imperial' ? 'F' : 'C'}` }
function displayWind(kmh, units) { return units === 'imperial' ? `${(kmh * 0.621371).toFixed(1)} mph` : `${kmh.toFixed(1)} km/h` }

function calculateSeeing(hourly, i) {
  const temp = hourly.temperature[i]
  const dew = hourly.dewPoint[i]
  const humidity = hourly.humidity[i]
  const wind = hourly.wind[i]
  const tempDewSpread = Math.abs(temp - dew)
  const tempScore = clamp(60 + tempDewSpread * 2)
  let windScore = 100
  if (wind < 5) windScore = Math.max(60, wind * 12)
  else if (wind > 10) windScore = Math.max(0, 100 - ((wind - 10) * 5))
  const humidityScore = clamp(100 - humidity * 0.8)
  let stabilityScore = 100
  if (i > 0) stabilityScore = clamp(100 - Math.abs(temp - hourly.temperature[i - 1]) * 10)
  return Math.round(clamp(tempScore * 0.3 + windScore * 0.3 + humidityScore * 0.2 + stabilityScore * 0.2))
}

function scoreMetric(key, value) {
  if (key === 'clouds') return clamp(100 - value)
  if (key === 'seeing') return clamp(value)
  if (key === 'wind') return value <= 5 ? 100 : value > 20 ? 0 : clamp(100 - ((value - 5) * 6.67))
  if (key === 'humidity') return value <= 40 ? 100 : value > 90 ? 0 : clamp(100 - ((value - 40) * 2))
  return 0
}
function quality(score) { return score >= 80 ? 'great' : score >= 55 ? 'good' : score >= 30 ? 'marginal' : 'poor' }
function colorFor(score) { return score >= 80 ? '#00a86b' : score >= 55 ? '#a7c8ff' : score >= 30 ? '#ffb000' : '#ff4d4d' }

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Location search failed')
  const data = await response.json()
  if (!data?.[0]) throw new Error('Location not found')
  return { lat: Number(data[0].lat), lon: Number(data[0].lon), label: data[0].display_name.split(',').slice(0, 3).join(',') }
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
  const response = await fetch(url)
  if (!response.ok) return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`
  const data = await response.json()
  return data?.display_name?.split(',').slice(0, 3).join(',') || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`
}

async function fetchWeather({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m,cloud_cover',
    timezone: 'auto',
    forecast_days: '7'
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!response.ok) throw new Error('Weather fetch failed')
  const body = await response.json()
  const hourly = {
    time: body.hourly.time,
    temperature: body.hourly.temperature_2m,
    humidity: body.hourly.relative_humidity_2m,
    dewPoint: body.hourly.dew_point_2m,
    wind: body.hourly.wind_speed_10m,
    clouds: body.hourly.cloud_cover
  }
  hourly.seeing = hourly.time.map((_, i) => calculateSeeing(hourly, i))
  return hourly
}

function RatingDial({ score }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  return <svg className="dial" viewBox="0 0 88 88" aria-label={`Score ${score}`}>
    <circle cx="44" cy="44" r={radius} className="dial-bg" />
    <circle cx="44" cy="44" r={radius} className="dial-fill" stroke={colorFor(score)} strokeDasharray={circumference} strokeDashoffset={offset} />
    <text x="44" y="41" textAnchor="middle">{Math.round(score)}</text>
    <text x="44" y="57" textAnchor="middle" className="dial-label">{quality(score)}</text>
  </svg>
}

function Timeline({ hourly }) {
  const rows = ['clouds', 'seeing', 'wind', 'humidity']
  return <div className="astro-timeline tool-panel">
    <div className="tool-panel-title"><span>7-day signal strip</span><span>168 hourly samples</span></div>
    {rows.map(row => <div className="timeline-row" key={row}>
      <strong>{metrics.find(m => m.key === row).label}</strong>
      <div className="timeline-cells">{hourly.time.map((t, i) => {
        const score = scoreMetric(row, hourly[row][i])
        return <span key={`${row}-${t}`} title={`${new Date(t).toLocaleString()} · ${row}: ${Math.round(hourly[row][i])}`} style={{ background: colorFor(score), opacity: .35 + score / 160 }} />
      })}</div>
    </div>)}
    <div className="timeline-days">{Array.from({ length: 7 }, (_, i) => <span key={i}>{new Date(hourly.time[i * 24]).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>)}</div>
  </div>
}

export default function AstroConditionsPage({ onHome }) {
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [query, setQuery] = useState('')
  const [units, setUnits] = useState('metric')
  const [day, setDay] = useState(todayIso())
  const [hour, setHour] = useState(new Date().getHours())
  const [hourly, setHourly] = useState(null)
  const [status, setStatus] = useState('Ready. Search a location or use Denver as the default.')
  const [busy, setBusy] = useState(false)

  async function loadWeather(loc = location) {
    setBusy(true)
    setStatus('Pulling astronomy weather from Open-Meteo…')
    try {
      const data = await fetchWeather(loc)
      setHourly(data)
      setStatus(`Forecast loaded for ${loc.label}.`)
    } catch (error) {
      setStatus(error.message)
    } finally { setBusy(false) }
  }

  async function runSearch() {
    if (!query.trim()) return
    setBusy(true)
    setStatus('Finding location…')
    try {
      const loc = await geocode(query)
      setLocation(loc)
      setQuery('')
      await loadWeather(loc)
    } catch (error) {
      setStatus(error.message)
      setBusy(false)
    }
  }

  async function detectLocation() {
    if (!navigator.geolocation) { setStatus('Browser geolocation is not available.'); return }
    setBusy(true)
    setStatus('Waiting for browser location permission…')
    navigator.geolocation.getCurrentPosition(async position => {
      const lat = position.coords.latitude
      const lon = position.coords.longitude
      const label = await reverseGeocode(lat, lon)
      const loc = { lat, lon, label }
      setLocation(loc)
      await loadWeather(loc)
    }, error => { setStatus(error.message); setBusy(false) })
  }

  const selectedIndex = useMemo(() => {
    if (!hourly) return -1
    const prefix = day
    const idx = hourly.time.findIndex(t => t.startsWith(prefix) && Number(t.slice(11, 13)) === Number(hour))
    return idx >= 0 ? idx : Math.min(Number(hour), hourly.time.length - 1)
  }, [hourly, day, hour])
  const selected = hourly && selectedIndex >= 0 ? Object.fromEntries(['clouds','seeing','wind','humidity','temperature','dewPoint'].map(k => [k, hourly[k][selectedIndex]])) : null

  return <main className="tool-page">
    <div className="tool-nav"><button className="button" onClick={onHome}><ArrowLeft size={15}/> Project index</button><a className="button" href="https://github.com/jagbanana/jg-astro-conditions" target="_blank" rel="noreferrer">Source repo</a></div>
    <header className="tool-hero compact">
      <p className="kicker">ASTRO-007 / REACT_PORT</p>
      <h1>Astro Conditions</h1>
      <p className="lede">A practical astronomy-weather dashboard for cloud cover, estimated seeing, wind, humidity, temperature, and dew point.</p>
    </header>

    <section className="tool-controls tool-panel">
      <div className="location-readout"><strong>{location.label}</strong><span>{location.lat.toFixed(4)}°, {location.lon.toFixed(4)}°</span></div>
      <div className="tool-input-row"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} placeholder="Search city, address, or observing site"/><button className="button primary" onClick={runSearch} disabled={busy}><Search size={15}/> Search</button><button className="button" onClick={detectLocation} disabled={busy}><LocateFixed size={15}/> Detect</button></div>
      <div className="tool-input-row secondary"><select value={day} onChange={e => setDay(e.target.value)}>{Array.from({ length: 7 }, (_, i) => <option key={i} value={todayIso(i)}>{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(todayIso(i)).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</option>)}</select><input type="range" min="0" max="23" value={hour} onChange={e => setHour(e.target.value)} /><span className="mono">{String(hour).padStart(2, '0')}:00</span><label><input type="radio" checked={units === 'metric'} onChange={() => setUnits('metric')} /> °C</label><label><input type="radio" checked={units === 'imperial'} onChange={() => setUnits('imperial')} /> °F</label><button className="button" onClick={() => loadWeather()} disabled={busy}>Load forecast</button></div>
      <p className="status-line">{status}</p>
    </section>

    {selected ? <>
      <section className="condition-grid">{metrics.map(m => {
        const Icon = m.icon
        const score = scoreMetric(m.key, selected[m.key])
        const value = m.key === 'wind' ? displayWind(selected.wind, units) : `${Math.round(selected[m.key])}${m.unit}`
        return <article className="condition-card" key={m.key}><div><p className="eyebrow"><Icon size={15}/>{m.label}</p><h2>{value}</h2></div><RatingDial score={score}/></article>
      })}</section>
      <section className="temp-strip tool-panel"><div><Thermometer size={16}/> Temperature <strong>{displayTemp(selected.temperature, units)}</strong></div><div>Dew point <strong>{displayTemp(selected.dewPoint, units)}</strong></div><div>Local forecast time <strong>{new Date(hourly.time[selectedIndex]).toLocaleString()}</strong></div></section>
      <Timeline hourly={hourly}/>
    </> : <section className="empty-state tool-panel"><p>Load a forecast to wake up the dashboard. Denver is queued because defaults should be useful, not theatrical.</p><button className="button primary" onClick={() => loadWeather()} disabled={busy}>Load Denver forecast</button></section>}
  </main>
}
