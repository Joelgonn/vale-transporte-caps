import "@testing-library/jest-dom/vitest";

// React 19 requer este sinalizador para act() funcionar fora de produção.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
