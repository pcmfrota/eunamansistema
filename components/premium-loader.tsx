"use client";

import React from 'react';
import { cn } from "@/lib/utils";

export type LoaderType = "circle-fill" | "squares-sequential" | "pulse";

interface PremiumLoaderProps {
  type?: LoaderType;
  text?: string;
  subtext?: string;
}

export function PremiumLoader({ 
  type = "squares-sequential", 
  text = "Carregando Sistema", 
  subtext = "PCM • Gestão de Frota" 
}: PremiumLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-10 animate-in fade-in duration-700">
      <div className="relative flex items-center justify-center">
        {type === "squares-sequential" && (
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-5 h-5 bg-green-600 rounded-lg animate-[square-seq_1.2s_infinite]"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}

        {type === "circle-fill" && (
          <div className="relative w-28 h-28">
            <svg className="w-full h-full transform -rotate-90 scale-110">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                className="text-zinc-200 dark:text-zinc-800"
              />
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray="282.7"
                strokeLinecap="round"
                className="text-green-600 animate-[circle-fill-anim_2.5s_infinite_ease-in-out]"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-12 h-12 bg-green-600/10 rounded-full animate-ping" />
               <div className="absolute w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
          </div>
        )}

        {type === "pulse" && (
          <div className="relative w-24 h-24 flex items-center justify-center">
             <div className="absolute inset-0 border-[6px] border-green-600/20 rounded-[2rem] animate-[pulse-scale_2.5s_infinite_ease-in-out]" />
             <div className="absolute inset-4 border-[4px] border-green-600/40 rounded-[1.5rem] animate-[pulse-scale_2.5s_infinite_ease-in-out_0.6s]" />
             <div className="w-10 h-10 bg-green-600 rounded-2xl shadow-[0_0_20px_rgba(34,197,94,0.4)] animate-pulse" />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-2xl font-black uppercase tracking-[0.3em] text-green-600 dark:text-green-500 drop-shadow-sm">
          {text}
        </h2>
        <div className="h-1 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
           <div className="h-full bg-green-600 animate-[progress-bar_2s_infinite]" />
        </div>
        <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-[0.2em] animate-pulse">
          {subtext}
        </p>
      </div>

      <style jsx global>{`
        @keyframes circle-fill-anim {
          0% { stroke-dashoffset: 282.7; transform: rotate(-90deg); }
          50% { stroke-dashoffset: 0; transform: rotate(0deg); }
          100% { stroke-dashoffset: -282.7; transform: rotate(270deg); }
        }
        @keyframes square-seq {
          0%, 100% { transform: scale(1); opacity: 0.2; filter: blur(1px); }
          50% { transform: scale(1.3); opacity: 1; filter: blur(0); background-color: #22c55e; }
        }
        @keyframes pulse-scale {
          0%, 100% { transform: scale(0.85); opacity: 0.2; }
          50% { transform: scale(1.1); opacity: 0.6; }
        }
        @keyframes progress-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
