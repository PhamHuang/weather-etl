import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './App.css';

// Gắn cây giao diện React vào <div id="root"> trong index.html.
const root = createRoot(document.getElementById('root'));

root.render(<App />);
