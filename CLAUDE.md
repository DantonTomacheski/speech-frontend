# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands
- `yarn dev` - Start development server
- `yarn build` - Build for production (runs TypeScript compiler first)
- `yarn lint` - Run ESLint checks
- `yarn preview` - Preview production build locally

## Code Style Guidelines
- **Imports**: Group imports by source - React, third-party libraries, local components, then types/styles
- **Formatting**: Use 2-space indentation
- **Types**: Use TypeScript interfaces/types for all components, props, and state
- **Components**: Create well-documented functional React components with JSDoc comments
- **Naming**: Use PascalCase for components, camelCase for variables/functions, and UPPER_CASE for constants
- **Error Handling**: Use try/catch for async operations, provide user-friendly error messages
- **State Management**: Use React hooks (useState, useRef, useEffect, useCallback)
- **Audio Processing**: Handle WebSocket connections and audio processing with proper cleanup
- **Tailwind CSS**: Utilize Tailwind classes for styling components
- **Logging**: Use structured logging with clarity about source/context (e.g., "[Audio]", "[WebSocket]")