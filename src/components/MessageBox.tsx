// src/components/MessageBox.tsx
import React from 'react';

/**
 * @interface MessageBoxProps
 * @description Propriedades para o componente MessageBox.
 * @property {string | null} message - A mensagem a ser exibida, ou null para esconder.
 * @property {() => void} onClose - Função chamada quando o botão de fechar é clicado.
 */
interface MessageBoxProps {
  message: string | null;
  onClose: () => void;
}

/**
 * @function MessageBox
 * @description Componente funcional para exibir uma caixa de mensagem (geralmente para erros).
 * @param {MessageBoxProps} props - As propriedades do componente.
 * @returns {React.ReactElement | null} O elemento React ou null se não houver mensagem.
 */
const MessageBox: React.FC<MessageBoxProps> = ({ message, onClose }) => {
  // Não renderiza nada se não houver mensagem
  if (!message) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-md z-50" // z-50 para garantir que fique sobre outros elementos
      role="alert"
    >
      <strong className="font-bold">Erro: </strong>
      <span className="block sm:inline">{message}</span>
      {/* Botão para fechar a mensagem */}
      <button
        onClick={onClose}
        className="absolute top-0 bottom-0 right-0 px-4 py-3"
        aria-label="Fechar" // Adiciona acessibilidade
      >
        {/* Ícone SVG para o botão de fechar */}
        <svg
          className="fill-current h-6 w-6 text-red-500"
          role="button"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <title>Fechar</title>
          <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
        </svg>
      </button>
    </div>
  );
};

export default MessageBox;
