import React from 'react'
import { createRoot } from 'react-dom/client'
import AstroConditionsPage from './AstroConditionsPage.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <AstroConditionsPage onHome={() => { window.location.href = 'https://jaglab.org' }} />
)
