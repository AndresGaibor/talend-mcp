import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

function App() {
  return <h1 className="text-2xl font-bold text-blue-600">Talend MCP UI</h1>;
}