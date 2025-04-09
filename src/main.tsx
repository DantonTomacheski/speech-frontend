import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!;
const reactRoot = createRoot(root);

reactRoot.render(<App />);