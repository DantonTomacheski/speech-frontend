import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Ajuste para React 19: Evitar problemas com componentes que usam recursos que não devem ser montados/desmontados rapidamente
const root = document.getElementById('root')!;
const reactRoot = createRoot(root);

// Pequeno atraso antes de renderizar para garantir que o React não desmonte 
// e monte o componente novamente muito rapidamente (especialmente útil para WebSockets e AudioContext)
setTimeout(() => {
  reactRoot.render(<App />);
}, 100);