/**
 * CÁLCULOS DO DASHBOARD KM & HORÍMETRO
 * Funções puras (sem banco, sem React): recebem leituras já carregadas e devolvem uso,
 * médias, inconsistências e status. Testadas em test/horimetro-km-calc.test.ts.
 *
 * Datas sempre no formato 'aaaa-mm-dd' (dia civil de Brasília). As contas de dias usam
 * UTC por dentro pra não sofrer com horário de verão/fuso.
 */
import { inferUnidadeHorimetro } from './horimetro-log'

export type Unidade = 'h' | 'km'
export type TipoFrota = 'pesado' | 'leve'
export type StatusLeitura = 'Em dia' | 'Atrasada' | 'Inconsistente'
export type VisaoMedia = 'mensal' | 'anual'

/** Uma leitura de uma série (só horímetro ou só KM) de uma placa. */
export type PontoLeitura = {
  data: string
  valor: number
  /** Desempate entre leituras do mesmo dia (timestamp de registro). */
  ordem?: string
  id?: string
  por?: string | null
  obs?: string | null
}

export type PontoClassificado = PontoLeitura & {
  /** Diferença para a última leitura válida anterior (null na primeira). */
  diferenca: number | null
  /** Menor que a última leitura válida anterior: ignorada nos cálculos. */
  inconsistente: boolean
}

export type ResultadoUso = {
  leituraInicial: number | null
  dataInicial: string | null
  leituraFinal: number | null
  dataFinal: string | null
  /** Última leitura do período − primeira leitura do período (só leituras dentro do período). */
  uso: number
  temLeituraNoPeriodo: boolean
  /** Só 1 leitura válida no período: não dá pra calcular o uso (precisa de pelo menos 2). */
  insuficiente: boolean
  /** 'aaaa-mm' → uso atribuído ao mês da leitura que o registrou. Soma = uso. */
  usoPorMes: Record<string, number>
  /** 'aaaa' → soma do uso no ano. */
  usoPorAno: Record<string, number>
  mesesComLeitura: number
  mediaMensal: number | null
  mediaAnual: number | null
  mediaDiaria: number | null
  projecaoAnual: number | null
  /** Leituras regressivas dentro do período. */
  inconsistencias: number
  /** Data da última leitura válida até o fim do período (pode ser anterior ao início). */
  ultimaLeitura: string | null
}

// ─── DATAS ──────────────────────────────────────────────────────────────────────
const DIA_MS = 86_400_000
const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function diasEntre(inicio: string, fim: string): number {
  return Math.round((toUtc(fim) - toUtc(inicio)) / DIA_MS)
}

export function somarDias(data: string, dias: number): string {
  return fromUtc(toUtc(data) + dias * DIA_MS)
}

/** Último dia do mês de 'aaaa-mm'. */
export function fimDoMes(anoMes: string): string {
  const ano = +anoMes.slice(0, 4), mes = +anoMes.slice(5, 7)
  return fromUtc(Date.UTC(ano, mes, 0))
}

