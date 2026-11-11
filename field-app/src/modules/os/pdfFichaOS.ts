// Geração da Ficha Oficial de O.S em PDF — field-app (offline, mesmo padrão visual do site,
// ver app/os/OSFicha.tsx). Reaproveita o mesmo mecanismo de BacklogPreviewModal/pdfBoletim.ts
// já usado em Pneus: gera um HTML, mostra numa pré-visualização (FichaPreviewModal) e, pra
// baixar/compartilhar, renderiza esse mesmo HTML fora da tela e converte em PDF com
// html2canvas + jsPDF (sem depender de html2pdf/CDN — funciona 100% offline).
//
// Fora do escopo aqui (ver app/os/OSFicha.tsx pra mais detalhes):
// - "Análise PCM — Disponibilidade" (DM/DO): o cálculo de DO depende da tabela escala_frota,
//   que não é sincronizada pro field-app — mostrar um número sem essa regra seria pior que
//   não mostrar. A ficha do app fica só com as 8 seções oficiais.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { salvarOuCompartilharBlob } from "@/lib/pdf-share";

type CargoDadoFicha = { nome: string; matricula: string; assinatura: string };

// Encolhe uma foto em base64 pro tamanho que ela realmente ocupa na ficha (as caixas são
// pequenas: 90-160px) antes de montar o HTML — sem isso o html2canvas precisa decodificar e
// pintar cada foto na resolução original da câmera (podem ser vários MB cada), o que é a
// causa real de "demora muito pra carregar/gerar o PDF" num celular com várias fotos na OS.
// Assinaturas (desenho simples, já pequenas) não passam por aqui.
function encolherFotoBase64(dataUrl: string | null | undefined, maxDim = 480, qualidade = 0.6): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith("data:image")) {
      resolve(dataUrl || "");
      return;
    }
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(dataUrl);
        return;
      }
      const escala = Math.min(1, maxDim / Math.max(width, height));
      const w = Math.round(width * escala);
      const h = Math.round(height * escala);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", qualidade));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Prepara uma cópia da OS com as fotos (horímetro/km, evidências e as de cada descrição de
// atividade) já encolhidas — chamar uma vez ao abrir a ficha (não a cada clique em Baixar/
// Compartilhar) pra deixar tanto a pré-visualização quanto a geração do PDF mais rápidas.
export async function comprimirFotosParaFicha(os: OSParaFicha): Promise<OSParaFicha> {
  const [foto_horimetro, foto_km, fotos, descricoes_atividade] = await Promise.all([
    encolherFotoBase64(os.foto_horimetro),
    encolherFotoBase64(os.foto_km),
    Promise.all((os.fotos || []).map((f) => encolherFotoBase64(f))),
    Promise.all((os.descricoes_atividade || []).map(async (b) => ({ ...b, foto: await encolherFotoBase64(b.foto) }))),
  ]);
  return {
    ...os,
    foto_horimetro: foto_horimetro || os.foto_horimetro,
    foto_km: foto_km || os.foto_km,
    fotos: os.fotos ? fotos : os.fotos,
    descricoes_atividade: os.descricoes_atividade ? descricoes_atividade : os.descricoes_atividade,
  };
}

export type DescricaoAtividadeFicha = {
  descricao: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  foto?: string | null;
  mecanico_nome?: string | null;
  mecanico_matricula?: string | null;
  mecanico_assinatura?: string | null;
};

export type OSParaFicha = {
  id: string;
  numero_os: string;
  placa?: string | null;
  modulo?: string | null;
  status?: string | null;
  data_abertura: string;
  data_fechamento?: string | null;
  horas_manutencao?: number | null;
  descricao?: string | null;
  descricoes_atividade?: DescricaoAtividadeFicha[] | null;
  horimetro?: number | null;
  km?: number | null;
  foto_horimetro?: string | null;
  foto_km?: string | null;
  operacao_tipo?: string | null;
  local?: string | null;
  classe?: string | null;
  foi_enviado_reserva?: boolean | null;
  qual_reserva?: string | null;
  horas_reserva_chegou?: string | null;
  horario_parada?: string | null;
  motivo?: string | null;
  sistema?: string | null;
  sub_sistema?: string | null;
  componente?: string | null;
  observacoes?: string | null;
  mecanicos?: string[] | null;
  created_at?: string | null;
  created_by_nome?: string | null;
  aprovado?: boolean | null;
  aprovado_pcm?: boolean | null;
  aprovado_pcm_por_nome?: string | null;
  aprovado_pcm_em?: string | null;
  aprovado_supervisor?: boolean | null;
  aprovado_supervisor_por_nome?: string | null;
  aprovado_supervisor_em?: string | null;
  assinatura_mecanico?: string | null;
  fotos?: string[] | null;
};

