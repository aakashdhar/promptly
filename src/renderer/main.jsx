import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { loadKeys } from './utils/keys.js'

// Key names (Command or Ctrl) are known before anything renders, so no label changes after first paint.
loadKeys().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)
})
