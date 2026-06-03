// Inline type — evita importar de módulo "use server"
interface DashboardDataLocal {
  dm: number;
  doOperacional: number;
  mtbf: number;
  mttr: number;
  backlog: number;
  totalVeiculosAtivos: number;
  totalOS: number;
  emAndamento: number;
  osFechadas: number;
  horasManutencao: number;
  periodoLabel: string;
  data_inicio?: string;
  data_fim?: string;
  veiculos?: Array<{
    placa: string;
    disponibilidade: number;
    disponibilidade_operacional: number;
    totalOS: number;
    horasManut: number;
    horasOperacional: number;
  }>;
  rankingFalhas?: Array<{ placa: string; falhas: number; mtbf: number; diasManut?: number }>;
  paradasPorCategoria?: Array<{ categoria: string; quantidade: number }>;
  manutPorTipo?: Array<{ tipo: string; quantidade: number }>;
  preventivas?: Array<{ placa: string; horas_restantes: number; status: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(v: number) { return `${v.toFixed(1)}%`; }
function h(v: number | null | undefined) { return v != null ? `${v}h` : '—'; }


function statusCor(val: number) {
  if (val >= 95) return '#22c55e';
  if (val >= 90) return '#f59e0b';
  return '#ef4444';
}
function statusLabel(val: number) {
  if (val >= 95) return '<span style="color:#22c55e;font-weight:800">✅ DENTRO DA META</span>';
  if (val >= 90) return '<span style="color:#f59e0b;font-weight:800">⚠️ ATENÇÃO</span>';
  return '<span style="color:#ef4444;font-weight:800">🔴 CRÍTICO</span>';
}
function bar(val: number, max = 100) {
  const w = Math.min(val, max);
  const c = statusCor(val);
  return `<div style="background:#1e293b;border-radius:4px;height:8px;width:100%;margin-top:4px"><div style="background:${c};width:${w}%;height:8px;border-radius:4px"></div></div>`;
}
function bigBar(val: number, label: string) {
  const c = statusCor(val);
  return `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:12px;color:#94a3b8">${label}</span>
        <span style="font-size:13px;font-weight:700;color:${c}">${pct(val)}</span>
      </div>
      <div style="background:#1e293b;border-radius:6px;height:14px"><div style="background:${c};width:${Math.min(val,100)}%;height:14px;border-radius:6px"></div></div>
    </div>`;
}

// ─── Análise inteligente PCM ──────────────────────────────────────────────────

function analiseDM(dm: number, mttr: number, mtbf: number, totalOS: number, abertas: number): string {
  const eff = mttr > 0 && mtbf > 0;
  let text = '';
  if (dm >= 95) {
    text = `A <strong>Disponibilidade Mecânica (DM) de ${pct(dm)}</strong> demonstra excelência operacional, superando a meta de 95% estabelecida pelo PCM. 
    A equipe de manutenção está performando acima do padrão de classe mundial.`;
  } else if (dm >= 90) {
    text = `A <strong>DM de ${pct(dm)}</strong> está abaixo da meta de 95%. Existe um gap de <strong>${pct(95 - dm)}</strong> a ser recuperado. 
    O plano de manutenção preventiva (PMP) deve ser revisado para reduzir o tempo médio de parada por falha mecânica.`;
  } else {
    text = `<strong>ALERTA CRÍTICO:</strong> A DM de <strong>${pct(dm)}</strong> está gravemente abaixo da meta de 95% — gap de ${pct(95 - dm)}. 
    Situação exige intervenção imediata do PCM: auditoria do PMP, alocação emergencial de recursos e plano de recuperação de disponibilidade.`;
  }
  if (eff) {
    text += ` O MTBF de <strong>${h(mtbf)}</strong> indica a confiabilidade média entre falhas, enquanto o MTTR de <strong>${h(mttr)}</strong> representa o tempo médio de reparo. `;
    if (mttr > 48) text += `O MTTR elevado (>48h) sugere gargalos no processo de diagnóstico, disponibilidade de peças ou mão de obra. `;
    if (mtbf > 0 && mtbf < 200) text += `O MTBF baixo (<200h) indica alta frequência de falhas — revisar planos de lubrificação e inspeção técnica. `;
  }
  if (abertas > totalOS * 0.3) text += ` <strong>${abertas} OS em aberto</strong> (${Math.round(abertas/totalOS*100)}% do total) representam risco de acúmulo de backlog. Priorize a execução das OS corretivas abertas.`;
  return text;
}

function analyseDO(doOp: number, dm: number, horasOp: number): string {
  const delta = Math.abs(dm - doOp).toFixed(1);
  let text = `A <strong>Disponibilidade Operacional (DO) de ${pct(doOp)}</strong> `;
  if (doOp >= 95) {
    text += `está dentro da meta, indicando que a frota está disponível para operação na maior parte do tempo planejado.`;
  } else if (doOp >= 90) {
    text += `está abaixo da meta de 95%. Além das paradas mecânicas, fatores operacionais (reservas, aguardo de operador, abastecimento) estão impactando a disponibilidade líquida.`;
  } else {
    text += `está criticamente abaixo da meta. A frota está indisponível para operação por mais de 10% do tempo planejado — impacto direto na produtividade e no OEE.`;
  }
  if (Number(delta) > 3) {
    text += ` O gap de <strong>${delta}%</strong> entre DM e DO revela que paradas não-mecânicas (aguardo, reservas, preparação) estão consumindo disponibilidade adicional. Recomenda-se análise das paradas operacionais com o setor de operações.`;
  }
  if (horasOp > 0) {
    text += ` Foram totalizadas <strong>${h(horasOp)}</strong> em indisponibilidade operacional no período.`;
  }
  return text;
}

function analyseBacklog(backlog: number, abertas: number, totalOS: number): string {
  if (backlog <= 0 && abertas === 0) {
    return `Não há backlog registrado no período. Todas as ordens de serviço foram executadas dentro do prazo — indicativo de alta eficiência da equipe de manutenção.`;
  }
  let text = '';
  if (backlog > 0) {
    text = `O backlog acumulado de <strong>${backlog} dias</strong> de manutenção indica serviços planejados ou corretivos que não foram executados. `;
    if (backlog > 30) text += `Backlog acima de 30 dias representa risco operacional crítico. Revise prioridades, dimensione a equipe e avalie subcontratação. `;
    else if (backlog > 7) text += `Backlog moderado — monitorar semanalmente e garantir que OS prioritárias (segurança e produção) sejam executadas primeiro. `;
    else text += `Backlog dentro de limite razoável. Mantenha o ritmo de execução para eliminar o déficit. `;
  }
  if (abertas > 0) {
    const pctAberta = Math.round(abertas / (totalOS || 1) * 100);
    text += `Existem <strong>${abertas} OS em aberto</strong> (${pctAberta}% do total de ${totalOS} OS). `;
    if (pctAberta > 40) text += `Taxa de abertura acima de 40% é preocupante — priorize fechamento e análise de causa raiz das OS mais antigas.`;
  }
  return text;
}

function analysePreventivas(prevAtrasadas: number, prevAtencao: number, prevOk: number): string {
  const total = prevAtrasadas + prevAtencao + prevOk;
  if (total === 0) return 'Sem dados de controle de horímetros registrados no período.';
  const pctAtrasado = Math.round(prevAtrasadas / total * 100);
  if (prevAtrasadas === 0 && prevAtencao === 0)
    return `Todos os <strong>${total} controles de horímetros</strong> estão no prazo. Excelente gestão do PMP! Mantenha o cronograma de lubrificações, revisões e inspeções técnicas.`;
  let text = `Do total de <strong>${total} equipamentos monitorados</strong> por horímetro: `;
  text += `<strong style="color:#ef4444">${prevAtrasadas} atrasados</strong> (${pctAtrasado}%), `;
  text += `<strong style="color:#f59e0b">${prevAtencao} em atenção</strong> e `;
  text += `<strong style="color:#22c55e">${prevOk} no prazo</strong>. `;
  if (prevAtrasadas > 0)
    text += `Equipamentos atrasados na preventiva têm probabilidade até 3x maior de falha corretiva. Programar manutenção imediata dos ${prevAtrasadas} equipamentos em atraso é prioridade máxima do PCM.`;
  return text;
}

// ─── CSS base ─────────────────────────────────────────────────────────────────

const BASE_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0f1e;font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
  .slide{display:none;min-height:100vh;padding:52px 72px;flex-direction:column;justify-content:flex-start;border-bottom:2px solid #1e293b;page-break-after:always;position:relative;animation:fadeIn .3s ease}
  .slide.active{display:flex}
  @keyframes fadeIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
  .cover{background:radial-gradient(ellipse at 60% 30%,#1e1b4b 0%,#0a0f1e 60%);align-items:center;text-align:center;justify-content:center}
  .badge{display:inline-block;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.35);color:#818cf8;padding:6px 18px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:22px}
  h1.cover-title{font-size:54px;font-weight:900;background:linear-gradient(135deg,#60a5fa,#a78bfa 50%,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1.12;margin-bottom:14px}
  .cover-periodo{font-size:22px;color:#94a3b8;margin-bottom:6px}
  .cover-meta{font-size:13px;color:#475569;margin-top:36px;line-height:1.8}
  .slide-header{display:flex;align-items:center;gap:12px;margin-bottom:6px}
  .slide-num{font-size:10px;color:#4f6282;text-transform:uppercase;letter-spacing:2px;font-weight:700;border-right:1px solid #1e293b;padding-right:12px}
  .slide-section{font-size:10px;color:#3b82f6;text-transform:uppercase;letter-spacing:2.5px;font-weight:700}
  h2.slide-title{font-size:26px;font-weight:800;color:#f1f5f9;margin-bottom:4px}
  .slide-sub{font-size:13px;color:#64748b;margin-bottom:24px;line-height:1.5}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
  .kpi{background:#111827;border:1px solid #1e293b;border-radius:16px;padding:20px;position:relative;overflow:hidden}
  .kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--accent,#3b82f6)}
  .kpi-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px}
  .kpi-val{font-size:30px;font-weight:900;line-height:1;margin-bottom:4px}
  .kpi-sub{font-size:11px;color:#64748b;line-height:1.4}
  .kpi-meta{font-size:10px;color:#374151;margin-top:6px}
  .analysis{background:#111827;border:1px solid #1e293b;border-left:3px solid #3b82f6;border-radius:12px;padding:18px 22px;margin-top:18px}
  .analysis-warn{border-left-color:#f59e0b}
  .analysis-danger{border-left-color:#ef4444}
  .analysis-success{border-left-color:#22c55e}
  .analysis h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#3b82f6;margin-bottom:8px}
  .analysis-warn h3{color:#f59e0b}
  .analysis-danger h3{color:#ef4444}
  .analysis-success h3{color:#22c55e}
  .analysis p{font-size:13px;color:#94a3b8;line-height:1.75}
  .analysis p strong{color:#e2e8f0}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
  .card{background:#111827;border:1px solid #1e293b;border-radius:14px;padding:18px}
  .card h4{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  thead tr{background:#0d1117}
  th{text-align:left;padding:9px 12px;font-size:10px;color:#4f6282;text-transform:uppercase;letter-spacing:1.2px;border-bottom:1px solid #1e293b;white-space:nowrap}
  td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.04)}
  tr:hover td{background:rgba(59,130,246,.04)}
  .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700}
  .pill-green{background:rgba(34,197,94,.12);color:#22c55e}
  .pill-amber{background:rgba(245,158,11,.12);color:#f59e0b}
  .pill-red{background:rgba(239,68,68,.12);color:#ef4444}
  .pill-blue{background:rgba(59,130,246,.12);color:#60a5fa}
  .divider{height:1px;background:#1e293b;margin:18px 0}
  .nav{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:100;align-items:center}
  .nav button{background:#111827;border:1px solid #1e293b;color:#94a3b8;padding:9px 18px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;transition:all .15s}
  .nav button:hover{background:#1e293b;color:#f1f5f9}
  .nav .btn-primary{background:#3b82f6;color:#fff;border-color:#3b82f6}
  .nav .btn-primary:hover{background:#2563eb}
  .counter{padding:8px 18px;background:#111827;border:1px solid #1e293b;border-radius:10px;font-size:12px;color:#64748b;font-weight:600}
  .progress-outer{background:#1e293b;border-radius:6px;height:10px;overflow:hidden;margin-top:6px}
  .progress-inner{height:10px;border-radius:6px}
  .tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 10px;border-radius:6px;font-weight:600}
  @media print{.nav,.counter{display:none}.slide{page-break-after:always;min-height:100vh;display:flex!important;animation:none}}
`;

// ─── Main export ──────────────────────────────────────────────────────────────

export function gerarSlideHTML(data: DashboardDataLocal, periodo: string, categoria: string): string {
  const dm = data.dm ?? 0;
  const doOp = data.doOperacional ?? 0;
  const mtbf = data.mtbf ?? 0;
  const mttr = data.mttr ?? 0;
  const backlog = data.backlog ?? 0;
  const frota = data.totalVeiculosAtivos ?? 0;
  const totalOS = data.totalOS ?? 0;
  const abertas = data.emAndamento ?? 0;
  const fechadas = data.osFechadas ?? 0;
  const horasMec = data.horasManutencao ?? 0;
  const geradoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Preventivas
  const prevs = data.preventivas ?? [];
  const prevAtrasadas = prevs.filter(p => p.status === 'atrasado').length;
  const prevAtencao = prevs.filter(p => p.status === 'atencao').length;
  const prevOk = prevs.filter(p => p.status === 'no_prazo').length;
  const prevTotal = prevs.length;

  // Top 5 piores DM
  const top5 = [...(data.veiculos ?? [])].sort((a, b) => a.disponibilidade - b.disponibilidade).slice(0, 8);

  // Ranking Falhas
  const falhas = [...(data.rankingFalhas ?? [])].slice(0, 8);

  // Paradas por Categoria — campo: { categoria, quantidade }
  const paradas = data.paradasPorCategoria ?? [];
  const totalParadas = paradas.reduce((s: number, p: any) => s + (p.quantidade ?? 0), 0);

  // Manut por Tipo — campo: { tipo, quantidade }
  const manutTipo = data.manutPorTipo ?? [];
  const totalManutTipo = manutTipo.reduce((s: number, m: any) => s + (m.quantidade ?? 0), 0);

  // Eficiência manutenção
  const txFechamento = totalOS > 0 ? Math.round(fechadas / totalOS * 100) : 0;
  const txAbertura = totalOS > 0 ? Math.round(abertas / totalOS * 100) : 0;

  // Preventivas no PMP
  const preventivosQtd = manutTipo.find((m: any) => (m.tipo || '').toUpperCase().includes('PREV'))?.quantidade ?? 0;
  const corretivasQtd = manutTipo.find((m: any) => (m.tipo || '').toUpperCase().includes('CORR'))?.quantidade ?? 0;
  const txPreventiva = totalManutTipo > 0 ? Math.round(preventivosQtd / totalManutTipo * 100) : 0;
  const txCorretiva = totalManutTipo > 0 ? Math.round(corretivasQtd / totalManutTipo * 100) : 0;

  // ── Análises textuais PCM
  const dmAnalise = analiseDM(dm, mttr, mtbf, totalOS, abertas);
  const doAnalise = analyseDO(doOp, dm, data.veiculos?.reduce((s, v) => s + (v.horasOperacional ?? 0), 0) ?? 0);
  const backlogAnalise = analyseBacklog(backlog, abertas, totalOS);
  const prevAnalise = analysePreventivas(prevAtrasadas, prevAtencao, prevOk);

  // ── Rows tabela veículos críticos
  const rowsVeiculos = top5.length > 0
    ? top5.map(v => `
        <tr>
          <td style="font-weight:700;color:#f1f5f9;font-size:13px">${v.placa ?? '—'}</td>
          <td>
            <span style="color:${statusCor(v.disponibilidade)};font-weight:700">${pct(v.disponibilidade)}</span>
            ${bar(v.disponibilidade)}
          </td>
          <td>
            <span style="color:${statusCor(v.disponibilidade_operacional)};font-weight:700">${pct(v.disponibilidade_operacional)}</span>
            ${bar(v.disponibilidade_operacional)}
          </td>
          <td style="text-align:center"><span class="pill ${v.totalOS > 5 ? 'pill-red' : v.totalOS > 2 ? 'pill-amber' : 'pill-blue'}">${v.totalOS ?? 0}</span></td>
          <td style="text-align:center;color:#a78bfa;font-weight:600">${h(v.horasManut)}</td>
          <td style="text-align:center;color:#64748b">${h(v.horasOperacional)}</td>
        </tr>`)
    .join('')
    : `<tr><td colspan="6" style="text-align:center;color:#4f6282;padding:24px">Sem dados de veículos para o período selecionado</td></tr>`;

  // ── Rows ranking falhas
  const rowsFalhas = falhas.length > 0
    ? falhas.map((f: any, i: number) => `
        <tr>
          <td style="font-weight:700;color:#f59e0b">#${i + 1}</td>
          <td style="font-weight:700;color:#f1f5f9">${f.placa ?? '—'}</td>
          <td style="text-align:center;font-weight:800;color:#ef4444">${f.falhas ?? '—'}</td>
          <td style="text-align:center;color:#e2e8f0;font-weight:600">${f.diasManut != null ? `${f.diasManut}d` : '0d'}</td>
          <td style="text-align:center;color:#60a5fa;font-weight:600">${f.mtbf != null ? h(f.mtbf) : '—'}</td>
        </tr>`)
    .join('')
    : `<tr><td colspan="5" style="text-align:center;color:#4f6282;padding:24px">Sem dados de falhas no período</td></tr>`;

  // ── Rows paradas por categoria
  const rowsParadas = paradas.length > 0
    ? paradas.map((p: any) => {
        const qty = p.quantidade ?? 0;
        const pct2 = totalParadas > 0 ? Math.round(qty / totalParadas * 100) : 0;
        return `
        <tr>
          <td style="color:#f1f5f9;font-weight:600">${p.categoria ?? '—'}</td>
          <td style="text-align:center"><span class="pill pill-blue">${qty}</span></td>
          <td style="text-align:center;color:#64748b">${pct2}%</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#4f6282;padding:24px">Sem dados de paradas por categoria</td></tr>`;

  // ── Rows manut por tipo
  const rowsManutTipo = manutTipo.length > 0
    ? manutTipo.map((m: any) => {
        const qty = m.quantidade ?? 0;
        const pct2 = totalManutTipo > 0 ? Math.round(qty / totalManutTipo * 100) : 0;
        const tipo = (m.tipo ?? '').toUpperCase();
        const cls = tipo.includes('PREV') ? 'pill-green' : tipo.includes('CORR') ? 'pill-red' : 'pill-amber';
        return `
        <tr>
          <td style="color:#f1f5f9;font-weight:600">${m.tipo ?? '—'}</td>
          <td style="text-align:center"><span class="pill ${cls}">${qty}</span></td>
          <td style="text-align:center;color:#64748b">${pct2}%</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#4f6282;padding:24px">Sem dados de manutenção por tipo</td></tr>`;

  // ── Rows horímetros (preventivas)
  const rowsHorimetros = prevs.length > 0
    ? [...prevs].sort((a, b) => a.horas_restantes - b.horas_restantes).slice(0, 10).map(p => {
        const pill = p.status === 'atrasado' ? 'pill-red' : p.status === 'atencao' ? 'pill-amber' : 'pill-green';
        const icon = p.status === 'atrasado' ? '🔴' : p.status === 'atencao' ? '⚠️' : '✅';
        return `
        <tr>
          <td style="font-weight:700;color:#f1f5f9">${p.placa}</td>
          <td style="text-align:center"><span class="pill ${pill}">${icon} ${p.status === 'atrasado' ? 'Atrasado' : p.status === 'atencao' ? 'Atenção' : 'No Prazo'}</span></td>
          <td style="text-align:center;color:${p.horas_restantes < 0 ? '#ef4444' : p.horas_restantes < 50 ? '#f59e0b' : '#22c55e'};font-weight:700">
            ${p.horas_restantes < 0 ? `${Math.abs(p.horas_restantes)}h VENCIDO` : `${p.horas_restantes}h restantes`}
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#4f6282;padding:24px">Sem dados de horímetro cadastrados</td></tr>`;

  // ── Plano de ação dinâmico
  const acoesPrioritarias: string[] = [];
  if (dm < 95) acoesPrioritarias.push(`Elevar DM de ${pct(dm)} para meta de 95% — gap de ${pct(95 - dm)}`);
  if (doOp < 95) acoesPrioritarias.push(`Elevar DO de ${pct(doOp)} para meta de 95% — revisar paradas operacionais`);
  if (abertas > 0) acoesPrioritarias.push(`Fechar ${abertas} OS em aberto priorizando corretivas`);
  if (prevAtrasadas > 0) acoesPrioritarias.push(`Agendar manutenção preventiva de ${prevAtrasadas} equip. com horímetro vencido`);
  if (mttr > 48) acoesPrioritarias.push(`Reduzir MTTR (atual ${h(mttr)}) — revisar processo de diagnóstico e estoque de peças`);
  if (backlog > 0) acoesPrioritarias.push(`Eliminar backlog de ${backlog} dias — planejar execução das OS pendentes`);
  if (txCorretiva > 50) acoesPrioritarias.push(`Rebalancear mix: corretiva em ${txCorretiva}% — meta ≤ 30%. Aumentar preventivas.`);
  if (acoesPrioritarias.length === 0) acoesPrioritarias.push('Manter padrão de excelência e revisar o PMP para próximo período');

  const pontosPositivos: string[] = [];
  if (dm >= 95) pontosPositivos.push(`DM em ${pct(dm)} — acima da meta de 95%`);
  if (doOp >= 95) pontosPositivos.push(`DO em ${pct(doOp)} — frota operacionalmente disponível`);
  if (fechadas > abertas) pontosPositivos.push(`${fechadas} OS concluídas (${txFechamento}% de taxa de fechamento)`);
  if (prevOk > prevAtrasadas) pontosPositivos.push(`${prevOk} equipamentos com horímetro no prazo`);
  if (mttr > 0 && mttr <= 24) pontosPositivos.push(`MTTR eficiente de ${h(mttr)} — equipe ágil`);
  if (pontosPositivos.length === 0) pontosPositivos.push('Dados coletados — análise disponível para o período');

  const dmStatus = dm >= 95 ? 'DENTRO DA META' : dm >= 90 ? 'ATENÇÃO' : 'CRÍTICO';
  const doStatus = doOp >= 95 ? 'DENTRO DA META' : doOp >= 90 ? 'ATENÇÃO' : 'CRÍTICO';

  const liAcoes = acoesPrioritarias.map(a => `<li>▸ ${a}</li>`).join('');
  const liPositivos = pontosPositivos.map(p => `<li>▸ ${p}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório PCM – ${periodo}</title>
<style>${BASE_CSS}</style>
</head>
<body>

<!-- ═══ SLIDE 1 · CAPA ═══════════════════════════════════════════════════════ -->
<div class="slide cover active" id="s1">
  <div>
    <div class="badge">PCM · Planejamento e Controle de Manutenção</div>
    <h1 class="cover-title">Relatório de<br>Desempenho da Frota</h1>
    <p class="cover-periodo">Período: <strong style="color:#e2e8f0">${periodo}</strong></p>
    <p class="cover-periodo" style="font-size:16px">Frota: <strong style="color:#e2e8f0">${categoria}</strong> &nbsp;|&nbsp; ${frota} equipamentos ativos</p>
    <div style="display:flex;justify-content:center;gap:40px;margin-top:40px">
      <div style="text-align:center">
        <div style="font-size:42px;font-weight:900;color:${statusCor(dm)}">${pct(dm)}</div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">DM · Disp. Mecânica</div>
      </div>
      <div style="width:1px;background:#1e293b"></div>
      <div style="text-align:center">
        <div style="font-size:42px;font-weight:900;color:${statusCor(doOp)}">${pct(doOp)}</div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">DO · Disp. Operacional</div>
      </div>
      <div style="width:1px;background:#1e293b"></div>
      <div style="text-align:center">
        <div style="font-size:42px;font-weight:900;color:#a78bfa">${totalOS}</div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-top:4px">OS no período</div>
      </div>
    </div>
    <p class="cover-meta">Sistema EUNAMAN · Controle de Manutenção Industrial<br>Gerado em ${geradoEm}</p>
  </div>
</div>

<!-- ═══ SLIDE 2 · INDICADORES KPI ══════════════════════════════════════════════ -->
<div class="slide" id="s2">
  <div class="slide-header"><span class="slide-num">Slide 01</span><span class="slide-section">Indicadores Estratégicos</span></div>
  <h2 class="slide-title">Painel de KPIs — Visão Geral</h2>
  <p class="slide-sub">Consolidação dos principais indicadores de desempenho de manutenção (PCM) para o período ${periodo}.</p>

  <div class="kpi-grid">
    <div class="kpi" style="--accent:${statusCor(dm)}">
      <div class="kpi-label">DM · Disponibilidade Mecânica</div>
      <div class="kpi-val" style="color:${statusCor(dm)}">${pct(dm)}</div>
      <div class="progress-outer"><div class="progress-inner" style="width:${Math.min(dm,100)}%;background:${statusCor(dm)}"></div></div>
      <div class="kpi-meta">Meta: ≥ 95% &nbsp;|&nbsp; ${dmStatus}</div>
    </div>
    <div class="kpi" style="--accent:${statusCor(doOp)}">
      <div class="kpi-label">DO · Disponibilidade Operacional</div>
      <div class="kpi-val" style="color:${statusCor(doOp)}">${pct(doOp)}</div>
      <div class="progress-outer"><div class="progress-inner" style="width:${Math.min(doOp,100)}%;background:${statusCor(doOp)}"></div></div>
      <div class="kpi-meta">Meta: ≥ 95% &nbsp;|&nbsp; ${doStatus}</div>
    </div>
    <div class="kpi" style="--accent:#a78bfa">
      <div class="kpi-label">MTBF · Tempo Médio Entre Falhas</div>
      <div class="kpi-val" style="color:#a78bfa">${mtbf > 0 ? h(mtbf) : '—'}</div>
      <div class="kpi-sub">Mede a confiabilidade da frota.<br>Quanto maior, menos falhas ocorrem.</div>
    </div>
    <div class="kpi" style="--accent:#fb923c">
      <div class="kpi-label">MTTR · Tempo Médio de Reparo</div>
      <div class="kpi-val" style="color:#fb923c">${mttr > 0 ? h(mttr) : '—'}</div>
      <div class="kpi-sub">Eficiência do reparo/diagnóstico.<br>Meta: quanto menor, melhor.</div>
    </div>
    <div class="kpi" style="--accent:#60a5fa">
      <div class="kpi-label">Frota Ativa</div>
      <div class="kpi-val" style="color:#60a5fa">${frota}</div>
      <div class="kpi-sub">equipamentos monitorados no período</div>
    </div>
    <div class="kpi" style="--accent:#e2e8f0">
      <div class="kpi-label">Total de Ordens de Serviço</div>
      <div class="kpi-val">${totalOS}</div>
      <div class="kpi-sub">${abertas} abertas &nbsp;·&nbsp; ${fechadas} concluídas<br>Taxa fechamento: ${txFechamento}%</div>
    </div>
    <div class="kpi" style="--accent:${backlog > 30 ? '#ef4444' : backlog > 7 ? '#f59e0b' : '#22c55e'}">
      <div class="kpi-label">Backlog de Manutenção</div>
      <div class="kpi-val" style="color:${backlog > 30 ? '#ef4444' : backlog > 7 ? '#f59e0b' : '#22c55e'}">${backlog > 0 ? `${backlog}d` : 'Zero'}</div>
      <div class="kpi-sub">${backlog === 0 ? 'Sem acúmulo de serviços' : `${backlog} dias de serviços acumulados`}</div>
    </div>
    <div class="kpi" style="--accent:#f97316">
      <div class="kpi-label">Horas de Indisponibilidade</div>
      <div class="kpi-val" style="color:#f97316">${h(horasMec)}</div>
      <div class="kpi-sub">Horas totais de parada mecânica<br>no período selecionado</div>
    </div>
  </div>

  <div class="analysis ${dm < 90 ? 'analysis-danger' : dm < 95 ? 'analysis-warn' : 'analysis-success'}">
    <h3>🧠 Síntese Executiva PCM</h3>
    <p>A frota apresenta DM de <strong>${pct(dm)}</strong> e DO de <strong>${pct(doOp)}</strong> no período. 
    ${totalOS} ordens de serviço foram registradas — ${txFechamento}% concluídas. 
    ${prevAtrasadas > 0 ? `<strong style="color:#ef4444">${prevAtrasadas} equipamentos com horímetro vencido</strong> aguardam manutenção preventiva.` : prevTotal > 0 ? `Todos os ${prevTotal} horímetros monitorados estão no prazo.` : ''}
    ${backlog > 0 ? ` Backlog acumulado de ${backlog} dias requer atenção.` : ''}</p>
  </div>
</div>

<!-- ═══ SLIDE 3 · ANÁLISE DM ════════════════════════════════════════════════════ -->
<div class="slide" id="s3">
  <div class="slide-header"><span class="slide-num">Slide 02</span><span class="slide-section">Disponibilidade Mecânica</span></div>
  <h2 class="slide-title">Análise de DM — Disponibilidade Mecânica</h2>
  <p class="slide-sub">A DM mede a proporção de tempo em que os equipamentos estão mecanicamente disponíveis para operação. Meta PCM: ≥ 95%.</p>

  <div class="two-col" style="margin-bottom:20px">
    <div>
      ${bigBar(dm, 'DM Atual')}
      ${bigBar(95, 'Meta')}
      ${bigBar(Math.min(dm, 100), 'Eficiência DM')}
      <div class="divider"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:4px">
        <div class="card" style="text-align:center">
          <div style="font-size:10px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">MTBF</div>
          <div style="font-size:22px;font-weight:800;color:#a78bfa">${mtbf > 0 ? h(mtbf) : '—'}</div>
          <div style="font-size:10px;color:#475569;margin-top:4px">Entre Falhas</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-size:10px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">MTTR</div>
          <div style="font-size:22px;font-weight:800;color:#fb923c">${mttr > 0 ? h(mttr) : '—'}</div>
          <div style="font-size:10px;color:#475569;margin-top:4px">Tempo Reparo</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-size:10px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Hs Indisp.</div>
          <div style="font-size:22px;font-weight:800;color:#f97316">${h(horasMec)}</div>
          <div style="font-size:10px;color:#475569;margin-top:4px">Total Período</div>
        </div>
      </div>
    </div>
    <div>
      <div class="card" style="height:100%">
        <h4>OS por Status</h4>
        <div style="margin:8px 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#94a3b8;font-size:13px">Abertas / Em Andamento</span><span style="color:#f59e0b;font-weight:700">${abertas}</span></div>
          <div class="progress-outer"><div class="progress-inner" style="width:${txAbertura}%;background:#f59e0b"></div></div>
        </div>
        <div style="margin:8px 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#94a3b8;font-size:13px">Concluídas / Fechadas</span><span style="color:#22c55e;font-weight:700">${fechadas}</span></div>
          <div class="progress-outer"><div class="progress-inner" style="width:${txFechamento}%;background:#22c55e"></div></div>
        </div>
        <div class="divider"></div>
        <div style="display:flex;justify-content:space-between"><span style="color:#64748b;font-size:12px">Total de OS</span><span style="color:#e2e8f0;font-weight:700">${totalOS}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:8px"><span style="color:#64748b;font-size:12px">Taxa de Fechamento</span><span style="color:${txFechamento >= 70 ? '#22c55e' : txFechamento >= 50 ? '#f59e0b' : '#ef4444'};font-weight:700">${txFechamento}%</span></div>
      </div>
    </div>
  </div>

  <div class="analysis ${dm < 90 ? 'analysis-danger' : dm < 95 ? 'analysis-warn' : 'analysis-success'}">
    <h3>📊 Análise PCM — Disponibilidade Mecânica</h3>
    <p>${dmAnalise}</p>
  </div>
</div>

<!-- ═══ SLIDE 4 · ANÁLISE DO ════════════════════════════════════════════════════ -->
<div class="slide" id="s4">
  <div class="slide-header"><span class="slide-num">Slide 03</span><span class="slide-section">Disponibilidade Operacional</span></div>
  <h2 class="slide-title">Análise de DO — Disponibilidade Operacional</h2>
  <p class="slide-sub">A DO incorpora além das paradas mecânicas as indisponibilidades operacionais (reservas, aguardo, setup). Meta PCM: ≥ 95%.</p>

  <div class="two-col">
    <div>
      <div class="card">
        <h4>Comparativo DM vs DO</h4>
        ${bigBar(dm, 'DM · Disponibilidade Mecânica')}
        ${bigBar(doOp, 'DO · Disponibilidade Operacional')}
        ${bigBar(95, 'Meta PCM (≥ 95%)')}
        <div class="divider"></div>
        <p style="font-size:12px;color:#64748b">Gap DM→DO: <strong style="color:${Math.abs(dm-doOp) > 3 ? '#f59e0b' : '#22c55e'}">${Math.abs(dm-doOp).toFixed(1)}%</strong> — ${Math.abs(dm-doOp) > 3 ? 'paradas operacionais impactam a frota' : 'gap aceitável'}</p>
      </div>
    </div>
    <div>
      <div class="card">
        <h4>Composição das Horas</h4>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
              <span style="color:#94a3b8">Horas Indisponibilidade Mecânica</span>
              <span style="color:#f97316;font-weight:700">${h(horasMec)}</span>
            </div>
            <div class="progress-outer"><div class="progress-inner" style="width:${Math.min(100-dm, 100)}%;background:#f97316"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
              <span style="color:#94a3b8">Horas Indisponibilidade Operacional</span>
              <span style="color:#60a5fa;font-weight:700">${h(data.veiculos?.reduce((s,v) => s+(v.horasOperacional??0),0)??0)}</span>
            </div>
            <div class="progress-outer"><div class="progress-inner" style="width:${Math.min(100-doOp,100)}%;background:#60a5fa"></div></div>
          </div>
        </div>
        <div class="divider"></div>
        <p style="font-size:11px;color:#475569;line-height:1.6">
          DM considera apenas <em>paradas por falha mecânica</em>.<br>
          DO inclui <em>todas as indisponibilidades</em> (mecânica + operacional).<br>
          Diferença entre DM e DO = impacto das paradas não-mecânicas.
        </p>
      </div>
    </div>
  </div>

  <div class="analysis ${doOp < 90 ? 'analysis-danger' : doOp < 95 ? 'analysis-warn' : 'analysis-success'}">
    <h3>📋 Análise PCM — Disponibilidade Operacional</h3>
    <p>${doAnalise}</p>
  </div>
</div>

<!-- ═══ SLIDE 5 · EQUIPAMENTOS CRÍTICOS ════════════════════════════════════════ -->
<div class="slide" id="s5">
  <div class="slide-header"><span class="slide-num">Slide 04</span><span class="slide-section">Análise por Equipamento</span></div>
  <h2 class="slide-title">Equipamentos Críticos — Menor Disponibilidade</h2>
  <p class="slide-sub">Os equipamentos listados abaixo possuem a menor DM no período e exigem priorização imediata do PCM para ações corretivas e preventivas.</p>

  <div style="background:#111827;border:1px solid #1e293b;border-radius:14px;overflow:hidden;margin-bottom:16px">
    <table>
      <thead>
        <tr>
          <th>Placa</th>
          <th>DM (Mecânica)</th>
          <th>DO (Operacional)</th>
          <th style="text-align:center">Qtd OS</th>
          <th style="text-align:center">Hs Mec.</th>
          <th style="text-align:center">Hs Op.</th>
        </tr>
      </thead>
      <tbody>${rowsVeiculos}</tbody>
    </table>
  </div>

  <div class="analysis">
    <h3>🔧 Recomendação PCM — Ativos Críticos</h3>
    <p>Para os equipamentos com DM abaixo de 90%: (1) abra OS de investigação de causa raiz; (2) verifique se o plano de manutenção preventiva está sendo executado; (3) analise frequência de falhas no mesmo sistema/componente — repetição indica necessidade de substituição preventiva; (4) considere inclusão em programa de manutenção preditiva (análise de vibração, termografia, análise de óleo).</p>
  </div>
</div>

<!-- ═══ SLIDE 6 · BACKLOG & CONTROLE DE HORIMETROS ════════════════════════════ -->
<div class="slide" id="s6">
  <div class="slide-header"><span class="slide-num">Slide 05</span><span class="slide-section">Backlog &amp; Controle de Horímetros</span></div>
  <h2 class="slide-title">Gestão do Backlog e Horímetros</h2>
  <p class="slide-sub">O backlog representa serviços acumulados não executados. O controle de horímetros garante que o PMP seja executado dentro dos intervalos definidos.</p>

  <div class="two-col">
    <div>
      <div class="card" style="margin-bottom:16px">
        <h4>📋 Status do Backlog</h4>
        <div style="display:flex;align-items:baseline;gap:8px;margin:10px 0">
          <span style="font-size:36px;font-weight:900;color:${backlog > 30 ? '#ef4444' : backlog > 7 ? '#f59e0b' : '#22c55e'}">${backlog > 0 ? `${backlog}d` : '0'}</span>
          <span style="font-size:13px;color:#64748b">dias de serviços acumulados</span>
        </div>
        <div class="divider"></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;color:#94a3b8">OS em aberto</span><span style="color:#f59e0b;font-weight:700">${abertas}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:#94a3b8">Taxa de abertura</span><span style="color:${txAbertura > 40 ? '#ef4444' : '#e2e8f0'};font-weight:700">${txAbertura}%</span></div>
      </div>
      <div class="card">
        <h4>⏱️ Horímetros — Resumo</h4>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:#94a3b8">🔴 Atrasados (vencidos)</span>
            <span style="color:#ef4444;font-weight:700;font-size:15px">${prevAtrasadas}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:#94a3b8">⚠️ Em Atenção (&lt;50h)</span>
            <span style="color:#f59e0b;font-weight:700;font-size:15px">${prevAtencao}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:#94a3b8">✅ No Prazo</span>
            <span style="color:#22c55e;font-weight:700;font-size:15px">${prevOk}</span>
          </div>
          <div class="divider"></div>
          <div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:#64748b">Total monitorados</span><span style="font-weight:700">${prevTotal}</span></div>
          <div class="progress-outer">
            <div class="progress-inner" style="width:${prevTotal > 0 ? Math.round(prevAtrasadas/prevTotal*100) : 0}%;background:#ef4444;border-radius:0"></div>
          </div>
        </div>
      </div>
    </div>
    <div>
      <div class="card" style="height:fit-content">
        <h4>🔩 Próximas Manutenções (Horímetro)</h4>
        <table style="margin-top:8px">
          <thead><tr><th>Placa</th><th>Status</th><th>Situação</th></tr></thead>
          <tbody>${rowsHorimetros}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="analysis ${prevAtrasadas > 0 ? 'analysis-warn' : 'analysis-success'}">
    <h3>⚙️ Análise PCM — Backlog e Horímetros</h3>
    <p>${backlogAnalise} ${prevAnalise}</p>
  </div>
</div>

<!-- ═══ SLIDE 7 · DISTRIBUIÇÃO E MIX ════════════════════════════════════════ -->
<div class="slide" id="s7">
  <div class="slide-header"><span class="slide-num">Slide 06</span><span class="slide-section">Distribuição de Manutenção</span></div>
  <h2 class="slide-title">Distribuição das OS e Mix de Manutenção</h2>
  <p class="slide-sub">Análise do perfil de manutenção da frota: proporção corretiva/preventiva é o principal indicador de maturidade do PCM.</p>

  <div class="two-col">
    <div>
      <div style="background:#111827;border:1px solid #1e293b;border-radius:14px;overflow:hidden;margin-bottom:16px">
        <div style="padding:12px 16px;border-bottom:1px solid #1e293b"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#64748b">OS por Tipo de Manutenção</span></div>
        <table>
          <thead><tr><th>Tipo</th><th style="text-align:center">Qtd</th><th style="text-align:center">%</th></tr></thead>
          <tbody>${rowsManutTipo}</tbody>
        </table>
      </div>
      <div class="card">
        <h4>Benchmark PCM de Referência</h4>
        <div style="font-size:12px;color:#94a3b8;line-height:2;margin-top:8px">
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #1e293b"><span>Preventiva</span><span class="pill pill-green">≥ 50%</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #1e293b"><span>Corretiva</span><span class="pill pill-red">≤ 30%</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Preditiva</span><span class="pill pill-blue">≥ 20%</span></div>
        </div>
        <div class="divider"></div>
        <p style="font-size:11px;color:#475569;line-height:1.6">Status atual: Preventiva ${txPreventiva}% &nbsp;·&nbsp; Corretiva ${txCorretiva}%</p>
        <p style="font-size:11px;color:${txCorretiva > 50 ? '#ef4444' : txCorretiva > 30 ? '#f59e0b' : '#22c55e'};font-weight:700;margin-top:4px">
          ${txCorretiva > 50 ? '⚠️ Alta corretiva — risco de custo elevado e baixa disponibilidade' : txCorretiva > 30 ? '⚠️ Mix acima do ideal — revisar PMP' : '✅ Mix dentro do padrão PCM'}
        </p>
      </div>
    </div>
    <div>
      <div style="background:#111827;border:1px solid #1e293b;border-radius:14px;overflow:hidden;margin-bottom:16px">
        <div style="padding:12px 16px;border-bottom:1px solid #1e293b"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#64748b">Paradas por Categoria de Frota</span></div>
        <table>
          <thead><tr><th>Categoria</th><th style="text-align:center">OS</th><th style="text-align:center">%</th></tr></thead>
          <tbody>${rowsParadas}</tbody>
        </table>
      </div>
      <div class="analysis">
        <h3>💡 Insight PCM</h3>
        <p>Alta proporção de manutenção corretiva indica que a frota está operando em modo reativo — as falhas surgem antes que o PMP consiga preveni-las. 
        Frotistas com DM ≥ 95% geralmente têm ≥ 60% de manutenção preventiva. 
        Revise os intervalos de manutenção, frequência de inspeções e execute análise FMEA nos equipamentos com maior recorrência de falhas.</p>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SLIDE 8 · RANKING FALHAS ════════════════════════════════════════════ -->
<div class="slide" id="s8">
  <div class="slide-header"><span class="slide-num">Slide 07</span><span class="slide-section">Confiabilidade</span></div>
  <h2 class="slide-title">Ranking de Falhas — Análise de Pareto</h2>
  <p class="slide-sub">Equipamentos com maior recorrência de falhas corretivas. Aplique Pareto (80/20) para focar onde o impacto é maior e menor esforço é necessário.</p>

  <div class="two-col">
    <div style="background:#111827;border:1px solid #1e293b;border-radius:14px;overflow:hidden">
      <table>
        <thead><tr><th>#</th><th>Placa</th><th style="text-align:center">Falhas</th><th style="text-align:center">Dias Manut.</th><th style="text-align:center">MTBF</th></tr></thead>
        <tbody>${rowsFalhas}</tbody>
      </table>
    </div>
    <div>
      <div class="card" style="margin-bottom:16px">
        <h4>📐 Método de Análise — FMEA</h4>
        <div style="font-size:12px;color:#94a3b8;line-height:1.9">
          <p><strong style="color:#e2e8f0">1. Identifique</strong> os equipamentos com &gt; 3 OS corretivas</p>
          <p><strong style="color:#e2e8f0">2. Classifique</strong> as falhas por sistema (motor, hidráulico, elétrica...)</p>
          <p><strong style="color:#e2e8f0">3. Avalie</strong> Severidade, Ocorrência e Detecção (RPN)</p>
          <p><strong style="color:#e2e8f0">4. Priorize</strong> ações para os maiores RPNs</p>
          <p><strong style="color:#e2e8f0">5. Monitore</strong> eficácia das ações no próximo período</p>
        </div>
      </div>
      <div class="analysis">
        <h3>📊 Análise de Confiabilidade</h3>
        <p>O MTBF individual indica a frequência de falhas por equipamento. MTBF muito baixo (&lt; 150h) sugere modo de falha crônico — investigação de causa raiz é obrigatória. Use Diagrama de Ishikawa (espinha de peixe) para mapear causas: mão de obra, máquina, método, material e meio ambiente.</p>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SLIDE 9 · PLANO DE AÇÃO ════════════════════════════════════════════ -->
<div class="slide cover" id="s9">
  <div style="max-width:900px;width:100%">
    <div class="badge">Slide Final · Plano de Ação</div>
    <h1 class="cover-title" style="font-size:40px">Conclusão &amp; Próximos Passos</h1>
    <p style="color:#64748b;margin-bottom:36px;font-size:14px">Período: ${periodo} &nbsp;|&nbsp; Frota: ${categoria} &nbsp;|&nbsp; ${frota} equipamentos</p>

    <div class="two-col">
      <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:24px">
        <p style="color:#22c55e;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px">✅ Pontos de Destaque</p>
        <ul style="list-style:none;line-height:2;color:#94a3b8;font-size:13px">${liPositivos}</ul>
      </div>
      <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:24px">
        <p style="color:#f59e0b;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px">⚡ Ações Prioritárias PCM</p>
        <ul style="list-style:none;line-height:2;color:#94a3b8;font-size:13px">${liAcoes}</ul>
      </div>
    </div>

    <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:14px;padding:20px 24px;margin-top:20px">
      <p style="font-size:13px;color:#94a3b8;line-height:1.8">
        <strong style="color:#60a5fa">Próxima Revisão PCM:</strong> Agendar reunião de análise de indicadores para o próximo período. 
        Revisar PMP com base nos dados de MTBF e MTTR. Auditar execução das ações definidas neste relatório. 
        Meta: DM ≥ 95%, DO ≥ 95%, Backlog zero, Horímetros 100% no prazo.
      </p>
    </div>

    <p class="cover-meta" style="margin-top:28px">
      EUNAMAN · Sistema de Controle de Manutenção Industrial<br>
      Relatório gerado automaticamente em ${geradoEm}
    </p>
  </div>
</div>

<!-- Navegação -->
<div class="nav">
  <button onclick="prevSlide()">← Anterior</button>
  <span class="counter" id="ctr">1 / 9</span>
  <button onclick="nextSlide()">Próximo →</button>
  <button class="btn-primary" onclick="window.print()">🖨️ Imprimir / PDF</button>
</div>

<script>
  const slides = document.querySelectorAll('.slide');
  let cur = 0;
  function show(i) {
    slides.forEach((s, j) => { s.classList.toggle('active', j === i); });
    document.getElementById('ctr').textContent = (i+1) + ' / ' + slides.length;
    window.scrollTo(0, 0);
  }
  function nextSlide() { if (cur < slides.length-1) show(++cur); }
  function prevSlide() { if (cur > 0) show(--cur); }
  document.addEventListener('keydown', e => {
    if (e.key==='ArrowRight'||e.key==='ArrowDown') nextSlide();
    if (e.key==='ArrowLeft'||e.key==='ArrowUp') prevSlide();
  });
  show(0);
</script>
</body>
</html>`;
}
