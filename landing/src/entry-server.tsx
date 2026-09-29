import { renderToString } from 'react-dom/server'
import App from './App'

// Used only at build time, to write the page out as finished HTML.
export function render() {
  return renderToString(<App />)
}
