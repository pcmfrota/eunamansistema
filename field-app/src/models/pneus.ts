// Reexporta o arquivo real (puro, sem nada do Next.js) pra que o import relativo
// "../models/pneus" dentro de field-app/src/services/PneusService.ts (cópia idêntica
// do original) resolva sem precisar editar esse arquivo.
export * from "../../../src/models/pneus";
