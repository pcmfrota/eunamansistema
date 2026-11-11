-- Dois recursos de foto pedidos explicitamente pelo usuário (confirmado via pergunta
-- direta, já que nenhum dos dois existia antes — nem no site):
--
-- 1. inspecoes_pneus.fotos: o botão "Câmera / Foto" do formulário de inspeção de pneu
--    (app/pneus/PneusModal.tsx e o port no field-app) nunca teve onChange nenhum e não
--    existia coluna nenhuma pra guardar o resultado — botão sem função há muito tempo,
--    em ambos os apps. Nome/formato (jsonb, posição -> base64) seguem o que o TYPE
--    InspecaoPneu (src/models/pneus.ts) já previa há tempo ("Anexo fotográfico (JSONB
--    mapeando posição do pneu -> base64 compressed)") mas nunca tinha sido criado no
--    banco nem lido/escrito por UI nenhuma. Por enquanto só a chave "geral" é usada (o
--    botão de hoje é um só, não por posição de pneu) — o formato já fica pronto pra
--    evoluir pra foto por posição sem precisar de outra migration.
--
-- 2. checklists_mecanicos.fotos: Checklist Mecânicos nunca teve suporte a foto nenhum
--    (só um campo de texto livre "Pendências Adicionais"). Array de fotos comprimidas,
--    mesmo padrão/nome já usado em checklist_frota.fotos (tabela irmã, já existente).
alter table public.inspecoes_pneus add column if not exists fotos jsonb;
alter table public.checklists_mecanicos add column if not exists fotos text[];
