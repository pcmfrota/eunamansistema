// Registro único de módulos do sistema — fonte da verdade para menu lateral,
// middleware (camada 2), tela de Gestão de Usuários e RLS (camada 3).
// Antes desta data existiam 4 listas mantidas à mão (menu, middleware, auth-context,
// UsuariosClient) que já tinham ficado dessincronizadas entre si e com as rotas reais
// de app/ — qualquer módulo novo precisa ser adicionado SÓ aqui.

export type Modulo = {
  path: string;
  label: string;
  /** Visível na tela de Gestão de Usuários para conceder/retirar acesso individual. */
  concedivel: boolean;
};

export const MODULOS_SISTEMA: Modulo[] = [
  { path: '/dashboard',               label: 'Dashboard',                 concedivel: true },
  { path: '/mao-de-obra',             label: 'Ficha Mão de Obra',         concedivel: true },
  { path: '/os',                      label: 'Controle de OS',            concedivel: true },
  { path: '/checklist-mecanicos',     label: 'Checklist Mecânicos',       concedivel: true },
  { path: '/programacao-mecanica',    label: 'Programação Mecânica',      concedivel: true },
  { path: '/preventivas',             label: 'Controle de Horímetros',    concedivel: true },
  { path: '/horimetro',               label: 'Horímetro (consulta)',      concedivel: true },
  { path: '/pneus',                   label: 'Boletim de Pneus',          concedivel: true },
  { path: '/backlog',                 label: 'Backlog',                   concedivel: true },
  { path: '/programacao-preventiva',  label: 'Prog. Preventiva',          concedivel: true },
  { path: '/base-frotas',             label: 'Base de Frotas',            concedivel: true },
  { path: '/base-dados',              label: 'Base de Dados',             concedivel: true },
  { path: '/calendario',              label: 'Calendário Suzano',         concedivel: true },
  { path: '/lavagens',                label: 'Controle de Lavagens',      concedivel: true },
  { path: '/lubrificacao',            label: 'Lubrificação',              concedivel: true },
  { path: '/captacao',                label: 'Captação de Água',          concedivel: true },
  { path: '/documentos',              label: 'Documentos da Frota',       concedivel: true },
  { path: '/controladoria-frota',     label: 'Controladoria de Gestão',   concedivel: true },
  { path: '/checklist-frota',         label: 'Checklist de Frota',        concedivel: true },
  { path: '/controle-filtros',        label: 'Controle de Filtros',       concedivel: true },
  { path: '/custos',                  label: 'Controle de Custos',        concedivel: true },
  { path: '/insumos',                 label: 'Controle de Insumos',       concedivel: true },
  { path: '/historico-exclusoes',     label: 'Histórico de Exclusões',    concedivel: true },
  { path: '/tentativas-acesso',       label: 'Tentativas de Acesso',      concedivel: true },
  { path: '/admin/usuarios',          label: 'Gestão de Usuários',         concedivel: true },
];

// Rotas que todo usuário autenticado e ativo acessa, independente de permissão de módulo.
export const ROTAS_SEMPRE_PERMITIDAS = ['/', '/perfil'];

export function modulosPaths(): string[] {
  return MODULOS_SISTEMA.map(m => m.path);
}
