# Exemplo: Criar Dashboard com Gráficos Recharts

Este documento exemplifica como implementar um novo dashboard seguindo exatamente o padrão estético de cores, fontes, bordas e espaçamentos do sistema EUNAMAN.

---

## Estrutura Recomendada do Componente Dashboard

```tsx
import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { Wrench } from "lucide-react";

interface Props {
  dados: any[];
}

export default function IndicadoresDashboard({ dados = [] }: Props) {
  
  // 1. Processar dados para o gráfico
  const chartData = useMemo(() => {
    // Agrupa e resume os dados (ex: quantidade de OS por mês)
    return dados.map(item => ({
      name: item.mes_ano,
      Preventiva: item.preventivas_count,
      Corretiva: item.corretivas_count,
    }));
  }, [dados]);

  return (
    <div className="flex flex-col gap-4 w-full animate-in fade-in duration-500">
      
      {/* 2. Cartões de Estatísticas (Cards Premium) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tempo Médio de Reparo (MTTR)</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1">2.4h</p>
        </div>
        {/* Adicione outros cards seguindo o mesmo estilo */}
      </div>

      {/* 3. Área do Gráfico */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">Evolução de OS</h3>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
              <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "#18181b", 
                  borderColor: "#27272a", 
                  borderRadius: "12px", 
                  color: "#fff" 
                }} 
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Bar dataKey="Preventiva" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Preventivas" />
              <Bar dataKey="Corretiva" fill="#f97316" radius={[4, 4, 0, 0]} name="Corretivas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

## Regras Importantes do Design System EUNAMAN:
1. **Cards**: Sempre utilize cantos arredondados `rounded-2xl` ou `rounded-3xl` e cores discretas de bordas (`zinc-200` para light e `zinc-800` para dark).
2. **Cores do Gráfico**: Use Indigo (`#4f46e5`), Emerald (`#10b981`), Orange (`#f97316`) e Zinc (`#a1a1aa`) para manter a harmonia visual.
3. **Animações**: Aplique classes de animação suave como `animate-in fade-in duration-500` nos elementos de dashboard.
