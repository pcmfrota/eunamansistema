import { describe, it, expect } from 'vitest'
import { garantiaDias, situacaoGarantia, diasRestantes, validarBateria, chaveSerie, nomeArquivoSeguro, somarMeses } from '@/lib/baterias'

describe('garantiaDias', () => {
  it('conta os dias entre a venda e o vencimento', () => {
    expect(garantiaDias('2026-01-01', '2027-01-01')).toBe(365)
    expect(garantiaDias('2024-01-01', '2025-01-01')).toBe(366) // ano bissexto
    expect(garantiaDias('2026-03-01', '2026-03-31')).toBe(30)
  })
  it('não depende da data de hoje', () => {
    expect(garantiaDias('2020-01-01', '2021-01-01')).toBe(366)
  })
  it('data inválida → null', () => {
    expect(garantiaDias('', '2027-01-01')).toBeNull()
  })
})

describe('situacaoGarantia', () => {
  const hoje = '2026-11-27'
  it('ativa quando vence depois de 30 dias', () => {
    expect(situacaoGarantia('2026-12-28', hoje)).toBe('ativa')
    expect(situacaoGarantia('2027-06-01', hoje)).toBe('ativa')
  })
  it('próxima quando vence em até 30 dias (inclusive hoje)', () => {
    expect(situacaoGarantia('2026-12-27', hoje)).toBe('proxima')
    expect(situacaoGarantia('2026-11-28', hoje)).toBe('proxima')
    expect(situacaoGarantia('2026-11-27', hoje)).toBe('proxima')
  })
  it('vencida quando hoje passou do vencimento', () => {
    expect(situacaoGarantia('2026-11-26', hoje)).toBe('vencida')
    expect(situacaoGarantia('2025-01-01', hoje)).toBe('vencida')
  })
  it('dias restantes negativos depois do vencimento', () => {
    expect(diasRestantes('2026-11-20', hoje)).toBe(-7)
  })
})

describe('validarBateria', () => {
  const ok = { modelo: 'Moura 150Ah', numero_serie: 'ABC123', fornecedor: 'Moura', data_venda: '2026-01-01', data_vencimento_garantia: '2027-01-01' }
  it('aceita cadastro completo', () => expect(validarBateria(ok)).toBeNull())
  it('exige os campos obrigatórios', () => {
    expect(validarBateria({ ...ok, modelo: ' ' })).toMatch(/modelo/)
    expect(validarBateria({ ...ok, numero_serie: '' })).toMatch(/série/)
    expect(validarBateria({ ...ok, fornecedor: '' })).toMatch(/fornecedor/)
    expect(validarBateria({ ...ok, data_venda: '' })).toMatch(/venda/)
  })
  it('vencimento precisa ser depois da venda', () => {
    expect(validarBateria({ ...ok, data_vencimento_garantia: '2026-01-01' })).toMatch(/depois/)
    expect(validarBateria({ ...ok, data_vencimento_garantia: '2025-12-31' })).toMatch(/depois/)
  })
})

describe('utilitários', () => {
  it('chave do número de série ignora espaço e caixa', () => expect(chaveSerie('  abc-1 ')).toBe('ABC-1'))
  it('nome de arquivo seguro', () => expect(nomeArquivoSeguro('Certificado Bateria nº 1.pdf')).toBe('Certificado_Bateria_n_1.pdf'))
})

describe('somarMeses (botões de garantia)', () => {
  it('soma meses mantendo o dia', () => {
    expect(somarMeses('2026-11-06', 3)).toBe('2027-02-06')
    expect(somarMeses('2026-11-06', 6)).toBe('2027-05-06')
    expect(somarMeses('2026-11-06', 12)).toBe('2027-11-06')
    expect(somarMeses('2026-11-06', 24)).toBe('2028-11-06')
  })
  it('fim de mês cai no último dia do mês de destino', () => {
    expect(somarMeses('2026-08-31', 6)).toBe('2027-02-28')
    expect(somarMeses('2027-08-31', 6)).toBe('2028-02-29')
    expect(somarMeses('2026-01-31', 3)).toBe('2026-04-30')
  })
  it('sem data da venda → null', () => expect(somarMeses('', 12)).toBeNull())
})
