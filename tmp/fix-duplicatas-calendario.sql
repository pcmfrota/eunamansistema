-- =============================================
-- SCRIPT: Remover duplicatas do calendario_suzano
-- Mantém apenas 1 registro por mês/ano (o de menor ID)
-- =============================================

-- 1. VER quantas duplicatas existem (consulta de diagnóstico)
SELECT mes, ano, COUNT(*) as total
FROM calendario_suzano
GROUP BY mes, ano
HAVING COUNT(*) > 1
ORDER BY ano, mes;

-- =============================================
-- 2. DELETAR as duplicatas (executa após confirmar acima)
-- Mantém o registro com menor ID para cada mês/ano
-- =============================================
DELETE FROM calendario_suzano
WHERE id NOT IN (
  SELECT MIN(id)
  FROM calendario_suzano
  GROUP BY mes, ano
);

-- 3. VERIFICAR resultado final
SELECT id, mes, ano, data_inicio, data_fim, qtd_dias
FROM calendario_suzano
ORDER BY ano, mes;
