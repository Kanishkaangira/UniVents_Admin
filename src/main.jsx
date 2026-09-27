import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import StartupMessage from './components/StartupMessage.jsx';
import './index.css';

const root = createRoot(document.getElementById('root'));

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  root.render(
    <StartupMessage title="Supabase configuration is missing">
      <p>
        Create a <code>.env</code> file from <code>.env.example</code>, then set
        {' '}<code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>
        {' '}to your project values. Restart the dev server after saving.
      </p>
    </StartupMessage>,
  );
} else {
  import('./App.jsx')
    .then(({ default: App }) => {
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    })
    .catch(error => {
      console.error('Application startup failed:', error);
      root.render(
        <StartupMessage title="The app could not start">
          <p>{error.message}</p>
        </StartupMessage>,
      );
    });
}
