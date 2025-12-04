# GEMINI.md

## Project Overview

This project is a modern web application built with React, TypeScript, and Vite. It uses a component-based architecture and features a UI built with a combination of Radix UI for accessibility and Tailwind CSS for styling. The project is set up with ESLint for code quality and uses Vite for a fast development experience.

## Building and Running

### Development

To run the development server with hot module replacement, use the following command:

```bash
npm run dev
```

### Building for Production

To build the application for production, which includes type-checking and minification, use the following command:

```bash
npm run build
```

### Linting

To check the code for any linting errors, run the following command:

```bash
npm run lint
```

### Previewing the Production Build

To preview the production build locally, use the following command:

```bash
npm run preview
```

## Development Conventions

*   **Component-Based Architecture:** The project follows a component-based architecture, with components located in the `src/components` directory.
*   **Styling:** Styling is done using Tailwind CSS, with utility classes being the primary way to style components.
*   **UI Components:** The project uses Radix UI for building accessible and unstyled UI components, which are then styled with Tailwind CSS.
*   **State Management:** While no specific state management library is explicitly defined in the `package.json`, it's recommended to use React's built-in state management (useState, useReducer, Context API) for simple to moderately complex state.
*   **Routing:** The project uses `react-router` for routing.
*   **Coding Style:** The project uses ESLint to enforce a consistent coding style. It's recommended to configure your editor to use the project's ESLint configuration for real-time feedback.
*   **Type Safety:** The project is written in TypeScript, and it's expected that all new code will be type-safe.
