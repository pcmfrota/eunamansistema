import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { setupKeyboardAwareScroll } from "./lib/keyboardAwareScroll";
import "./index.css";
import "./ui/tokens/native-tokens.css";

// Garante que QUALQUER campo de texto focado em qualquer tela fique visível acima do
// teclado — ver field-app/src/lib/keyboardAwareScroll.ts pro porquê isso precisa ser
// feito na mão neste app (nenhuma API de viewport do navegador sabe que o teclado existe).
setupKeyboardAwareScroll();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