function fmtDT(s: string | null | undefined) {
  if (!s) return "—";
  const clean = s.slice(0, 16);
  if (!clean.includes("T")) return s;
  const [datePart, timePart] = clean.split("T");
  const [y, m, d] = datePart.split("-");
  return `${d}/${m}/${y} ${timePart}`;
}

function diffEmMinutos(abertura: string, fechamento: string | null | undefined): number {
  const agora = new Date();
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(23, 59, 59, 999);
  const dFim = fechamento ? new Date(fechamento) : ontem;
  const diff = Math.floor((dFim.getTime() - new Date(abertura).getTime()) / 60000);
  return diff > 0 ? diff : 0;
}

function formatMinutesToHms(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDiasHorasMin(totalMin: number): string {
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias}d`);
  partes.push(`${horas}h`);
  partes.push(`${min}min`);
  return partes.join(" ");
}

// Desserializa assinaturas: suporta o formato novo (mecanicos/matriculas/cargos{nome,
// matricula,assinatura}), o anterior (cargo = string simples) e string simples bem antiga —
// mesma lógica de app/os/OSFicha.tsx, pra ler OS criadas em qualquer um dos dois lados.
function parseAssinaturas(raw: string | null | undefined) {
  if (!raw) return { assinaturas: [] as string[], matriculas: [] as string[], sigCargos: {} as Record<string, CargoDadoFicha> };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && !Array.isArray(p) && "mecanicos" in p) {
      const cargosRaw: Record<string, any> = p.cargos || {};
      const cargos: Record<string, CargoDadoFicha> = {};
      Object.entries(cargosRaw).forEach(([key, val]) => {
        cargos[key] = typeof val === "string" ? { nome: "", matricula: "", assinatura: val } : (val as CargoDadoFicha);
      });
      return { assinaturas: p.mecanicos || [], matriculas: p.matriculas || [], sigCargos: cargos };
    }
    if (Array.isArray(p)) return { assinaturas: p, matriculas: [], sigCargos: {} };
  } catch {}
  return { assinaturas: [raw], matriculas: [], sigCargos: {} };
}

const CARGOS_FICHA = [
  { key: "encarregado", l: "Encarregado / Supervisor", s: "Visto e Matrícula" },
  { key: "pcm", l: "PCM / Planejamento", s: "Data de Encerramento" },
  { key: "operador", l: "Operador / Motorista", s: "Recebimento" },
  { key: "supervisor_suzano", l: "Supervisor / Autorizador / Suzano", s: "Autorização" },
  { key: "supervisor_manutencao", l: "Supervisor de Manutenção", s: "Validação" },
];

const statusColorFicha = (status: string | null | undefined) =>
  status === "Fechada" || status === "Concluída"
    ? { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" }
    : status === "Programado"
    ? { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" }
    : { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" };

const rowsFicha = (label: string, value: string, bold = false, green = false) =>
  `<div style="padding:0 8px 8px 8px;display:flex;flex-direction:column;gap:2px;flex:1;">
    <label style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${label}</label>
    <span style="font-size:12px;font-weight:${bold ? "900" : "600"};color:${green ? "#1a5c1a" : "#111827"};border-bottom:1px dotted #9ca3af;padding-bottom:2px;">${value}</span>
  </div>`;

const secTitleFicha = (t: string) =>
  `<div style="background:#1a5c1a;color:#fff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;padding:4px 10px;">${t}</div>`;

// Monta o HTML da ficha oficial — mesmo layout/seções numeradas de app/os/OSFicha.tsx.
export function gerarHtmlFichaOS(os: OSParaFicha): string {
  const { assinaturas, matriculas, sigCargos } = parseAssinaturas(os.assinatura_mecanico);
  const blocosDescricao = Array.isArray(os.descricoes_atividade) && os.descricoes_atividade.length > 0 ? os.descricoes_atividade : null;

  const inicioParaCalc = os.horario_parada || os.data_abertura;
  const totalMinutosTempo = os.horas_manutencao != null ? Math.round(os.horas_manutencao * 60) : diffEmMinutos(inicioParaCalc, os.data_fechamento);
  const horasCalc = formatMinutesToHms(totalMinutosTempo);
  const tempoTotalCompleto = `${horasCalc} (${formatDiasHorasMin(totalMinutosTempo)})`;
  const statusColor = statusColorFicha(os.status);
  const placa = (os.placa || "—").trim().toUpperCase();

  const fotosHTML = os.fotos && os.fotos.length > 0
    ? `<div style="border-bottom:1px solid #111;">
        ${secTitleFicha("07. Evidências Fotográficas")}
        <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;padding:8px 10px;">
          ${os.fotos.map((foto) => `
            <div style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#000;height:100px;">
              <img src="${foto}" style="max-width:100%;max-height:100%;object-fit:cover;" />
            </div>
          `).join("")}
        </div>
       </div>`
    : "";

  return `
    <div style="border:1.5px solid #111;max-width:100%;margin:0 auto;height:auto;position:relative;font-family:Arial,sans-serif;font-size:10px;background:#fff;color:#000;">

      <!-- Cabeçalho -->
      <div style="display:flex;align-items:center;border-bottom:2px solid #111;padding:8px 12px;gap:12px;">
        <div style="width:140px;height:60px;flex-shrink:0;"><img src="logo-eunaman-full.png" style="width:100%;height:100%;object-fit:contain;" /></div>
        <div style="flex:1;text-align:center;">
          <h1 style="font-size:17px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin:0;">FICHA DE ORDEM DE SERVIÇO</h1>
          <p style="font-size:10px;color:#6b7280;margin-top:3px;">CONTROLE DE MANUTENÇÃO DE FROTAS</p>
        </div>
        <div style="min-width:120px;text-align:right;">
          <p style="font-size:9px;color:#6b7280;text-transform:uppercase;font-weight:600;">Nº O.S</p>
          <p style="font-size:14px;font-weight:900;font-family:monospace;">${os.numero_os}</p>
          <p style="font-size:8px;color:#9ca3af;margin-top:2px;">Emitida em ${fmtDT(os.created_at || os.data_abertura)}</p>
          <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:800;margin-top:4px;background:${statusColor.bg};color:${statusColor.text};border:1px solid ${statusColor.border};">${os.status || "Aberta"}</span>
        </div>
      </div>

      <!-- Identificação -->
      <div style="border-bottom:1px solid #111;">
        ${secTitleFicha("01. Identificação do Equipamento")}
        <div style="display:flex;padding:8px 2px 4px 2px;">
          ${rowsFicha("Placa", placa, true)}
          ${rowsFicha("Módulo / Operação", os.modulo ? `${os.modulo}${os.operacao_tipo ? ` — ${os.operacao_tipo}` : ""}` : os.operacao_tipo || "—")}
          ${rowsFicha("Local", os.local || "—")}
          ${rowsFicha("Horímetro", os.horimetro != null ? String(os.horimetro) : "—")}
          ${rowsFicha("KM", os.km != null ? String(os.km) : "—")}
        </div>
        ${(os.foto_horimetro || os.foto_km) ? `
        <div style="display:flex;gap:8px;padding:0 10px 8px 10px;">
          ${os.foto_horimetro ? `
            <div style="flex:1;">
              <p style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 3px 0;">Foto do Horímetro</p>
              <div style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;height:90px;background:#000;display:flex;align-items:center;justify-content:center;">
                <img src="${os.foto_horimetro}" style="max-width:100%;max-height:100%;object-fit:cover;" />
              </div>
            </div>` : ""}
          ${os.foto_km ? `
            <div style="flex:1;">
              <p style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 3px 0;">Foto do KM</p>
              <div style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;height:90px;background:#000;display:flex;align-items:center;justify-content:center;">
                <img src="${os.foto_km}" style="max-width:100%;max-height:100%;object-fit:cover;" />
              </div>
            </div>` : ""}
        </div>` : ""}
      </div>

      <!-- Datas -->
      <div style="border-bottom:1px solid #111;">
        ${secTitleFicha("02. Datas e Tempos")}
        <div style="display:flex;padding:8px 2px 4px 2px;">
          ${os.horario_parada ? rowsFicha("Horário Real da Parada", fmtDT(os.horario_parada)) : ""}
          ${rowsFicha("Início Manutenção", fmtDT(os.data_abertura))}
          ${rowsFicha("Fechamento da O.S", fmtDT(os.data_fechamento), false, true)}
          ${rowsFicha("Tempo Total", tempoTotalCompleto, true, true)}
        </div>
      </div>

      <!-- Lançamento e Validação Interna -->
      ${(os.created_by_nome || os.aprovado != null) ? `
      <div style="border-bottom:1px solid #111;">
        ${secTitleFicha("03. Lançamento e Validação Interna")}
        <div style="display:flex;padding:8px 2px 4px 2px;">
          ${os.created_by_nome ? rowsFicha("Lançado por", os.created_by_nome) : ""}
          ${os.aprovado != null ? rowsFicha("Status de Validação", os.aprovado ? "✅ Validada" : "⏳ Pendente de Validação", true, !!os.aprovado) : ""}
        </div>
        ${(os.aprovado_pcm != null || os.aprovado_supervisor != null) ? `
        <div style="display:flex;padding:0 2px 8px 2px;">
          ${os.aprovado_pcm != null ? rowsFicha("Validação PCM", os.aprovado_pcm ? `✅ ${os.aprovado_pcm_por_nome || "Validado"}${os.aprovado_pcm_em ? ` em ${fmtDT(os.aprovado_pcm_em)}` : ""}` : "⏳ Pendente", false, !!os.aprovado_pcm) : ""}
          ${os.aprovado_supervisor != null ? rowsFicha("Validação Supervisor Manutenção", os.aprovado_supervisor ? `✅ ${os.aprovado_supervisor_por_nome || "Validado"}${os.aprovado_supervisor_em ? ` em ${fmtDT(os.aprovado_supervisor_em)}` : ""}` : "⏳ Pendente", false, !!os.aprovado_supervisor) : ""}
        </div>` : ""}
      </div>` : ""}

      <!-- Classificação -->
      <div style="border-bottom:1px solid #111;">
        ${secTitleFicha("04. Classificação da Manutenção")}
        <div style="display:flex;padding:8px 2px 4px 2px;">
          ${rowsFicha("Tipo", os.classe || "CORRETIVA", true)}
          ${rowsFicha("Sistema", os.sistema || "—")}
          ${rowsFicha("Sub-Sistema", os.sub_sistema || "—")}
          ${rowsFicha("Componente", os.componente || "—")}
        </div>
        <div style="display:flex;padding:0 2px 8px 2px;">
          ${rowsFicha("Motivo da Parada", os.motivo || "—")}
          ${rowsFicha("Reserva Enviada?", os.foi_enviado_reserva ? "✅ SIM" : "NÃO", true, !!os.foi_enviado_reserva)}
        </div>
      </div>

      <!-- Descrição das Atividades -->
      <div style="border-bottom:1px solid #111;">
        ${secTitleFicha("05. Descrição das Atividades")}
        ${blocosDescricao ? blocosDescricao.map((b, i) => `
          <div style="padding:7px 10px;${i < blocosDescricao.length - 1 ? "border-bottom:1px dashed #d1d5db;" : ""}">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">
              <span style="font-size:8px;color:#9ca3af;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Atividade ${i + 1}</span>
              ${(b.hora_inicio || b.hora_fim) ? `<span style="font-size:9px;color:#6b7280;font-weight:700;">${b.hora_inicio || "—"} às ${b.hora_fim || "—"}</span>` : ""}
            </div>
            <p style="font-size:11px;font-weight:600;color:#b45309;line-height:1.5;">${b.descricao || "—"}</p>
            ${b.mecanico_nome ? `<p style="font-size:9px;font-weight:700;color:#1a5c1a;margin-top:2px;">Executado por: ${b.mecanico_nome}${b.mecanico_matricula ? ` — Mat. ${b.mecanico_matricula}` : ""}</p>` : ""}
            ${b.foto ? `<div style="margin-top:4px;width:160px;height:90px;border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;background:#000;"><img src="${b.foto}" style="width:100%;height:100%;object-fit:cover;" /></div>` : ""}
          </div>
        `).join("") : `
          <div style="padding:8px 10px;min-height:56px;">
            <p style="font-size:11px;font-weight:600;color:#b45309;line-height:1.6;">${os.descricao || "—"}</p>
          </div>
        `}
      </div>

      <!-- Observações -->
      <div style="border-bottom:1px solid #111;">
        ${secTitleFicha("06. Observações / Pendências")}
        <div style="padding:6px 10px;min-height:30px;">
          <p style="font-size:10px;color:#374151;line-height:1.4;">${os.observacoes || "—"}</p>
        </div>
      </div>

      ${fotosHTML}

      <!-- Assinaturas -->
      <div>
        ${secTitleFicha("08. Controle e Assinaturas")}
        <div style="border-bottom:1px solid #333;">
          <p style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;padding:4px 8px 2px;background:#f0fdf4;">Executantes / Mecânicos</p>
          <div style="display:flex;flex-wrap:wrap;">
            ${(os.mecanicos && os.mecanicos.length > 0 ? os.mecanicos : ["Mecânico"]).map((nome, i) => {
              const sig = assinaturas[i] || "";
              const mat = matriculas[i] || "";
              const isLast = i === (os.mecanicos?.length ?? 1) - 1;
              return `<div style="flex:1;min-width:140px;padding:6px;min-height:85px;display:flex;flex-direction:column;justify-content:space-between;${!isLast ? "border-right:1px solid #ddd;" : ""}">
                <p style="font-size:8px;color:#1a5c1a;font-weight:700;margin:0 0 4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${nome}">${nome}${mat ? ` — Mat. ${mat}` : ""}</p>
                <div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:35px;">
                  ${sig ? `<img src="${sig}" style="height:32px;object-fit:contain;" />` : '<span style="font-size:8px;color:#d1d5db;">(sem assinatura)</span>'}
                </div>
                <div style="border-bottom:1px solid #111;margin-top:2px;"></div>
                <p style="font-size:7px;text-align:center;color:#9ca3af;margin:3px 0 0 0;">Assinatura</p>
              </div>`;
            }).join("")}
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;border-bottom:1px solid #333;">
          ${CARGOS_FICHA.map((a, i, arr) => {
            const dado = sigCargos[a.key];
            const sig = dado?.assinatura || "";
            return `<div style="flex:1;min-width:120px;padding:6px;min-height:90px;display:flex;flex-direction:column;justify-content:space-between;${i < arr.length - 1 ? "border-right:1px solid #333;" : ""}">
              <p style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin:0 0 4px 0;">${a.l}</p>
              <div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:35px;">
                ${sig ? `<img src="${sig}" style="height:32px;object-fit:contain;" />` : ""}
              </div>
              <div style="border-bottom:1px solid #111;margin-top:2px;"></div>
              <p style="font-size:7px;text-align:center;color:#374151;margin:3px 0 0 0;">${dado?.nome ? `${dado.nome}${dado.matricula ? ` — Mat. ${dado.matricula}` : ""}` : a.s}</p>
            </div>`;
          }).join("")}
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 10px;background:#f9fafb;border-top:1px solid #d1d5db;">
          <p style="font-size:9px;color:#9ca3af;">Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
          <p style="font-size:9px;color:#6b7280;font-weight:700;">EUNAMAN — Sistema de Controle de Manutenção</p>
          <p style="font-size:9px;color:#9ca3af;font-family:monospace;">O.S: ${os.numero_os}</p>
        </div>
      </div>

    </div>
  `;
}

// Renderiza o HTML fora da tela, converte em imagem (html2canvas) e monta um PDF A4
// paginado (jsPDF) — mesmo mecanismo de field-app/src/modules/pneus/pdfBoletim.ts, sem
// depender de nenhum script externo (funciona offline). Só monta o Blob — quem chama decide
// se baixa, compartilha, ou guarda em cache pra reusar depois (ver gerarFichaOSPDF/useFichaPdfCache).
export async function gerarBlobFichaOS(os: OSParaFicha): Promise<Blob> {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.backgroundColor = "#ffffff";
  container.innerHTML = gerarHtmlFichaOS(os);
  document.body.appendChild(container);

  try {
    // scale 1 (não 1.5+): as fotos já chegam aqui encolhidas por comprimirFotosParaFicha, então
    // um canvas maior só deixaria a geração mais lenta sem ganho real de legibilidade.
    const canvas = await html2canvas(container, { scale: 1, useCORS: true, backgroundColor: "#ffffff", logging: false });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output("blob");
  } finally {
    if (document.body.contains(container)) document.body.removeChild(container);
  }
}

// Baixa e/ou compartilha a ficha. Aceita um Blob já pronto (vindo do cache em OSClient.tsx,
// gerado antecipadamente assim que a ficha é aberta) pra pular o html2canvas/jsPDF — é essa
// etapa, não o compartilhamento em si, que demorava a cada clique em Compartilhar/Baixar.
export async function gerarFichaOSPDF(os: OSParaFicha, modo: "download" | "share" = "download", blobPronto?: Blob) {
  try {
    const blob = blobPronto || (await gerarBlobFichaOS(os));
    await salvarOuCompartilharBlob(
      blob,
      `OS_${os.numero_os}.pdf`,
      `OS ${os.numero_os}`,
      `Ficha da Ordem de Serviço ${os.numero_os}`,
      modo
    );
  } catch (err: any) {
    console.error("Erro ao gerar/compartilhar PDF da OS:", err);
    alert("Erro ao gerar o PDF da OS: " + (err?.message || String(err)));
  }
}
