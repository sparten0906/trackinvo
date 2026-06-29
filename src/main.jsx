import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { AppProvider } from './context/AppContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '13.5px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                color: 'var(--text)',
              },
              success: {
                iconTheme: { primary: 'var(--emerald)', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: 'var(--red)', secondary: '#fff' },
              },
            }}
          />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
