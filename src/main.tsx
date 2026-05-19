
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './store/ThemeContext'
import './index.css'
import '@xterm/xterm/css/xterm.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  // </React.StrictMode>,
)
