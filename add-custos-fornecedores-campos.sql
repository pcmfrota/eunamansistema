-- Mais informações opcionais no cadastro de fornecedores (Controle de Custos). Nenhum campo
-- aqui é obrigatório — os formulários de lançamento continuam buscando fornecedor só pelo
-- nome fantasia, sem depender desses dados extras.

ALTER TABLE public.custos_fornecedores ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.custos_fornecedores ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.custos_fornecedores ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.custos_fornecedores ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.custos_fornecedores ADD COLUMN IF NOT EXISTS contato text;

NOTIFY pgrst, 'reload schema';
