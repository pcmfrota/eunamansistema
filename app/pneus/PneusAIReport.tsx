'use client';

import React, { useMemo } from 'react';
import { 
  BrainCircuit, 
  TrendingDown, 
  AlertOctagon, 
  CheckCircle2, 
  FileText, 
  Zap, 
  ArrowRight,
  Target,
  BarChart3,
  Waves,
  X
} from 'lucide-react';

interface Inspecao {
  id: string;
  equipamento_id: string;
  data_inspecao: string;
  km_atual: number | null;
  de: number | null; dd: number | null; tei: number | null; tee: number | null; tdi: number | null; tde: number | null;
  tei1: number | null; tee1: number | null; tdi1: number | null; tde1: number | null; estepe: number | null;
  condicao: string;
  equipamentos?: { placa: string };
}

interface PneusAIReportProps {
  inspecoes: Inspecao[];
  onClose: () => void;
}

export default function PneusAIReport({ inspecoes, onClose }: PneusAIReportProps) {
  const analysis = useMemo(() => {
    if (!inspecoes.length) return null;

    const latestByEq = Object.values(inspecoes.reduce((acc, current) => {
      if (!acc[current.equipamento_id] || current.data_inspecao > acc[current.equipamento_id].data_inspecao) {
        acc[current.equipamento_id] = current;
      }
      return acc;
    }, {} as Record<string, Inspecao>));

    const totalVehicles = latestByEq.length;
    const criticalVehicles = latestByEq.filter(i => i.condicao === 'CRITICO' || i.condicao === 'TROCAR');
    const warningVehicles = latestByEq.filter(i => i.condicao === 'ATENCAO' || i.condicao === 'REGULAR');
    const goodVehicles = latestByEq.filter(i => i.condicao === 'BOM');

    // Média de sulco geral
    const posicoes = ['de','dd','tei','tee','tdi','tde','tei1','tee1','tdi1','tde1','estepe'];
    let sum = 0;
    let count = 0;
    latestByEq.forEach(i => {
      posicoes.forEach(p => {
        const val = (i as any)[p];
        if (val != null) { sum += val; count++; }
      });
    });
    const avgSulco = count > 0 ? (sum / count).toFixed(1) : "0";

    return {
      totalVehicles,
      criticalCount: criticalVehicles.length,
      warningCount: warningVehicles.length,
      goodCount: goodVehicles.length,
      avgSulco,
      criticalList: criticalVehicles.map(v => v.equipamentos?.placa).filter(Boolean),
    };
  }, [inspecoes]);

  const downloadReportPDF = () => {
    if (!(window as any).html2pdf) {
      alert("Aguarde o carregamento do gerador de PDF."); return;
    }
    const element = document.getElementById("ai-report-content");
    (window as any).html2pdf().set({
      margin: 10,
      filename: `Relatorio_Inteligencia_Pneus.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(element).save();
  };

  if (!analysis) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
        
        {/* Header Elegante */}
        <div className="relative p-8 bg-gradient-to-br from-zinc-900 to-black overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <BrainCircuit size={120} className="text-orange-500 animate-pulse" />
          </div>
          <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-orange-500 rounded-xl">
                   <Zap size={24} className="text-white" />
                 </div>
                 <h2 className="text-3xl font-black text-white tracking-tight leading-none uppercase">Relatório de Inteligência</h2>
              </div>
              <p className="text-zinc-400 text-sm font-medium tracking-wide">Análise avançada da frota baseada em {inspecoes.length} registros</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors text-zinc-400">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Corpo do Relatório */}
        <div id="ai-report-content" className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-white dark:bg-zinc-950">
          
          {/* Dashboard Rápido */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Frota Analisada</span>
              <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{analysis.totalVehicles} <span className="text-sm text-zinc-500">unids</span></div>
            </div>
            <div className={`p-6 rounded-3xl border space-y-1 ${analysis.criticalCount > 0 ? 'bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900/50' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100'}`}>
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Críticos/Troca</span>
              <div className={`text-3xl font-black ${analysis.criticalCount > 0 ? 'text-red-600' : 'text-zinc-500'}`}>{analysis.criticalCount}</div>
            </div>
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Média Sulco</span>
              <div className="text-3xl font-black text-orange-500">{analysis.avgSulco} <span className="text-sm font-medium text-zinc-400">mm</span></div>
            </div>
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Saúde Frota</span>
              <div className="text-3xl font-black text-emerald-500">{Math.round((analysis.goodCount / analysis.totalVehicles) * 100)}%</div>
            </div>
          </div>

          {/* Seção Estratégica */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            
            {/* Insights IA */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="text-blue-500" size={20} />
                <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">Insights Estratégicos</h3>
              </div>
              
              <div className="space-y-4">
                {analysis.criticalCount > 0 && (
                  <InsightCard 
                    icon={<AlertOctagon size={20} className="text-red-500" />}
                    title="Ação Imediata Necessária"
                    desc={`Identificamos ${analysis.criticalCount} veículos com sulco inferior a 3.0mm. Estes pneus representam risco de segurança e multa.`}
                    color="red"
                  />
                )}
                <InsightCard 
                  icon={<TrendingDown size={20} className="text-orange-500" />}
                  title="Otimização de Vida Útil"
                  desc="Recomendamos rodízio preventivo para veículos com desgaste irregular (diferença > 2.0mm entre eixos)."
                  color="orange"
                />
                <InsightCard 
                  icon={<Target size={20} className="text-blue-500" />}
                  title="Foco Operacional"
                  desc="Aumentar a frequência de inspeção bi-semanal para placas com sulco entre 6mm-9mm para prever compras."
                  color="blue"
                />
              </div>
            </div>

            {/* Recomendações Técnicas */}
            <div className="bg-zinc-900 p-8 rounded-[2rem] border border-zinc-800 shadow-xl space-y-6">
              <h3 className="text-lg font-black uppercase text-white flex items-center gap-3">
                <Waves className="text-orange-500" size={20} />
                Próximos Passos
              </h3>
              
              <div className="space-y-5">
                <StepItem 
                  num="01" 
                  title="Agendar Manutenção" 
                  text={analysis.criticalList.length > 0 ? `Substituir pneus das placas: ${analysis.criticalList.join(', ')}.` : "Nenhuma substituição emergencial pendente." }
                />
                <StepItem 
                  num="02" 
                  title="Revisão de Calibragem" 
                  text="Implementar checklist de pressão diária para reduzir desgaste lateral observado nos dados." 
                />
                <StepItem 
                  num="03" 
                  title="Treinamento de Equipe" 
                  text="Reforçar técnica de medição com paquímetro eletrônico para registros mais precisos." 
                />
              </div>

              <div className="pt-4" data-html2canvas-ignore="true">
                 <button onClick={downloadReportPDF} className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-900/40 transition-all flex items-center justify-center gap-3 group">
                   Baixar Relatório Executivo (PDF)
                   <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                 </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.3em]">Gerado por EUNAMAN IA Engine • © 2026</p>
        </div>

      </div>
    </div>
  );
}

function InsightCard({ icon, title, desc, color }: { icon: React.ReactNode, title: string, desc: string, color: string }) {
  const colorMap: any = {
    red: "bg-red-50 dark:bg-red-950/20 text-red-700 border-red-100 dark:border-red-900/50",
    orange: "bg-orange-50 dark:bg-orange-950/20 text-orange-700 border-orange-100 dark:border-orange-900/50",
    blue: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 border-blue-100 dark:border-blue-900/50",
  };
  return (
    <div className={`p-5 rounded-2xl border flex gap-4 ${colorMap[color]}`}>
      <div className="shrink-0 pt-1">{icon}</div>
      <div className="space-y-1">
        <h4 className="font-black text-sm uppercase tracking-tight">{title}</h4>
        <p className="text-xs opacity-80 leading-relaxed font-medium">{desc}</p>
      </div>
    </div>
  );
}

function StepItem({ num, title, text }: { num: string, title: string, text: string }) {
  return (
    <div className="flex gap-4">
      <div className="text-xl font-black text-orange-500/50 leading-none">{num}</div>
      <div className="space-y-1">
        <h5 className="text-white text-sm font-black uppercase tracking-tight">{title}</h5>
        <p className="text-zinc-400 text-[11px] font-medium leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

