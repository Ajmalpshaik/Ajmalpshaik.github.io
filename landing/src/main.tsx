import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('root')!

// The built page arrives already rendered (see scripts/build.mjs), so React
// only attaches to it. The dev server sends an empty root and renders fresh.
if (root.firstElementChild) {
  hydrateRoot(root, <App />)
} else {
  createRoot(root).render(<App />)
}
