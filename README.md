# 🎙️ Speech Frontend - Transcrição de Fala em Tempo Real

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/) [![Vite](https://img.shields.io/badge/Vite-6.2-purple?logo=vite)](https://vitejs.dev/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-blue?logo=tailwindcss)](https://tailwindcss.com/)

<!-- Adicione um screenshot ou GIF aqui! -->
<!-- ![Screenshot da Aplicação](link/para/seu/screenshot.png) -->

Interface web para transcrição de fala em tempo real, utilizando o microfone do navegador e comunicação via WebSocket com um serviço de backend (não incluído neste repositório).

## ✨ Funcionalidades

*   **Captura de Áudio:** Grava áudio diretamente do microfone do usuário usando a Web Audio API.
*   **Comunicação Real-Time:** Envia chunks de áudio via WebSocket para um servidor backend.
*   **Exibição de Transcrição:** Mostra as transcrições finais e interinas (parciais) recebidas do backend em tempo real.
*   **Controles Intuitivos:** Botões para iniciar e parar a gravação/transcrição.
*   **Feedback de Status:** Indicadores visuais claros para o status da conexão e da gravação (Inativo, Conectando, Inicializando, Gravando, Parando, Erro).
*   **Interface Moderna:** Construída com React e estilizada com Tailwind CSS.
*   **Configurável:** A URL do servidor WebSocket backend pode ser definida via variável de ambiente.

## 🚀 Tecnologias Utilizadas

*   **Frontend:**
    *   [React 19](https://react.dev/)
    *   [TypeScript](https://www.typescriptlang.org/)
    *   [Vite](https://vitejs.dev/) (Build Tool)
    *   [Tailwind CSS](https://tailwindcss.com/) (Estilização)
*   **Comunicação:**
    *   WebSockets
    *   Web Audio API

## 📋 Pré-requisitos

1.  **Node.js e npm/yarn/pnpm:** Necessário para gerenciar dependências e rodar os scripts do projeto. [Instalar Node.js](https://nodejs.org/)
2.  **Servidor Backend WebSocket:** **Fundamental!** Esta aplicação é apenas o frontend. Você precisa ter um servidor backend rodando que:
    *   Aceite conexões WebSocket (padrão: `ws://localhost:8081`).
    *   Receba chunks de áudio (PCM, taxa de amostragem configurada no frontend - padrão 48000Hz).
    *   Realize a transcrição de fala.
    *   Envie mensagens WebSocket de volta para o frontend com os resultados da transcrição (nos formatos esperados definidos em `src/types.ts`).

## ⚙️ Instalação e Execução

1.  **Clone o repositório:**
    ```bash
    git clone <URL_DO_SEU_REPOSITORIO>
    cd speech-frontend
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    # ou
    yarn install
    # ou
    pnpm install
    ```

3.  **(Opcional) Configure o Backend:**
    *   Crie um arquivo `.env` na raiz do projeto.
    *   Adicione a variável `VITE_WEBSOCKET_URL` com a URL do seu servidor backend:
        ```env
        VITE_WEBSOCKET_URL=ws://seu-backend-url:porta
        ```
    *   Se nenhum `.env` for fornecido, o padrão `ws://localhost:8081` será usado.

4.  **Inicie o servidor de desenvolvimento (Vite):**
    ```bash
    npm run dev
    # ou
    yarn dev
    # ou
    pnpm dev
    ```

5.  **Abra o navegador:** Acesse `http://localhost:5173` (ou a porta indicada pelo Vite).

6.  **Certifique-se de que seu servidor backend esteja rodando** antes de tentar iniciar a gravação no frontend.

## 🛠️ Scripts Disponíveis

*   `npm run dev`: Inicia o servidor de desenvolvimento Vite com Hot Module Replacement (HMR).
*   `npm run build`: Compila o projeto para produção (gera arquivos estáticos na pasta `dist`).
*   `npm run lint`: Executa o ESLint para verificar o código.
*   `npm run preview`: Inicia um servidor local para pré-visualizar a build de produção.

## 🤝 Contribuição

Contribuições são bem-vindas! Se você encontrar bugs ou tiver sugestões de melhorias, sinta-se à vontade para abrir uma *Issue* ou um *Pull Request*.

*(Opcional: Adicione diretrizes de contribuição mais detalhadas aqui ou em um arquivo CONTRIBUTING.md)*

## 📜 Licença

Este projeto não possui uma licença definida. Considere adicionar uma se planeja torná-lo público (ex: MIT, Apache 2.0).