/** Soma (ou subtrai) meses a 'aaaa-mm'. */
export function somarMeses(anoMes: string, n: number): string {
  const d = new Date(Date.UTC(+anoMes.slice(0, 4), +anoMes.slice(5, 7) - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

/** Dia civil em Brasília de um timestamp (leituras antigas só têm atualizado_em). */
export function diaLocalSP(timestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(timestamp))
}

/** Lista 'aaaa-mm' de todos os meses que o intervalo toca. */
export function listarMeses(inicio: string, fim: string): string[] {
  const out: string[] = []
  let m = inicio.slice(0, 7)
  const ultimo = fim.slice(0, 7)
  while (m <= ultimo && out.length < 240) { out.push(m); m = somarMeses(m, 1) }
  return out
}

export type Periodo = { inicio: string; fim: string }
export type AtalhoPeriodo = 'mes-atual' | 'mes-anterior' | 'ultimos-3-meses' | 'ano-atual' | 'ano-anterior'

export function periodoDoAtalho(atalho: AtalhoPeriodo, hoje: string): Periodo {
  const mes = hoje.slice(0, 7), ano = +hoje.slice(0, 4)
  switch (atalho) {
    case 'mes-atual': return { inicio: `${mes}-01`, fim: fimDoMes(mes) }
    case 'mes-anterior': { const m = somarMeses(mes, -1); return { inicio: `${m}-01`, fim: fimDoMes(m) } }
    case 'ultimos-3-meses': return { inicio: `${somarMeses(mes, -2)}-01`, fim: fimDoMes(mes) }
    case 'ano-atual': return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` }
    case 'ano-anterior': return { inicio: `${ano - 1}-01-01`, fim: `${ano - 1}-12-31` }
  }
}

/**
 * Período anterior equivalente. Se o período é feito de meses inteiros, volta o mesmo
 * número de meses (nov → out; jan-dez → jan-dez do ano anterior). Senão, volta o mesmo
 * número de dias, terminando na véspera do início.
 */
export function periodoAnterior({ inicio, fim }: Periodo): Periodo {
  const mesesInteiros = inicio.endsWith('-01') && fim === fimDoMes(fim.slice(0, 7))
  if (mesesInteiros) {
    const n = listarMeses(inicio, fim).length
    const iniMes = somarMeses(inicio.slice(0, 7), -n)
    return { inicio: `${iniMes}-01`, fim: somarDias(inicio, -1) }
  }
  const dias = diasEntre(inicio, fim) + 1
  return { inicio: somarDias(inicio, -dias), fim: somarDias(inicio, -1) }
}

/** Com o que comparar: período imediatamente anterior, mesmo período do ano anterior, ou datas escolhidas. */
export type ModoComparacao = 'anterior' | 'ano-anterior' | 'custom'

/** Mesma data um ano antes (29/02 vira 28/02). */
export function menosUmAno(d: string): string {
  const a = +d.slice(0, 4) - 1, m = d.slice(5, 7)
  const dia = Math.min(+d.slice(8, 10), +fimDoMes(`${a}-${m}`).slice(8, 10))
  return `${a}-${m}-${String(dia).padStart(2, '0')}`
}

/** Período de comparação conforme o modo escolhido (datas livres inválidas caem no período anterior). */
export function periodoComparacao(periodo: Periodo, modo: ModoComparacao, livre?: { inicio?: string | null; fim?: string | null }): Periodo {
  if (modo === 'ano-anterior') {
    const fim = menosUmAno(periodo.fim)
    const fimDeMes = periodo.fim === fimDoMes(periodo.fim.slice(0, 7))
    return { inicio: menosUmAno(periodo.inicio), fim: fimDeMes ? fimDoMes(fim.slice(0, 7)) : fim }
  }
  if (modo === 'custom' && livre?.inicio && livre?.fim && livre.inicio <= livre.fim) return { inicio: livre.inicio, fim: livre.fim }
  return periodoAnterior(periodo)
}

// ─── SÉRIE DE LEITURAS ──────────────────────────────────────────────────────────
export function ordenarLeituras<T extends PontoLeitura>(leituras: T[]): T[] {
  return [...leituras].sort((a, b) => a.data.localeCompare(b.data) || (a.ordem || '').localeCompare(b.ordem || ''))
}

/**
 * Marca as leituras fora da sequência. Horímetro/KM só sobem, então as leituras válidas são a
 * MAIOR sequência crescente possível (em ordem de data); o que fica de fora é inconsistente.
 * Assim, um valor digitado alto demais (ex.: 19.860 no lugar de 1.986) marca só ele mesmo,
 * e não todas as leituras corretas que vêm depois. Empate: mantém as leituras mais antigas.
 * diferenca = valor − última leitura válida antes dela.
 */
export function classificarLeituras(leituras: PontoLeitura[]): PontoClassificado[] {
  const ord = ordenarLeituras(leituras)
  const n = ord.length
  const comp = new Array<number>(n).fill(1)
  const ant = new Array<number>(n).fill(-1)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) { // em empate fica o antecessor mais antigo
      if (ord[j].valor <= ord[i].valor && comp[j] + 1 > comp[i]) { comp[i] = comp[j] + 1; ant[i] = j }
    }
  }
  const validas = new Set<number>()
  if (n) {
    let fim = 0
    for (let i = 1; i < n; i++) if (comp[i] > comp[fim]) fim = i
    for (let k = fim; k >= 0; k = ant[k]) validas.add(k)
  }
  let ultimaValida: PontoLeitura | null = null
  return ord.map((p, i) => {
    const inconsistente = !validas.has(i)
    const diferenca = ultimaValida != null ? p.valor - ultimaValida.valor : null
    if (!inconsistente) ultimaValida = p
    return { ...p, diferenca, inconsistente }
  })
}

const vazio = (ultimaLeitura: string | null, inconsistencias: number): ResultadoUso => ({
  leituraInicial: null, dataInicial: null, leituraFinal: null, dataFinal: null,
  uso: 0, temLeituraNoPeriodo: false, insuficiente: false, usoPorMes: {}, usoPorAno: {}, mesesComLeitura: 0,
  mediaMensal: null, mediaAnual: null, mediaDiaria: null, projecaoAnual: null,
  inconsistencias, ultimaLeitura,
})

/**
 * Uso de uma série no período — usa SÓ as leituras lançadas dentro do período:
 * - uso = última leitura do período − primeira leitura do período (regressivas descartadas);
 * - com uma única leitura no período o uso fica "insuficiente" (precisa de pelo menos 2);
 * - média mensal = uso ÷ meses com leitura; média anual = média das somas por ano;
 * - média diária = uso ÷ dias do período até hoje (mês encerrado = todos os dias; mês atual =
 *   do dia 1 até hoje, ex.: 25/11 → 25 dias);
 * - projeção anual = média mensal × 12.
 * Leituras antes do início só servem pra detectar leitura regressiva.
 */
/** Uso válido pra exibir/somar: null quando não há leitura ou há só 1 no período. */
export function usoValido(r: ResultadoUso | null | undefined): number | null {
  return r && r.temLeituraNoPeriodo && !r.insuficiente ? r.uso : null
}

export function calcularUso(leituras: PontoLeitura[], inicio: string, fim: string, hoje?: string): ResultadoUso {
  const cls = classificarLeituras(leituras.filter(l => l.data <= fim))
  const validas = cls.filter(p => !p.inconsistente)
  const noPeriodo = validas.filter(p => p.data >= inicio)
  const inconsistencias = cls.filter(p => p.inconsistente && p.data >= inicio).length
  const ultimaLeitura = validas.length ? validas[validas.length - 1].data : null
  if (!noPeriodo.length) return vazio(ultimaLeitura, inconsistencias)

  const ini = noPeriodo[0]
  const fin = noPeriodo[noPeriodo.length - 1]
  if (noPeriodo.length < 2) {
    return {
      ...vazio(ultimaLeitura, inconsistencias),
      leituraInicial: ini.valor, dataInicial: ini.data, leituraFinal: fin.valor, dataFinal: fin.data,
      temLeituraNoPeriodo: true, insuficiente: true, mesesComLeitura: 1,
    }
  }
  const uso = fin.valor - ini.valor

  // Cada diferença entre leituras seguidas do período vai pro mês da leitura mais nova.
  const usoPorMes: Record<string, number> = {}
  const meses = new Set<string>()
  let anterior: PontoClassificado | null = null
  for (const p of noPeriodo) {
    const mes = p.data.slice(0, 7)
    meses.add(mes)
    usoPorMes[mes] = (usoPorMes[mes] || 0) + (anterior ? p.valor - anterior.valor : 0)
    anterior = p
  }
  const usoPorAno: Record<string, number> = {}
  for (const [mes, v] of Object.entries(usoPorMes)) usoPorAno[mes.slice(0, 4)] = (usoPorAno[mes.slice(0, 4)] || 0) + v
  const anos = Object.keys(usoPorAno).length

  const mediaMensal = meses.size ? uso / meses.size : null
  const ate = hoje && hoje < fim ? (hoje < inicio ? inicio : hoje) : fim
  const dias = diasEntre(inicio, ate) + 1
  return {
    leituraInicial: ini.valor, dataInicial: ini.data,
    leituraFinal: fin.valor, dataFinal: fin.data,
    uso, temLeituraNoPeriodo: true, insuficiente: false, usoPorMes, usoPorAno,
    mesesComLeitura: meses.size,
    mediaMensal,
    mediaAnual: anos ? uso / anos : null,
    mediaDiaria: dias > 0 ? uso / dias : null,
    projecaoAnual: mediaMensal != null ? mediaMensal * 12 : null,
    inconsistencias, ultimaLeitura,
  }
}

export function diasSemLeitura(ultimaLeitura: string | null, referencia: string): number | null {
  return ultimaLeitura ? Math.max(0, diasEntre(ultimaLeitura, referencia)) : null
}

/** Inconsistente > Atrasada (sem leitura ou mais de `limiteDias` sem leitura) > Em dia. */
export function statusLeitura(inconsistencias: number, dias: number | null, limiteDias: number): StatusLeitura {
  if (inconsistencias > 0) return 'Inconsistente'
  if (dias == null || dias > limiteDias) return 'Atrasada'
  return 'Em dia'
}

/** Variação % (null quando não há base de comparação). */
export function variacaoPercentual(atual: number, anterior: number | null | undefined): number | null {
  if (anterior == null || anterior === 0) return null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

export function media(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x != null)
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

// ─── MONTAGEM POR PLACA ─────────────────────────────────────────────────────────
export type EquipamentoAtivo = { id: string; placa: string; tipo: string | null; categoria: string | null; modulo: string | null }

/** Linha de historico_horimetros já com a data da leitura resolvida. */
export type LeituraBruta = {
  id: string
  equipamento_id: string
  unidade: string
  valor_novo: number
  km_novo: number | null
  data: string
  ordem: string
  por: string | null
  obs: string | null
}

export type LinhaPlaca = {
  equipamento: EquipamentoAtivo
  frota: TipoFrota
  unidade: Unidade
  /** Série principal: horímetro (pesados) ou KM (leves). */
  principal: ResultadoUso
  /** KM dos pesados (quando o modal registrou); null nos leves ou sem KM. */
  km: ResultadoUso | null
  pontos: PontoClassificado[]
  pontosKm: PontoClassificado[]
  ultimaLeitura: string | null
  diasSemLeitura: number | null
  status: StatusLeitura
  inconsistencias: number
}

export function tipoFrota(categoria: string | null, tipo: string | null): TipoFrota {
  return inferUnidadeHorimetro(categoria, tipo) === 'km' ? 'leve' : 'pesado'
}

/** Separa as leituras de uma placa em série de horímetro e série de KM. */
export function seriesDaPlaca(leituras: LeituraBruta[]): { h: PontoLeitura[]; km: PontoLeitura[] } {
  const h: PontoLeitura[] = [], km: PontoLeitura[] = []
  for (const l of leituras) {
    const base = { data: l.data, ordem: l.ordem, id: l.id, por: l.por, obs: l.obs }
    if (l.unidade === 'km') km.push({ ...base, valor: Number(l.valor_novo) })
    else {
      h.push({ ...base, valor: Number(l.valor_novo) })
      if (l.km_novo != null) km.push({ ...base, valor: Number(l.km_novo) })
    }
  }
  return { h, km }
}

export function montarLinhas(
  equipamentos: EquipamentoAtivo[],
  leituras: LeituraBruta[],
  periodo: Periodo,
  hoje: string,
  limiteDias: number,
): LinhaPlaca[] {
  const porEq = new Map<string, LeituraBruta[]>()
  for (const l of leituras) {
    const arr = porEq.get(l.equipamento_id)
    if (arr) arr.push(l); else porEq.set(l.equipamento_id, [l])
  }
  const referencia = periodo.fim < hoje ? periodo.fim : hoje

  return equipamentos.map(eq => {
    const frota = tipoFrota(eq.categoria, eq.tipo)
    const unidade: Unidade = frota === 'leve' ? 'km' : 'h'
    const { h, km } = seriesDaPlaca(porEq.get(eq.id) || [])
    const serieP = frota === 'leve' ? km : h
    const principal = calcularUso(serieP, periodo.inicio, periodo.fim, hoje)
    const kmRes = frota === 'pesado' && km.length ? calcularUso(km, periodo.inicio, periodo.fim, hoje) : null
    const ultimas = [principal.ultimaLeitura, kmRes?.ultimaLeitura].filter((d): d is string => !!d).sort()
    const ultimaLeitura = ultimas.length ? ultimas[ultimas.length - 1] : null
    const dias = diasSemLeitura(ultimaLeitura, referencia)
    const inconsistencias = principal.inconsistencias + (kmRes?.inconsistencias || 0)
    const naoDepoisDoFim = (p: PontoClassificado) => p.data <= periodo.fim
    return {
      equipamento: eq, frota, unidade, principal, km: kmRes,
      pontos: classificarLeituras(serieP).filter(naoDepoisDoFim),
      pontosKm: frota === 'pesado' ? classificarLeituras(km).filter(naoDepoisDoFim) : [],
      ultimaLeitura, diasSemLeitura: dias,
      status: statusLeitura(inconsistencias, dias, limiteDias),
      inconsistencias,
    }
  })
}

// ─── AGREGAÇÕES DO DASHBOARD ────────────────────────────────────────────────────
/** Uso de uma unidade numa linha: horímetro dos pesados; KM dos leves e, se pedido, dos pesados. */
export function usoDaLinha(l: LinhaPlaca, unidade: Unidade): ResultadoUso | null {
  if (unidade === 'h') return l.unidade === 'h' ? l.principal : null
  return l.unidade === 'km' ? l.principal : l.km
}

/** Soma do uso por mês (ou por ano) de todas as linhas, preenchendo meses sem leitura com 0. */
export function serieTemporal(linhas: LinhaPlaca[], unidade: Unidade, periodo: Periodo, visao: VisaoMedia): { chave: string; valor: number }[] {
  const chaves = visao === 'mensal'
    ? listarMeses(periodo.inicio, periodo.fim)
    : Array.from(new Set(listarMeses(periodo.inicio, periodo.fim).map(m => m.slice(0, 4))))
  const tot: Record<string, number> = Object.fromEntries(chaves.map(c => [c, 0]))
  for (const l of linhas) {
    const r = usoDaLinha(l, unidade)
    if (!r) continue
    const fonte = visao === 'mensal' ? r.usoPorMes : r.usoPorAno
    for (const [k, v] of Object.entries(fonte)) if (k in tot) tot[k] += v
  }
  return chaves.map(chave => ({ chave, valor: tot[chave] }))
}

export function usoPorTipo(linhas: LinhaPlaca[], unidade: Unidade): { tipo: string; valor: number; placas: number }[] {
  const acc = new Map<string, { valor: number; placas: number }>()
  for (const l of linhas) {
    const r = usoDaLinha(l, unidade)
    if (!r) continue
    const tipo = l.equipamento.tipo || 'SEM TIPO'
    const a = acc.get(tipo) || { valor: 0, placas: 0 }
    a.valor += r.uso; a.placas += 1
    acc.set(tipo, a)
  }
  return Array.from(acc, ([tipo, a]) => ({ tipo, ...a })).sort((x, y) => y.valor - x.valor)
}

export type Kpis = {
  frotas: number
  horasTotais: number
  kmTotais: number
  mediaH: number | null
  mediaKm: number | null
  semLeitura: number
  inconsistencias: number
}

/**
 * KPIs do painel. "Total de KM" soma só os leves (frota de KM); a média por equipamento
 * usa a média mensal (visão mensal) ou a média anual (visão anual) de cada placa com leitura.
 */
export function calcularKpis(linhas: LinhaPlaca[], visao: VisaoMedia): Kpis {
  const pes = linhas.filter(l => l.unidade === 'h'), lev = linhas.filter(l => l.unidade === 'km')
  const m = (r: ResultadoUso) => (visao === 'mensal' ? r.mediaMensal : r.mediaAnual)
  return {
    frotas: linhas.length,
    horasTotais: pes.reduce((s, l) => s + l.principal.uso, 0),
    kmTotais: lev.reduce((s, l) => s + l.principal.uso, 0),
    mediaH: media(pes.map(l => m(l.principal))),
    mediaKm: media(lev.map(l => m(l.principal))),
    semLeitura: linhas.filter(l => !l.principal.temLeituraNoPeriodo && !l.km?.temLeituraNoPeriodo).length,
    inconsistencias: linhas.reduce((s, l) => s + l.inconsistencias, 0),
  }
}

// ─── FORMATAÇÃO pt-BR ───────────────────────────────────────────────────────────
export function fmtNum(v: number | null | undefined, casas = 0): string {
  if (v == null || !isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })
}

export function fmtData(d: string | null | undefined): string {
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—'
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function rotuloMes(anoMes: string): string {
  return anoMes.length === 4 ? anoMes : `${MESES_CURTOS[+anoMes.slice(5, 7) - 1]}/${anoMes.slice(2, 4)}`
}
