UPDATE docs_tacografo
SET local = e.modulo
FROM equipamentos e
WHERE REPLACE(UPPER(docs_tacografo.placa), ' ', '') = REPLACE(UPPER(e.placa), ' ', '');

UPDATE docs_civ_cipp
SET local = e.modulo
FROM equipamentos e
WHERE REPLACE(UPPER(docs_civ_cipp.placa), ' ', '') = REPLACE(UPPER(e.placa), ' ', '');

UPDATE docs_laudo_eletromecanico
SET local = e.modulo
FROM equipamentos e
WHERE REPLACE(UPPER(docs_laudo_eletromecanico.placa), ' ', '') = REPLACE(UPPER(e.placa), ' ', '');

UPDATE docs_laudo_implemento
SET local = e.modulo
FROM equipamentos e
WHERE REPLACE(UPPER(docs_laudo_implemento.placa), ' ', '') = REPLACE(UPPER(e.placa), ' ', '');
