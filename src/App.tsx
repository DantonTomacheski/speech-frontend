// src/App.tsx
import RealTimeTranscription from './components/RealTimeTranscription';
import './index.css'; // Importa o CSS global (onde o Tailwind é configurado)

/**
 * @function App
 * @description Componente raiz da aplicação React.
 * Renderiza o componente principal de transcrição.
 * @returns {React.ReactElement} O elemento React.
 */
function App() {
  return (
    // Container principal com fundo cinza claro e padding
    <div className="bg-gray-100 min-h-screen p-4 flex items-start justify-center">
      {/* Renderiza o componente de transcrição */}
      <RealTimeTranscription />
    </div>
  );
}

export default App;
