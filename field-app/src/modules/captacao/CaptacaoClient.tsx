// @ts-nocheck
'use client'

// Port de app/captacao/CaptacaoClient.tsx pro app de campo. Erros de tipo pré-existentes
// no app principal (confirmados via `npx tsc --noEmit` lá — parâmetros implícitos "any"
// em callbacks de setState, foto_ponto null vs undefined etc.) que o tsc mais rigoroso
// do field-app bloquearia; reportar separadamente pro app principal, fora do escopo
// desta fase. Único comportamento corrigido aqui (não cosmético): o bug de editar um
// lançamento offline usando o entity/action errado — ver o comentário no próprio local.
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { createPortal } from 'react-dom';
import { 
  Plus, 
  X, 
  Search, 
  FileText, 
  Calendar, 
  Camera, 
  Clock, 
  Droplets, 
  Trash2, 
  Printer, 
  Check, 
  ArrowLeft, 
  RefreshCw, 
  FlipHorizontal,
  Lock,
  Unlock,
  ChevronRight,
  Eye,
  Wifi,
  WifiOff,
  FileSpreadsheet,
  Download,
  Pencil,
  MoreVertical,
  PenLine
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-context';
import { useOffline } from '@/components/offline-provider';
import { localDb } from '@/lib/offline-db';
import { SearchableSelect } from '@/components/SearchableSelect';
import { baixarOuCompartilharPdf } from '@/lib/pdf-share';
import {
  criarFicha,
  fecharFicha,
  reabrirFicha,
  excluirFicha,
  adicionarLancamento,
  excluirLancamento,
  atualizarFicha,
  atualizarLancamento
} from './actions';
import { Card, ListRow } from '../../ui/primitives/ListRow';
import { BottomSheet } from '../../ui/primitives/BottomSheet';
import { ActionSheet, type ActionSheetItem } from '../../ui/primitives/ActionSheet';
import { ConfirmDialog } from '../../ui/primitives/ConfirmDialog';
import { Fab } from '../../ui/primitives/Fab';
import { StatTile } from '../../ui/primitives/StatTile';
import { useToast } from '../../ui/primitives/Toast';

// Utility for robust UUID generation (Safe for Android WebView)
const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

// Camera Modal Component
function CameraModal({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setReady(false);
    setError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setReady(true);
        };
      }
    } catch (err: any) {
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    
    const MAX = 800; // Compress ideal size
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > h) {
      if (w > MAX) {
        h = Math.round((h * MAX) / w);
        w = MAX;
      }
    } else {
      if (h > MAX) {
        w = Math.round((w * MAX) / h);
        h = MAX;
      }
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    setCaptured(dataUrl);
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const handleConfirm = () => {
    if (captured) onCapture(captured);
    onClose();
  };

  const handleRetake = () => {
    setCaptured(null);
    startCamera(facingMode);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    setCaptured(null);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md flex flex-col gap-4 bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-white font-black text-sm tracking-widest uppercase">📷 Capturar Ponto</span>
          <button type="button" onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
            className="text-zinc-400 hover:text-white transition-colors p-1 bg-zinc-900 rounded-full hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="text-center py-12">
            <p className="text-red-400 text-xs font-bold mb-4">{error}</p>
            <button type="button" onClick={() => startCamera(facingMode)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black">Tentar novamente</button>
          </div>
        ) : captured ? (
          <>
            <div className="rounded-2xl overflow-hidden bg-black aspect-[4/3] w-full border border-zinc-800">
              <img src={captured} alt="Preview" className="w-full h-full object-contain" />
            </div>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={handleRetake}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-bold text-xs hover:bg-zinc-700 transition-colors uppercase">
                🔄 Nova Foto
              </button>
              <button type="button" onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-colors uppercase">
                ✅ Confirmar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl overflow-hidden bg-black aspect-[4/3] w-full relative border border-zinc-800">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="flex gap-4 items-center justify-center">
              <button type="button" onClick={toggleCamera}
                className="p-3.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 transition-colors" title="Virar câmera">
                <FlipHorizontal size={18} />
              </button>
              <button type="button" onClick={handleCapture} disabled={!ready}
                className="w-16 h-16 rounded-full bg-white border-4 border-zinc-300 shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50">
                <div className="w-10 h-10 rounded-full bg-zinc-900" />
              </button>
              <div className="w-11" />
            </div>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

// Upload Box Helper for base64 file selection
function UploadBox({ label, url, onCapture, onFileSelect, showCameraOption }: { 
  label: string; 
  url?: string; 
  onCapture: () => void; 
  onFileSelect: (base64: string) => void;
  showCameraOption: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX) {
            h = Math.round((h * MAX) / w);
            w = MAX;
          }
        } else {
          if (h > MAX) {
            w = Math.round((w * MAX) / h);
            h = MAX;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          onFileSelect(canvas.toDataURL("image/jpeg", 0.6));
        } else {
          onFileSelect(event.target?.result as string);
        }
      };
      img.onerror = () => {
        onFileSelect(event.target?.result as string);
      };
    };
  };

  return (
    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center relative min-h-[140px] group overflow-hidden">
      {url ? (
        <div className="absolute inset-0">
          <img src={url} alt="Capturado" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-all">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg uppercase tracking-wide transition-all"
            >
              Galeria
            </button>
            {showCameraOption && (
              <button 
                type="button" 
                onClick={onCapture}
                className="p-2 bg-emerald-600 hover:bg-emerald-750 text-white text-[10px] font-bold rounded-lg uppercase tracking-wide transition-all"
              >
                Câmera
              </button>
            )}
            <button 
              type="button" 
              onClick={() => onFileSelect('')}
              className="p-2 bg-red-650 hover:bg-red-750 text-white text-[10px] font-bold rounded-lg uppercase tracking-wide transition-all"
            >
              Limpar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-500">
            <Camera size={20} />
          </div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">{label}</p>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[9px] font-black rounded-lg border border-zinc-800 uppercase tracking-wider transition-colors"
            >
              + Galeria
            </button>
            {showCameraOption && (
              <button 
                type="button" 
                onClick={onCapture}
                className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 text-[9px] font-black rounded-lg border border-emerald-800/30 uppercase tracking-wider transition-colors"
              >
                📷 Tirar Foto
              </button>
            )}
          </div>
        </div>
      )}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden" 
      />
    </div>
  );
}

// Safe date formatter to prevent RangeError from date-fns
const safeFormatDate = (dateVal: any, formatPattern: string, options?: any) => {
  if (!dateVal) return '-';
  try {
    let dateObj: Date;
    if (dateVal instanceof Date) {
      dateObj = dateVal;
    } else {
      const dateStr = String(dateVal);
      const cleanStr = dateStr.includes(' ') ? dateStr.replace(' ', 'T') : dateStr;
      const finalStr = cleanStr.includes('T') ? cleanStr : cleanStr + 'T12:00:00';
      dateObj = new Date(finalStr);
    }
    if (isNaN(dateObj.getTime())) return '-';
    return format(dateObj, formatPattern, options);
  } catch (e) {
    return '-';
  }
};

// Format month name safely
const getMonthName = (m: any) => {
  const num = Number(m);
  if (!m || isNaN(num) || num < 1 || num > 12) {
    return 'MÊS INVÁLIDO';
  }
  try {
    const dates = new Date(2026, num - 1, 15);
    return format(dates, 'MMMM', { locale: ptBR }).toUpperCase();
  } catch (e) {
    return 'MÊS INVÁLIDO';
  }
};

// Standalone Printable Sheet View component/helper function
const renderPaperFicha = (ficha: any, onPhotoClick?: (url: string) => void, calendario?: any[]) => {
  return (
    <div className="w-[1080px] bg-white text-zinc-950 p-5 font-sans mx-auto text-[10px] leading-normal border border-black select-none shadow-xl print:shadow-none print:border-0 print:p-0">
      
      {/* Enforce landscape style tag */}
      <style dangerouslySetInnerHTML={{__html: "@media print { @page { size: landscape; margin: 8mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}} />

      {/* Header with official Suzano logo/bar */}
      <div className="w-full bg-[#002f87] h-[52px] relative flex items-center px-4 overflow-hidden border border-black border-b-0">
        {/* Geometric decoration */}
        <svg className="absolute inset-y-0 right-0 w-2/3 h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,0 L35,0 L15,100 L-20,100 Z" fill="#007bc4" />
          <path d="M30,0 L100,0 L85,100 L10,100 Z" fill="#00b050" />
          <path d="M65,0 L100,0 L95,100 L60,100 Z" fill="#8dc63f" opacity="0.35" />
        </svg>
        
        {/* Suzano logo */}
        <div className="relative z-10 flex items-center gap-2">
          <svg viewBox="0 0 200 50" width="160" height="40" className="h-8 w-[160px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g fillRule="evenodd">
              {/* Left Leaf */}
              <path d="M16.8 32.5c-.8-5.3 1.2-11.4 5.3-15.6 3-3.1 7.2-5.1 11-5.1.7 0 .9.3.6.8-2 3.8-6.1 10-5.8 17.5.1 2.2-.6 4-1.9 5.3-2.6 2.7-7 1-9.2-2.9z" fill="#00B159"/>
              {/* Right Leaf */}
              <path d="M29.5 35c-.6-4 1-8.5 4-11.7 2.2-2.3 5.4-3.8 8.2-3.8.5 0 .7.2.4.6-1.5 2.8-4.6 7.5-4.4 13.1 0 1.6-.5 3-1.4 4-2 2-5.3.7-6.8-2.2z" fill="#8DC63F"/>
            </g>
            <text x="52" y="32" fill="#ffffff" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.5">suzano</text>
          </svg>
        </div>
      </div>

      {/* Title & Doc Info Block */}
      <table className="w-full border-collapse border border-black text-center text-xs">
        <tbody>
          <tr>
            <td className="p-3 font-black text-sm uppercase tracking-wider border-r border-black w-[80%] text-center font-sans">
              Controle de Captação de Água
            </td>
            <td className="p-0 text-[9px] w-[20%] text-left align-top">
              <div className="border-b border-black p-1.5 flex justify-between items-center">
                <span className="font-bold">Código:</span>
                <span className="font-mono pr-2">{ficha.codigo || "CO-PR-005"}</span>
              </div>
              <div className="p-1.5 flex justify-between items-center">
                <span className="font-bold">Revisão:</span>
                <span className="font-mono pr-2">{ficha.revisao || "03"}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Metadata Table */}
      <table className="w-full border-collapse border border-black border-t-0 text-[10px] text-zinc-900">
        <tbody>
          {/* Row 1 */}
          <tr className="border-b border-black">
            <td className="p-2 border-r border-black w-1/3">
              <span className="font-bold">Empresa:</span> EUNAMAN
            </td>
            <td className="p-2 border-r border-black w-[45%]">
              <span className="font-bold">Processo:</span>{' '}
              <span className="font-mono">{ficha.processo === 'Colheita' ? '(X)' : '( )'}</span> Colheita{' '}
              <span className="font-mono">{ficha.processo === 'Silvicultura' ? '(X)' : '( )'}</span> Silvicultura{' '}
              <span className="font-mono">{ficha.processo === 'Logística' ? '(X)' : '( )'}</span> Logística{' '}
              <span className="font-mono">( )</span> _________
            </td>
            <td className="p-2 w-[22%]">
              <span className="font-bold">Núcleo:</span> {ficha.nucleo}
            </td>
          </tr>
          {/* Row 2 */}
          <tr>
            <td className="p-2 border-r border-black w-1/3">
              <span className="font-bold">Placa Caminhão:</span> <span className="font-bold font-mono">{ficha.placa}</span>
            </td>
            <td className="p-2 border-r border-black w-[45%]">
              <span className="font-bold">Motorista:</span> <span className="font-bold">{ficha.motorista}</span>
            </td>
            <td className="p-1 w-[22%] text-center align-middle relative">
              <div className="flex flex-col items-center justify-center min-h-[32px] w-full py-0.5">
                <div className="text-[9px] leading-none mb-1">
                  <span className="font-bold">Supervisor Suzano:</span> <span className="font-extrabold">{ficha.supervisor_suzano}</span>
                </div>
                <div className="h-[22px] w-[110px] flex items-center justify-center">
                  {ficha.assinatura_supervisor ? (
                    <img 
                      src={ficha.assinatura_supervisor} 
                      className="max-h-full max-w-full object-contain" 
                      alt="Assinatura Supervisor" 
                    />
                  ) : (
                    <div className="w-2/3 border-b border-dotted border-zinc-400 h-px mt-2" />
                  )}
                </div>
              </div>
            </td>
          </tr>
          {/* Row 3 - Operational Period */}
          <tr className="border-t border-black">
            <td className="p-2 border-r border-black w-1/3">
              <span className="font-bold">Mês Referência:</span> <span className="font-bold uppercase">{getMonthName(ficha.mes)} / {ficha.ano}</span>
            </td>
            <td className="p-2 border-r border-black w-[45%]" colSpan={2}>
              <span className="font-bold">Período Operacional:</span>{' '}
              {(() => {
                const period = Array.isArray(calendario) ? calendario.find(p => p && p.mes === ficha.mes && p.ano === ficha.ano) : null;
                if (!period) return <span className="font-mono text-zinc-450">Não informado</span>;
                return (
                  <span className="font-mono font-bold">
                    {safeFormatDate(period.data_inicio, 'dd/MM/yyyy')} a {safeFormatDate(period.data_fim, 'dd/MM/yyyy')} ({period.total_dias} dias)
                  </span>
                );
              })()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Main Table */}
      <table className="w-full border-collapse border border-black border-t-0 text-[9px] text-zinc-900">
        <thead>
          <tr className="bg-zinc-100 text-zinc-800 font-bold border-b border-black">
            <th className="border border-black p-2 w-[90px] text-center">Data</th>
            <th className="border border-black p-2 w-[110px] text-center">ID Ponto*</th>
            <th className="border border-black p-2 text-center w-[80px]">Hora Inicial<br/>(HH:MM)</th>
            <th className="border border-black p-2 text-center w-[80px]">Hora Final<br/>(HH:MM)</th>
            <th className="border border-black p-2 text-center w-[120px]">Volume Captado<br/>(Litros)</th>
            <th className="border border-black p-2 text-center">Fazenda Captada</th>
            <th className="border border-black p-2 text-center w-[100px]">UP da Captação</th>
            <th className="border border-black p-2 text-center">Atividade</th>
            <th className="border border-black p-2 text-center">Fazenda da Atividade</th>
            <th className="border border-black p-2 text-center font-bold">UP da Atividade</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const sorted = ficha.lancamentos && Array.isArray(ficha.lancamentos)
              ? [...ficha.lancamentos].sort((a: any, b: any) => {
                  const dateCompare = (a.data || '').localeCompare(b.data || '');
                  if (dateCompare !== 0) return dateCompare;
                  return (a.hora_inicial || '').localeCompare(b.hora_inicial || '');
                })
              : [];
            return sorted.length > 0 ? (
              sorted.map((row: any, index: number) => (
                <tr key={index} className="text-center text-zinc-955 font-semibold border-b border-black">
                  <td className="border border-black p-1.5">{safeFormatDate(row.data, 'dd/MM/yyyy')}</td>
                  <td className="border border-black p-1.5 font-mono">
                    {row.foto_ponto && onPhotoClick ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onPhotoClick(row.foto_ponto)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-bold text-[9px] tracking-wide transition-all shadow-sm flex items-center justify-center gap-1 mx-auto hover:scale-105 active:scale-95 print:hidden"
                        >
                          📷 {row.id_ponto}
                        </button>
                        <span className="hidden print:inline">{row.id_ponto}</span>
                      </>
                    ) : (
                      row.id_ponto
                    )}
                  </td>
                  <td className="border border-black p-1.5 font-mono">{row.hora_inicial}</td>
                  <td className="border border-black p-1.5 font-mono">{row.hora_final}</td>
                  <td className="border border-black p-1.5 font-mono font-bold">
                    {Number(row.volume_captado).toLocaleString('pt-BR')} L
                  </td>
                  <td className="border border-black p-1.5 uppercase truncate max-w-[120px]">{row.fazenda_captada}</td>
                  <td className="border border-black p-1.5 font-mono">{row.up_captacao}</td>
                  <td className="border border-black p-1.5">{row.atividade}</td>
                  <td className="border border-black p-1.5 uppercase truncate max-w-[120px]">{row.fazenda_atividade}</td>
                  <td className="border border-black p-1.5 font-mono">{row.up_atividade}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-black">
                <td colSpan={10} className="border border-black p-6 text-center text-zinc-400 italic">
                  Nenhum lançamento registrado nesta ficha operacional.
                </td>
              </tr>
            );
          })()}
          {/* Blank rows to fill space */}
          {Array.from({ length: Math.max(0, 14 - (ficha.lancamentos?.length || 0)) }).map((_, idx) => (
            <tr key={`blank-${idx}`} className="border-b border-black">
              <td className="border border-black p-3"></td>
              <td className="border border-black p-3"></td>
              <td className="border border-black p-3"></td>
              <td className="border border-black p-3"></td>
              <td className="border border-black p-3"></td>
              <td className="border border-black p-3"></td>
              <td className="border border-black p-3"></td>
              <td className="border border-black p-3"></td>
              <td className="border border-black p-3"></td>
              <td className="border border-black p-3"></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer notes */}
      <div className="flex justify-between items-end mt-2 text-[7px] text-zinc-500 leading-tight">
        <div>
          <p className="font-bold">* Preencher com o código do ponto ou número da outorga / certidão de dispensa</p>
          <p className="font-bold">** Em atividades de silvicultura preencher UP e talhão trabalhado</p>
        </div>
        <div className="text-right font-mono">
          <p>Código do formulário e revisão</p>
        </div>
      </div>

    </div>
  );
};

interface CaptacaoClientProps {
  initialFichas: any[];
  equipamentos: any[];
  colaboradores: any[];
  calendario: any[];
}

export default function CaptacaoClient({ 
  initialFichas, 
  equipamentos, 
  colaboradores, 
  calendario 
}: CaptacaoClientProps) {
  const { isOnline } = useOffline();
  const { profile } = useAuth();
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // State
  const [fichas, setFichas] = useState<any[]>(initialFichas);
  const [selectedFicha, setSelectedFicha] = useState<any | null>(null);
  const [showFichaPaper, setShowFichaPaper] = useState(true);
  
  const [activeScreen, setActiveScreen] = useState<'home' | 'list' | 'details'>('home');
  const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);
  const [isSavingFicha, setIsSavingFicha] = useState(false);
  const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'suzano' | 'sistema'>('suzano');
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [editingLancamentoId, setEditingLancamentoId] = useState<string | null>(null);

  // Fase 5 (design nativo): substitui window.confirm/alert por ConfirmDialog/Toast, e o
  // antigo stack vertical de ~9 botões (um por ação da ficha) por um ActionSheet behind
  // "⋮ Mais ações" — "Adicionar Linha" (ação mais usada) continua sempre visível, como Fab.
  const toast = useToast();
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [isFichaActionsOpen, setIsFichaActionsOpen] = useState(false);
  const [actionLancamentoId, setActionLancamentoId] = useState<string | null>(null);

  // Determine current active Suzano operational period
  const currentPeriod = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const period = Array.isArray(calendario) ? calendario.find(p => p && p.data_inicio <= today && p.data_fim >= today) : null;
    if (period) return period;
    
    // Fallback if no matching dates: use current month/year
    const now = new Date();
    return {
      ano: now.getFullYear(),
      mes: now.getMonth() + 1,
      data_inicio: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      data_fim: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    };
  }, [calendario]);

  // Determine if a Ficha is expired (belongs to a past operational month)
  const isFichaLocked = useCallback((ficha: any) => {
    if (!ficha) return true;
    if (ficha.status === 'Fechada') return true;

    // Reaberta manualmente (ex: faltou lançar algo do mês passado): a marca de reabertura
    // vence a trava automática por período abaixo, senão a ficha travaria de novo na hora.
    if (ficha.reaberta_em) return false;

    // If the Ficha belongs to a past year or past month, it is automatically closed
    if (Number(ficha.ano) < currentPeriod.ano) return true;
    if (Number(ficha.ano) === currentPeriod.ano && Number(ficha.mes) < currentPeriod.mes) return true;

    return false;
  }, [currentPeriod]);

  // New Ficha form state
  const [newFichaData, setNewFichaData] = useState({
    placa: '',
    placaCustom: '',
    motorista: '',
    motoristaCustom: '',
    processo: 'Colheita',
    nucleo: 'Suzano',
    supervisor_suzano: '',
    codigo: 'CO-PR-005',
    revisao: '03',
    mes: 0,
    ano: 0
  });

  // Initialize new Ficha period to current period on modal open
  useEffect(() => {
    if (isFichaModalOpen && currentPeriod) {
      setNewFichaData(prev => ({
        ...prev,
        mes: prev.mes || currentPeriod.mes,
        ano: prev.ano || currentPeriod.ano
      }));
    }
  }, [isFichaModalOpen, currentPeriod]);

  // New Lancamento form state
  const [newLancamentoData, setNewLancamentoData] = useState({
    data: new Date().toISOString().split('T')[0],
    id_ponto: '',
    hora_inicial: '',
    hora_final: '',
    volume_captado: '',
    fazenda_captada: '',
    up_captacao: '',
    atividade: 'Lavagem',
    fazenda_atividade: '',
    up_atividade: '',
    foto_ponto: null as string | null
  });

  // ── Registra o callback da ponte nativa do APK (EunamanCamera) para Captação ──
  useEffect(() => {
    if (typeof window === "undefined") return;

    (window as any).onEunamanCameraResult = (jsonStr: string) => {
      try {
        const result = JSON.parse(jsonStr);
        if (result.success && result.dataUrl) {
          // Comprime via canvas antes de adicionar
          const img = new Image();
          img.src = result.dataUrl;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX = 800;
            let w = img.width;
            let h = img.height;
            if (w > h) {
              if (w > MAX) {
                h = Math.round((h * MAX) / w);
                w = MAX;
              }
            } else {
              if (h > MAX) {
                w = Math.round((w * MAX) / h);
                h = MAX;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              const compressed = canvas.toDataURL("image/jpeg", 0.6);
              setNewLancamentoData(prev => ({ ...prev, foto_ponto: compressed }));
            } else {
              setNewLancamentoData(prev => ({ ...prev, foto_ponto: result.dataUrl }));
            }
          };
          img.onerror = () => {
            setNewLancamentoData(prev => ({ ...prev, foto_ponto: result.dataUrl }));
          };
        } else if (!result.success) {
          console.warn("[EunamanCamera] Erro na ponte nativa:", result.error);
        }
      } catch (e) {
        console.error("[EunamanCamera] Erro ao processar resultado:", e);
      }
    };

    // Recupera foto pendente se a Activity tiver sido recriada pelo Android
    const timer = setTimeout(() => {
      if ((window as any).EunamanCamera && (window as any).EunamanCamera.getPendingPhoto) {
        try {
          const pending = (window as any).EunamanCamera.getPendingPhoto();
          if (pending) {
            (window as any).onEunamanCameraResult(pending);
          }
        } catch (e) {
          console.warn("[EunamanCamera] Erro ao buscar foto pendente:", e);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      delete (window as any).onEunamanCameraResult;
    };
  }, []);

  const hasRestoredRef = useRef(false);

  // Salvar rascunho do lançamento de captação
  useEffect(() => {
    if (!mounted || !hasRestoredRef.current) return;
    try {
      if (isLancamentoModalOpen) {
        localStorage.setItem('eunaman_captacao_lancamento_draft', JSON.stringify(newLancamentoData));
        localStorage.setItem('eunaman_captacao_modal_open', 'true');
      } else {
        localStorage.removeItem('eunaman_captacao_lancamento_draft');
        localStorage.setItem('eunaman_captacao_modal_open', 'false');
      }
    } catch (e) {
      console.error("Erro ao salvar rascunho de captação:", e);
    }
  }, [newLancamentoData, isLancamentoModalOpen, mounted]);

  // Restaurar rascunho do lançamento de captação ao montar
  useEffect(() => {
    if (typeof window === "undefined" || !mounted) return;
    try {
      const modalOpen = localStorage.getItem('eunaman_captacao_modal_open');
      const draft = localStorage.getItem('eunaman_captacao_lancamento_draft');
      if (modalOpen === 'true' && draft) {
        const parsed = JSON.parse(draft);
        if (parsed && typeof parsed === 'object') {
          setNewLancamentoData(parsed);
          setIsLancamentoModalOpen(true);
        }
      }
    } catch (e) {
      console.error("Erro ao restaurar rascunho de captação:", e);
    } finally {
      hasRestoredRef.current = true;
    }
  }, [mounted]);

  // Ajustar a data do lançamento para ficar dentro do período operacional da Ficha
  useEffect(() => {
    if (isLancamentoModalOpen && selectedFicha) {
      const period = Array.isArray(calendario) ? calendario.find(p => p && p.mes === selectedFicha.mes && p.ano === selectedFicha.ano) : null;
      if (period) {
        const today = new Date().toISOString().split('T')[0];
        const isTodayValid = today >= period.data_inicio && today <= period.data_fim;
        const defaultDate = isTodayValid ? today : period.data_inicio;
        
        setNewLancamentoData(prev => {
          const currentVal = prev.data;
          const isCurrentValValid = currentVal >= period.data_inicio && currentVal <= period.data_fim;
          if (!isCurrentValValid) {
            return { ...prev, data: defaultDate };
          }
          return prev;
        });
      }
    }
  }, [isLancamentoModalOpen, selectedFicha, calendario]);

  // Fase 5 (design nativo): a navegação entre home/list/details agora é só
  // setActiveScreen(...) direto (igual aos outros módulos) — o antigo mecanismo de
  // window.history.pushState/popstate (usado antes de existir HashRouter de verdade)
  // foi removido daqui pra não brigar com o botão físico de voltar do Android, que hoje
  // já navega via webView.canGoBack()/goBack() no nível do app inteiro.

  // Limpar a Ficha selecionada quando voltar das telas de detalhes
  useEffect(() => {
    if (activeScreen !== 'details') {
      setSelectedFicha(null);
    }
  }, [activeScreen]);

  const [showCamera, setShowCamera] = useState(false);

  // Search and status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Todas' | 'Aberta' | 'Fechada'>('Todas');

  // Filtro de período operacional (Default para o período operacional ativo)
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<{ mes: number; ano: number } | 'Todos'>(() => {
    const today = new Date().toISOString().split('T')[0];
    const period = Array.isArray(calendario) ? calendario.find(p => p && p.data_inicio <= today && p.data_fim >= today) : null;
    if (period) {
      return { mes: period.mes, ano: period.ano };
    }
    const now = new Date();
    return { mes: now.getMonth() + 1, ano: now.getFullYear() };
  });

  const periodOptions = useMemo(() => {
    const list = (Array.isArray(calendario) && calendario.length > 0) ? calendario : (Array.isArray(fichas) ? fichas : []);
    const options = list.filter(c => c && c.mes !== undefined && c.ano !== undefined).map(c => ({
      mes: c.mes,
      ano: c.ano,
      label: `${getMonthName(c.mes)} / ${c.ano}`
    }));
    
    const unique: typeof options = [];
    const seen = new Set<string>();
    options.forEach(o => {
      const key = `${o.ano}-${o.mes}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(o);
      }
    });
    
    return unique.sort((a, b) => (Number(a.ano) || 0) - (Number(b.ano) || 0) || (Number(a.mes) || 0) - (Number(b.mes) || 0));
  }, [calendario, fichas]);
  const [isExporting, setIsExporting] = useState(false);
  const [isFichaExpanded, setIsFichaExpanded] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  // Signature Pad States & Logic
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  const startDrawingSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e3a8a'; // Caneta azul escura
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawingSig(true);
  };

  const drawSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      if (e.cancelable) e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawingSig = () => {
    setIsDrawingSig(false);
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveSignature = async () => {
    const canvas = sigCanvasRef.current;
    if (!canvas || !selectedFicha) return;

    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.show("Por favor, faça a assinatura antes de salvar.", "error");
      return;
    }

    const base64Signature = canvas.toDataURL('image/png');

    if (isOnline) {
      const res = await atualizarFicha(selectedFicha.id, { assinatura_supervisor: base64Signature });
      if (res.success && res.data) {
        setFichas(prev => prev.map(f => f.id === selectedFicha.id ? { ...f, assinatura_supervisor: base64Signature } : f));
        setSelectedFicha(prev => ({ ...prev, assinatura_supervisor: base64Signature }));
        toast.show("Assinatura do supervisor salva com sucesso!", "success");
      } else {
        toast.show("Erro ao salvar assinatura: " + res.error, "error");
      }
    } else {
      const dbFicha = await localDb.get('fichas_captacao', selectedFicha.id);
      if (dbFicha) {
        const updated = { ...dbFicha, assinatura_supervisor: base64Signature };
        await localDb.put('fichas_captacao', updated);
        await localDb.addToQueue('captacao', 'update', { id: selectedFicha.id, assinatura_supervisor: base64Signature });
        window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));
        
        setFichas(prev => prev.map(f => f.id === selectedFicha.id ? updated : f));
        setSelectedFicha(prev => ({ ...prev, assinatura_supervisor: base64Signature }));
        toast.show("Assinatura do supervisor salva com sucesso (Offline)!", "success");
      }
    }

    setShowSignaturePad(false);
  };

  const handleRemoveSignature = async () => {
    if (!selectedFicha) return;

    if (isOnline) {
      const res = await atualizarFicha(selectedFicha.id, { assinatura_supervisor: null });
      if (res.success && res.data) {
        setFichas(prev => prev.map(f => f.id === selectedFicha.id ? { ...f, assinatura_supervisor: null } : f));
        setSelectedFicha(prev => ({ ...prev, ...res.data, assinatura_supervisor: null }));
        toast.show("Assinatura do supervisor removida com sucesso!", "success");
      } else if (res.error) {
        toast.show("Erro ao remover assinatura: " + res.error, "error");
      }
    } else {
      const dbFicha = await localDb.get('fichas_captacao', selectedFicha.id);
      if (dbFicha) {
        const updated = { ...dbFicha, assinatura_supervisor: null };
        await localDb.put('fichas_captacao', updated);
        await localDb.addToQueue('captacao', 'update', { id: selectedFicha.id, assinatura_supervisor: null });
        window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));
        
        setFichas(prev => prev.map(f => f.id === selectedFicha.id ? updated : f));
        setSelectedFicha(prev => ({ ...prev, assinatura_supervisor: null }));
        toast.show("Assinatura do supervisor removida com sucesso (Offline)!", "success");
      }
    }
  };

  const handleExportExcel = () => {
    if (!selectedFicha) return;

    // Build array of arrays (AOA) for the sheet
    const aoa = [
      ["SUZANO", "CONTROLE DE CAPTAÇÃO DE ÁGUA", "", "", "", "", "", "", "Código:", selectedFicha.codigo || "CO-PR-005"],
      ["", "", "", "", "", "", "", "", "Revisão:", selectedFicha.revisao || "03"],
      [],
      ["Empresa:", "Eunaman", "", "Processo:", selectedFicha.processo || "", "", "Núcleo:", selectedFicha.nucleo || ""],
      ["Placa Caminhão:", selectedFicha.placa || "", "", "Motorista:", selectedFicha.motorista || "", "", "Supervisor Suzano:", selectedFicha.supervisor_suzano || ""],
      [],
      [
        "Data", 
        "ID Ponto", 
        "Hora Inicial", 
        "Hora Final", 
        "Volume Captado (Litros)", 
        "Fazenda Captada", 
        "UP Captação", 
        "Atividade", 
        "Fazenda da Atividade", 
        "UP da Atividade"
      ]
    ];

    // Add launches
    if (selectedFicha.lancamentos && selectedFicha.lancamentos.length > 0) {
      const sortedLancamentos = [...selectedFicha.lancamentos].sort((a: any, b: any) => a.data.localeCompare(b.data) || a.hora_inicial.localeCompare(b.hora_inicial));
      
      sortedLancamentos.forEach((row: any) => {
        aoa.push([
          safeFormatDate(row.data, 'dd/MM/yyyy'),
          row.id_ponto || "",
          row.hora_inicial || "",
          row.hora_final || "",
          Number(row.volume_captado) || 0,
          row.fazenda_captada || "",
          row.up_captacao || "",
          row.atividade || "",
          row.fazenda_atividade || "",
          row.up_atividade || ""
        ]);
      });
    }

    // Add total volume row
    const total = selectedFicha.lancamentos ? selectedFicha.lancamentos.reduce((acc: number, val: any) => acc + Number(val.volume_captado || 0), 0) : 0;
    aoa.push([]);
    aoa.push(["", "", "", "Volume Total (L):", total]);

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Apply column widths
    const wscols = [
      { wch: 12 }, // Data
      { wch: 12 }, // ID Ponto
      { wch: 12 }, // Hora Inicial
      { wch: 12 }, // Hora Final
      { wch: 22 }, // Volume
      { wch: 20 }, // Fazenda Captada
      { wch: 15 }, // UP Captação
      { wch: 15 }, // Atividade
      { wch: 20 }, // Fazenda Atividade
      { wch: 15 }  // UP Atividade
    ];
    worksheet["!cols"] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Controle Captação");

    const isAndroidApp = typeof window !== "undefined" && (window as any).EunamanApp && typeof (window as any).EunamanApp.saveBase64File === "function";
    const filename = `Ficha_Captacao_${selectedFicha.placa}_${selectedFicha.ano}_${selectedFicha.mes}.xlsx`;

    if (isAndroidApp) {
      try {
        const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        (window as any).EunamanApp.saveBase64File(excelBase64, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } catch (err: any) {
        console.error("Erro ao gerar Excel para App:", err);
        toast.show("Erro ao salvar Excel: " + err.message, "error");
      }
    } else {
      XLSX.writeFile(workbook, filename);
      toast.show("Planilha Excel gerada e baixada com sucesso!", "success");
    }
  };

  const handleExportPDF = (modo: "download" | "share" = "download") => {
    setIsExporting(true);

    const element = document.getElementById("ficha-captacao-print");
    if (!element) {
      toast.show("Erro ao localizar elemento da ficha.", "error");
      setIsExporting(false);
      return;
    }

    const filename = `Ficha_Captacao_${selectedFicha.placa}_${selectedFicha.ano}_${selectedFicha.mes}.pdf`;

    // Use rAF to let the UI update and show the loading overlay antes do trabalho pesado
    // do html2canvas travar a thread principal por um instante.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(async () => {
          try {
            await baixarOuCompartilharPdf(
              element,
              filename,
              `Ficha de Captação — ${selectedFicha.placa}`,
              `Ficha de Captação de Água da placa ${selectedFicha.placa} (${selectedFicha.mes}/${selectedFicha.ano})`,
              modo,
              { image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }
            );
            if (modo === "download") toast.show("Ficha em PDF gerada e baixada com sucesso!", "success");
          } finally {
            setIsExporting(false);
          }
        }, 50);
      });
    });
  };

  // Load IndexedDB cache on init or sync complete
  const loadLocalCache = async () => {
    try {
      const localFichas = await localDb.getAll('fichas_captacao');
      const localLancamentos = await localDb.getAll('lancamentos_captacao');
      
      if (Array.isArray(localFichas)) {
        const cleanLancamentos = Array.isArray(localLancamentos) ? localLancamentos : [];
        const merged = localFichas.map(f => {
          if (!f) return null;
          const rows = cleanLancamentos.filter(l => l && l.ficha_id === f.id);
          return { ...f, lancamentos: rows };
        }).filter(Boolean);
        
        if (merged.length > 0) {
          setFichas(merged);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do cache IndexedDB:", err);
    }
  };

  // Sync Supabase to IndexedDB when online
  const cacheToLocalDB = async () => {
    if (!isOnline || !Array.isArray(initialFichas)) return;
    try {
      const localFichas = await localDb.getAll('fichas_captacao');
      const localLanc = await localDb.getAll('lancamentos_captacao');
      
      const cleanLocalFichas = Array.isArray(localFichas) ? localFichas : [];
      const cleanLocalLanc = Array.isArray(localLanc) ? localLanc : [];
      
      const serverFichas = initialFichas.filter(f => f).map(({ lancamentos, ...f }) => f);
      const serverLanc = initialFichas.filter(f => f).flatMap(f => f.lancamentos || []);
      
      const serverFichasIds = new Set(serverFichas.filter(f => f && f.id).map(f => f.id));
      const serverLancIds = new Set(serverLanc.filter(l => l && l.id).map(l => l.id));
      
      // Salva/atualiza os dados vindos do servidor no IndexedDB
      await localDb.saveMany('fichas_captacao', serverFichas);
      if (serverLanc.length > 0) {
        await localDb.saveMany('lancamentos_captacao', serverLanc);
      }
      
      // Deleta itens locais obsoletos que NÃO estão no servidor e NÃO estão pendentes de sincronização
      const fichasToDelete = cleanLocalFichas.filter(f => {
        if (!f) return false;
        const isPending = f._isPendingSync || String(f.id).startsWith('temp_');
        return !serverFichasIds.has(f.id) && !isPending;
      });
      if (fichasToDelete.length > 0) {
        await localDb.deleteMany('fichas_captacao', fichasToDelete.map(f => f.id));
      }
      
      const lancToDelete = cleanLocalLanc.filter(l => {
        if (!l) return false;
        const isPending = l._isPendingSync || String(l.id).startsWith('temp_');
        return !serverLancIds.has(l.id) && !isPending;
      });
      if (lancToDelete.length > 0) {
        await localDb.deleteMany('lancamentos_captacao', lancToDelete.map(l => l.id));
      }
    } catch (err) {
      console.warn("Erro ao fazer cache seguro dos dados no IndexedDB:", err);
    }
  };

  useEffect(() => {
    cacheToLocalDB();
  }, [initialFichas, isOnline]);

  useEffect(() => {
    if (!isOnline) {
      loadLocalCache();
    } else {
      setFichas(initialFichas);
    }
  }, [initialFichas, isOnline]);

  // Listener to sync completed removido para evitar loop infinito de reloads.
  // A atualização dos dados locais após o sync já é tratada reativamente no pai (page.tsx).

  // Filtered Fichas list
  const filteredFichas = useMemo(() => {
    return fichas.filter(f => {
      if (!f) return false;
      const motoristaName = f.motorista?.toLowerCase() || '';
      const placaStr = f.placa?.toLowerCase() || '';
      const matchesSearch = motoristaName.includes(searchTerm.toLowerCase()) || placaStr.includes(searchTerm.toLowerCase());
      
      const locked = isFichaLocked(f);
      const computedStatus = locked ? 'Fechada' : 'Aberta';
      const matchesStatus = filterStatus === 'Todas' || computedStatus === filterStatus;
      
      let matchesPeriod = true;
      if (selectedPeriodFilter !== 'Todos') {
        matchesPeriod = f.mes === selectedPeriodFilter.mes && f.ano === selectedPeriodFilter.ano;
      }
      
      return matchesSearch && matchesStatus && matchesPeriod;
    });
  }, [fichas, searchTerm, filterStatus, isFichaLocked, selectedPeriodFilter]);

  // Handle Creating a new Ficha
  const handleCreateFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingFicha) return;
    
    const finalPlaca = newFichaData.placa === 'custom' ? newFichaData.placaCustom.toUpperCase().trim() : newFichaData.placa;
    const finalMotorista = newFichaData.motorista === 'custom' ? newFichaData.motoristaCustom.trim() : newFichaData.motorista;

    if (!finalPlaca || !finalMotorista) {
      toast.show('Placa e Motorista são obrigatórios!', "error");
      return;
    }

    const finalMes = newFichaData.mes || currentPeriod.mes;
    const finalAno = newFichaData.ano || currentPeriod.ano;

    // Trava para salvar apenas uma ficha por placa no mesmo período operacional (mês e ano)
    const exists = fichas.some(f => 
      f && 
      f.placa && 
      f.placa.toUpperCase() === finalPlaca.toUpperCase() && 
      Number(f.mes) === Number(finalMes) && 
      Number(f.ano) === Number(finalAno)
    );

    if (exists) {
      toast.show(`Já existe uma ficha cadastrada para a placa ${finalPlaca} no período de ${getMonthName(finalMes)} / ${finalAno}!`, "error");
      return;
    }

    setIsSavingFicha(true);

    const payload = {
      ano: finalAno,
      mes: finalMes,
      placa: finalPlaca,
      motorista: finalMotorista,
      processo: newFichaData.processo,
      nucleo: newFichaData.nucleo,
      supervisor_suzano: newFichaData.supervisor_suzano,
      codigo: newFichaData.codigo,
      revisao: newFichaData.revisao
    };

    const saveOffline = async () => {
      const tempId = generateId();
      const offlineFicha = {
        id: tempId,
        status: 'Aberta' as const,
        criado_por: null,
        created_at: new Date().toISOString().split('.')[0],
        ...payload
      };

      await localDb.put('fichas_captacao', offlineFicha);
      await localDb.addToQueue('captacao', 'create', payload);
      window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));

      setFichas(prev => [offlineFicha, ...prev]);
      setSelectedFicha({ ...offlineFicha, lancamentos: [] });
      setShowFichaPaper(false);
      setViewMode('suzano');
      setActiveScreen('details');
      setIsFichaModalOpen(false);
      // Reset form
      setNewFichaData({
        placa: '',
        placaCustom: '',
        motorista: '',
        motoristaCustom: '',
        processo: 'Colheita',
        nucleo: 'Suzano',
        supervisor_suzano: '',
        codigo: 'CO-PR-005',
        revisao: '03',
        mes: 0,
        ano: 0
      });
    };

    try {
      if (isOnline) {
        const res = await criarFicha(payload);
        if (res.success && res.data) {
          await localDb.put('fichas_captacao', res.data);
          setFichas(prev => [res.data, ...prev]);
          setSelectedFicha({ ...res.data, lancamentos: [] });
          setShowFichaPaper(false);
          setViewMode('suzano');
          setActiveScreen('details');
          setIsFichaModalOpen(false);
          // Reset form
          setNewFichaData({
            placa: '',
            placaCustom: '',
            motorista: '',
            motoristaCustom: '',
            processo: 'Colheita',
            nucleo: 'Suzano',
            supervisor_suzano: '',
            codigo: 'CO-PR-005',
            revisao: '03',
            mes: 0,
            ano: 0
          });
        } else {
          console.warn("[Captacao] Falha ao criar online, tentando offline...", res?.error);
          await saveOffline();
        }
      } else {
        await saveOffline();
      }
    } catch (err: any) {
      console.error("[Captacao] Erro critico, forçando salvamento offline:", err);
      try {
        await saveOffline();
      } catch (dbErr) {
        toast.show('Erro ao salvar localmente: ' + err.message, "error");
      }
    } finally {
      setIsSavingFicha(false);
    }
  };

  // Handle Closing a Ficha manually
  const handleCloseFicha = async (id: string) => {

    if (isOnline) {
      const res = await fecharFicha(id);
      if (res.success) {
        const dbFicha = await localDb.get('fichas_captacao', id);
        if (dbFicha) {
          await localDb.put('fichas_captacao', { ...dbFicha, status: 'Fechada' });
        }
        setFichas(prev => prev.map(f => f.id === id ? { ...f, status: 'Fechada' } : f));
        if (selectedFicha?.id === id) {
          setSelectedFicha(prev => ({ ...prev, status: 'Fechada' }));
        }
        toast.show("Ficha fechada com sucesso!", "success");
      } else {
        toast.show('Erro ao fechar ficha: ' + res.error, "error");
      }
    } else {
      // Offline close
      const dbFicha = await localDb.get('fichas_captacao', id);
      if (dbFicha) {
        const updated = { ...dbFicha, status: 'Fechada' as const };
        await localDb.put('fichas_captacao', updated);
        await localDb.addToQueue('captacao', 'close', { id });
        window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));
        
        setFichas(prev => prev.map(f => f.id === id ? updated : f));
        if (selectedFicha?.id === id) {
          setSelectedFicha(prev => ({ ...prev, status: 'Fechada' }));
        }
        toast.show("Ficha fechada com sucesso (Offline)!", "success");
      }
    }
  };

  // Reabrir uma ficha já fechada (ou automaticamente travada por período) — ex: faltou
  // lançar uma captação do mês passado. Exige internet: precisa gravar reaberta_em no
  // servidor pra trava automática por período não reaplicar assim que a ficha for lida.
  const handleReabrirFicha = async (id: string) => {
    if (!isOnline) {
      toast.show("Reabrir uma ficha requer conexão com a internet.", "error");
      return;
    }

    const res = await reabrirFicha(id);
    if (!res.success) {
      toast.show('Erro ao reabrir ficha: ' + res.error, "error");
      return;
    }

    const reabertaEm = res.data?.reaberta_em || new Date().toISOString();
    const dbFicha = await localDb.get('fichas_captacao', id);
    if (dbFicha) {
      await localDb.put('fichas_captacao', { ...dbFicha, status: 'Aberta', reaberta_em: reabertaEm });
    }
    setFichas(prev => prev.map(f => f.id === id ? { ...f, status: 'Aberta', reaberta_em: reabertaEm } : f));
    if (selectedFicha?.id === id) {
      setSelectedFicha((prev: any) => ({ ...prev, status: 'Aberta', reaberta_em: reabertaEm }));
    }
    toast.show("Ficha reaberta com sucesso!", "success");
  };

  // Handle Deleting a Ficha
  const handleDeleteFicha = async (id: string) => {

    if (isOnline) {
      const res = await excluirFicha(id);
      if (res.success) {
        setFichas(prev => prev.filter(f => f.id !== id));
        if (selectedFicha?.id === id) {
          setSelectedFicha(null);
        }
        toast.show("Ficha excluída com sucesso!", "success");
        window.location.reload();
      } else {
        toast.show('Erro ao excluir: ' + res.error, "error");
      }
    } else {
      await localDb.delete('fichas_captacao', id);
      // Clean up launches of this ficha locally
      const localLancamientos = await localDb.getAll('lancamentos_captacao');
      const keysToDelete = localLancamientos.filter(l => l.ficha_id === id).map(l => l.id);
      if (keysToDelete.length > 0) {
        await localDb.deleteMany('lancamentos_captacao', keysToDelete);
      }
      
      await localDb.addToQueue('captacao', 'delete', { id });
      window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));

      setFichas(prev => prev.filter(f => f.id !== id));
      if (selectedFicha?.id === id) {
        setSelectedFicha(null);
      }
      toast.show("Ficha excluída com sucesso (Offline)!", "success");
      window.location.reload();
    }
  };

  // Handle Adding or Updating a Launch row
  const handleAddLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFicha) return;

    const volumeNum = parseFloat(newLancamentoData.volume_captado);
    if (isNaN(volumeNum) || volumeNum <= 0) {
      toast.show('Volume captado deve ser um número válido maior que 0.', "error");
      return;
    }

    const period = Array.isArray(calendario) ? calendario.find(p => p && p.mes === selectedFicha.mes && p.ano === selectedFicha.ano) : null;
    if (period) {
      if (newLancamentoData.data < period.data_inicio || newLancamentoData.data > period.data_fim) {
        toast.show(`A data do lançamento deve estar dentro do período operacional da ficha: de ${safeFormatDate(period.data_inicio, 'dd/MM/yyyy')} a ${safeFormatDate(period.data_fim, 'dd/MM/yyyy')}`, "error");
        return;
      }
    }

    const payload = {
      ficha_id: selectedFicha.id,
      data: newLancamentoData.data,
      id_ponto: newLancamentoData.id_ponto.trim(),
      hora_inicial: newLancamentoData.hora_inicial.trim(),
      hora_final: newLancamentoData.hora_final.trim(),
      volume_captado: volumeNum,
      fazenda_captada: newLancamentoData.fazenda_captada.trim(),
      up_captacao: newLancamentoData.up_captacao.trim(),
      atividade: newLancamentoData.atividade.trim(),
      fazenda_atividade: newLancamentoData.fazenda_atividade.trim(),
      up_atividade: newLancamentoData.up_atividade.trim(),
      foto_ponto: newLancamentoData.foto_ponto // base64 representation
    };

    const addOffline = async () => {
      const tempId = generateId();
      const offlineRow = {
        id: tempId,
        created_at: new Date().toISOString().split('.')[0],
        ...payload
      };

      await localDb.put('lancamentos_captacao', offlineRow);
      await localDb.addToQueue('captacao', 'add_lancamento', payload);
      window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));

      setFichas(prev => prev.map(f => {
        if (f.id === selectedFicha.id) {
          return { ...f, lancamentos: [...(f.lancamentos || []), offlineRow] };
        }
        return f;
      }));
      setSelectedFicha(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          lancamentos: [...(prev.lancamentos || []), offlineRow]
        };
      });
      toast.show("Lançamento adicionado com sucesso (Offline)!", "success");
    };

    const updateOffline = async () => {
      const updatedRow = {
        id: editingLancamentoId!,
        ...payload
      };
      await localDb.put('lancamentos_captacao', updatedRow);
      // Bug pré-existente no app principal (app/captacao/CaptacaoClient.tsx): aqui usava
      // addToQueue('captacao', 'update', ...), que no replay engine (lib/offline-actions.ts)
      // cai no branch que chama atualizarFicha(id, ...) — a action de FICHA, não de
      // lançamento. Como editingLancamentoId é o id de um LANÇAMENTO, o replay silenciosamente
      // não atualiza nada (nenhuma ficha tem esse id) e a edição feita offline se perde sem
      // erro visível. O entity/action correto já existe e funciona (update_lancamento →
      // atualizarLancamento) — corrigido só aqui, reportar separadamente pro app principal.
      await localDb.addToQueue('captacao', 'update_lancamento', { id: editingLancamentoId, ...payload });
      window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));

      setFichas(prev => prev.map(f => {
        if (f.id === selectedFicha.id) {
          return {
            ...f,
            lancamentos: f.lancamentos.map((l: any) => l.id === editingLancamentoId ? updatedRow : l)
          };
        }
        return f;
      }));
      setSelectedFicha(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          lancamentos: prev.lancamentos.map((l: any) => l.id === editingLancamentoId ? updatedRow : l)
        };
      });
      toast.show("Lançamento atualizado com sucesso (Offline)!", "success");
    };

    try {
      if (editingLancamentoId) {
        if (isOnline) {
          const res = await atualizarLancamento(editingLancamentoId, payload);
          if (res.success && res.data) {
            const updated = res.data;
            await localDb.put('lancamentos_captacao', updated);
            setFichas(prev => prev.map(f => {
              if (f.id === selectedFicha.id) {
                return {
                  ...f,
                  lancamentos: f.lancamentos.map((l: any) => l.id === editingLancamentoId ? updated : l)
                };
              }
              return f;
            }));
            setSelectedFicha(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              lancamentos: prev.lancamentos.map((l: any) => l.id === editingLancamentoId ? updated : l)
            };
          });
          toast.show("Lançamento atualizado com sucesso!", "success");
          } else {
            console.warn("[Captacao] Falha ao atualizar online, tentando offline...", res?.error);
            await updateOffline();
          }
        } else {
          await updateOffline();
        }
      } else {
        if (isOnline) {
          const res = await adicionarLancamento(payload);
          if (res.success && res.data) {
            const added = res.data;
            await localDb.put('lancamentos_captacao', added);
            setFichas(prev => prev.map(f => {
              if (f.id === selectedFicha.id) {
                return { ...f, lancamentos: [...(f.lancamentos || []), added] };
              }
              return f;
            }));
            setSelectedFicha(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              lancamentos: [...(prev.lancamentos || []), added]
            };
          });
          toast.show("Lançamento adicionado com sucesso!", "success");
          } else {
            console.warn("[Captacao] Falha ao adicionar online, tentando offline...", res?.error);
            await addOffline();
          }
        } else {
          await addOffline();
        }
      }
    } catch (err: any) {
      console.error("[Captacao] Erro ao salvar lançamento, caindo para offline:", err);
      try {
        if (editingLancamentoId) await updateOffline();
        else await addOffline();
      } catch (e) {
        toast.show("Erro crítico ao salvar lançamento.", "error");
      }
    }

    setIsLancamentoModalOpen(false);
    setEditingLancamentoId(null);
    // Reset launch form
    setNewLancamentoData({
      data: new Date().toISOString().split('T')[0],
      id_ponto: '',
      hora_inicial: '',
      hora_final: '',
      volume_captado: '',
      fazenda_captada: '',
      up_captacao: '',
      atividade: 'Lavagem',
      fazenda_atividade: '',
      up_atividade: '',
      foto_ponto: ''
    });
  };

  // Handle Deleting a Launch row
  const handleDeleteLancamento = async (id: string) => {
    if (isOnline) {
      const res = await excluirLancamento(id);
      if (res.success) {
        await localDb.delete('lancamentos_captacao', id);
        setFichas(prev => prev.map(f => {
          if (f.id === selectedFicha.id) {
            return { ...f, lancamentos: f.lancamentos.filter((l: any) => l.id !== id) };
          }
          return f;
        }));
        setSelectedFicha(prev => ({
          ...prev,
          lancamentos: prev.lancamentos.filter((l: any) => l.id !== id)
        }));
        toast.show("Lançamento excluído com sucesso!", "success");
      } else {
        toast.show('Erro ao excluir: ' + res.error, "error");
      }
    } else {
      // Offline delete
      await localDb.delete('lancamentos_captacao', id);
      await localDb.addToQueue('captacao', 'delete_lancamento', { id });
      window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));

      setFichas(prev => prev.map(f => {
        if (f.id === selectedFicha.id) {
          return { ...f, lancamentos: f.lancamentos.filter((l: any) => l.id !== id) };
        }
        return f;
      }));
      setSelectedFicha(prev => ({
        ...prev,
        lancamentos: prev.lancamentos.filter((l: any) => l.id !== id)
      }));
      toast.show("Lançamento excluído com sucesso (Offline)!", "success");
    }
  };

  // Calculate sum of volumes
  const totalVolume = useMemo(() => {
    if (!selectedFicha || !selectedFicha.lancamentos) return 0;
    return selectedFicha.lancamentos.reduce((acc: number, val: any) => acc + Number(val.volume_captado || 0), 0);
  }, [selectedFicha]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {isExporting && (
        <div className="fixed inset-0 z-[1300] flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-md text-white select-none">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <h3 className="font-bold text-lg tracking-wide">Gerando PDF da Ficha...</h3>
            <p className="text-sm text-zinc-400">Preparando o arquivo para download</p>
          </div>
        </div>
      )}

      {/* Printable Sheet View - ONLY VISIBLE ON PRINT */}
      {selectedFicha && (
        <div className="hidden print:block">
          {renderPaperFicha(selectedFicha, setActivePhoto, calendario)}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 print:hidden flex flex-col relative">

        {/* HUB: lista de módulos da tela (igual ao padrão nativo dos outros módulos) */}
        {activeScreen === 'home' && (
          <div className="p-4 space-y-2 pb-24">
            <ListRow
              icon={<FileText size={18} />}
              title="Fichas Operacionais"
              subtitle={`Visualizar e lançar dados (${fichas.length} ativas)`}
              onClick={() => setActiveScreen('list')}
            />
            {profile?.role !== 'visitante' && (
              <ListRow
                icon={<Plus size={18} />}
                title="Nova Ficha"
                subtitle="Criar ficha de captação para o período ativo"
                onClick={() => setIsFichaModalOpen(true)}
              />
            )}
          </div>
        )}

        {/* LISTA DE FICHAS OPERACIONAIS */}
        {activeScreen === 'list' && (
          <div className="flex flex-col h-full">
            <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-2 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
              <button
                onClick={() => setActiveScreen('home')}
                aria-label="Voltar"
                className="flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
                style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="flex-1 text-sm font-black text-zinc-50 truncate">
                Fichas Operacionais ({filteredFichas.length})
              </h2>
            </div>

            <div className="p-4 space-y-3 pb-24">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                  type="text"
                  placeholder="Buscar motorista/placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-amber-600"
                  style={{ minHeight: "var(--tap-min)" }}
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedPeriodFilter === 'Todos' ? 'Todos' : `${selectedPeriodFilter.ano}-${selectedPeriodFilter.mes}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Todos') {
                      setSelectedPeriodFilter('Todos');
                    } else {
                      const [ano, mes] = val.split('-').map(Number);
                      setSelectedPeriodFilter({ ano, mes });
                    }
                  }}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs font-bold text-zinc-300 outline-none"
                  style={{ minHeight: "var(--tap-min)" }}
                >
                  <option value="Todos">TODOS OS MESES</option>
                  {periodOptions.map(opt => (
                    <option key={`${opt.ano}-${opt.mes}`} value={`${opt.ano}-${opt.mes}`}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs font-bold text-zinc-300 outline-none"
                  style={{ minHeight: "var(--tap-min)" }}
                >
                  <option value="Todas">TODAS AS FICHAS</option>
                  <option value="Aberta">ABERTAS</option>
                  <option value="Fechada">FECHADAS</option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                {filteredFichas.length > 0 ? (
                  filteredFichas.map(f => {
                    const locked = isFichaLocked(f);
                    const launchesCount = f.lancamentos?.length || 0;
                    const period = Array.isArray(calendario) ? calendario.find(p => p && p.mes === f.mes && p.ano === f.ano) : null;
                    return (
                      <ListRow
                        key={f.id}
                        title={f.placa}
                        subtitle={`${f.motorista} · ${f.processo}`}
                        meta={`${getMonthName(f.mes)} ${f.ano}${period ? ` · ${safeFormatDate(period.data_inicio, 'dd/MM')} a ${safeFormatDate(period.data_fim, 'dd/MM')}` : ''} · ${launchesCount} captações`}
                        badge={
                          <span className={cn(
                            "px-2 py-0.5 text-[9px] font-black uppercase rounded-md",
                            locked ? "bg-zinc-800 text-zinc-400" : "bg-emerald-500/20 text-emerald-400"
                          )}>
                            {locked ? 'Fechada' : 'Aberta'}
                          </span>
                        }
                        icon={<Droplets size={18} />}
                        onClick={() => {
                          setSelectedFicha(f);
                          setActiveScreen('details');
                          setViewMode('suzano');
                          setShowFichaPaper(true);
                        }}
                      />
                    );
                  })
                ) : (
                  <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <p className="text-xs text-zinc-500 italic">Nenhuma ficha operacional encontrada.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DETALHE DA FICHA */}
        {activeScreen === 'details' && selectedFicha && (
          <div className="flex flex-col h-full">
            <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-2 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
              <button
                onClick={() => { setSelectedFicha(null); setActiveScreen('list'); }}
                aria-label="Voltar"
                className="flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
                style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-black text-zinc-50 truncate">{selectedFicha.placa}</h2>
                <p className="text-[10px] text-zinc-500 truncate">{selectedFicha.motorista} · {selectedFicha.processo}</p>
              </div>
              <button
                onClick={() => setIsFichaActionsOpen(true)}
                aria-label="Mais ações"
                className="flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
                style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
              >
                <MoreVertical size={20} />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-4 pb-24">
              <div className="grid grid-cols-3 gap-3">
                <StatTile icon={Droplets} label="Captações" value={selectedFicha.lancamentos?.length || 0} accent="amber" />
                <StatTile icon={Droplets} label="Volume total" value={`${totalVolume.toLocaleString('pt-BR')} L`} accent="emerald" />
                <StatTile icon={Calendar} label="Mês operacional" value={`${getMonthName(selectedFicha.mes)} ${selectedFicha.ano}`} accent="zinc" />
              </div>

              {/* Lançamentos */}
              <div className="space-y-2">
                {selectedFicha.lancamentos && selectedFicha.lancamentos.length > 0 ? (
                  [...selectedFicha.lancamentos].sort((a: any, b: any) => b.data.localeCompare(a.data) || b.created_at?.localeCompare(a.created_at)).map((row: any) => {
                    const podeEditar = profile?.role !== 'visitante' && (!isFichaLocked(selectedFicha) || ['admin', 'pcm', 'gestao'].includes(profile?.role || ''));
                    return (
                      <ListRow
                        key={row.id}
                        icon={row.foto_ponto ? undefined : <Camera size={18} />}
                        title={`${safeFormatDate(row.data, 'dd/MM/yyyy')} · ${row.id_ponto}`}
                        subtitle={`${row.fazenda_captada} → ${row.atividade} (${row.fazenda_atividade})`}
                        meta={`${Number(row.volume_captado).toLocaleString('pt-BR')} L · ${row.hora_inicial}-${row.hora_final}`}
                        onClick={row.foto_ponto ? () => setActivePhoto(row.foto_ponto) : undefined}
                        rightSlot={
                          <div className="flex items-center gap-2 shrink-0">
                            {row.foto_ponto && (
                              <img
                                src={row.foto_ponto}
                                onClick={(e) => { e.stopPropagation(); setActivePhoto(row.foto_ponto); }}
                                className="w-11 h-11 rounded-lg object-cover border border-zinc-800"
                                alt="Ponto"
                              />
                            )}
                            {podeEditar && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setActionLancamentoId(row.id); }}
                                aria-label="Mais ações do lançamento"
                                className="flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-800"
                                style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
                              >
                                <MoreVertical size={18} />
                              </button>
                            )}
                          </div>
                        }
                      />
                    );
                  })
                ) : (
                  <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <p className="text-xs text-zinc-500 italic">Nenhum lançamento registrado nesta ficha.</p>
                  </div>
                )}
              </div>

              {/* Elemento oculto no layout mas ativo no DOM para impressão/PDF */}
              <div className={cn(
                "fixed pointer-events-none -z-50 print:static print:opacity-100 print:pointer-events-auto bg-white text-zinc-950",
                isExporting ? "opacity-100 left-0 top-0" : "opacity-0 -left-[9999px]"
              )}>
                <div id="ficha-captacao-print" className="min-w-[1080px] w-[1080px] shrink-0 bg-white text-zinc-955">
                  {renderPaperFicha(selectedFicha, setActivePhoto, calendario)}
                </div>
              </div>
            </div>

            {!isFichaLocked(selectedFicha) && profile?.role !== 'visitante' && (
              <Fab icon={<Plus size={20} />} label="Adicionar" onClick={() => setIsLancamentoModalOpen(true)} />
            )}
          </div>
        )}
      </main>

      {/* ─── MODAL: NOVA FICHA OPERACIONAL ─── */}
      <BottomSheet open={isFichaModalOpen} onClose={() => setIsFichaModalOpen(false)} title="Nova Ficha de Captação" fullHeight>
        <form onSubmit={handleCreateFicha} className="flex flex-col h-full">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3">
            Suzano Mês Operacional: {getMonthName(currentPeriod.mes)} {currentPeriod.ano} ({safeFormatDate(currentPeriod.data_inicio, 'dd/MM/yyyy')} a {safeFormatDate(currentPeriod.data_fim, 'dd/MM/yyyy')})
          </p>

          <div className="flex-1 space-y-4">

                {/* Mês/Período Operacional Select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Mês / Período Operacional</label>
                  <select
                    required
                    value={newFichaData.ano && newFichaData.mes ? `${newFichaData.ano}-${newFichaData.mes}` : ''}
                    onChange={e => {
                      const [ano, mes] = e.target.value.split('-').map(Number);
                      setNewFichaData(prev => ({ ...prev, ano, mes }));
                    }}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-zinc-200 font-bold"
                  >
                    <option value="">Selecione o Mês Operacional...</option>
                    {periodOptions.map(opt => (
                      <option key={`${opt.ano}-${opt.mes}`} value={`${opt.ano}-${opt.mes}`}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Truck Plate Select / Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Caminhão / Placa</label>
                  <SearchableSelect 
                    name="placa"
                    value={newFichaData.placa}
                    onChange={val => setNewFichaData({ ...newFichaData, placa: val })}
                    options={[
                      ...equipamentos.map(eq => ({ value: eq.placa, label: eq.placa })),
                      { value: 'custom', label: 'Outra Placa (Digitar)...' }
                    ]}
                    placeholder="Selecione a Placa..."
                  />

                  {newFichaData.placa === 'custom' && (
                    <input 
                      type="text"
                      required
                      value={newFichaData.placaCustom}
                      onChange={e => setNewFichaData({ ...newFichaData, placaCustom: e.target.value })}
                      placeholder="Digitar placa do caminhão..."
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none mt-2 text-zinc-900 dark:text-white font-mono uppercase"
                    />
                  )}
                </div>

                {/* Driver Select / Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Motorista</label>
                  <SearchableSelect 
                    name="motorista"
                    value={newFichaData.motorista}
                    onChange={val => setNewFichaData({ ...newFichaData, motorista: val })}
                    options={[
                      ...colaboradores.map(c => ({ value: c.nome, label: c.nome })),
                      { value: 'custom', label: 'Outro Motorista (Digitar)...' }
                    ]}
                    placeholder="Selecione o Motorista..."
                  />

                  {newFichaData.motorista === 'custom' && (
                    <input 
                      type="text"
                      required
                      value={newFichaData.motoristaCustom}
                      onChange={e => setNewFichaData({ ...newFichaData, motoristaCustom: e.target.value })}
                      placeholder="Nome completo do motorista..."
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none mt-2 text-zinc-900 dark:text-white"
                    />
                  )}
                </div>

                {/* Process select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Processo</label>
                  <select
                    value={newFichaData.processo}
                    onChange={e => setNewFichaData({ ...newFichaData, processo: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-zinc-200 font-bold"
                  >
                    <option value="Colheita">Colheita</option>
                    <option value="Silvicultura">Silvicultura</option>
                    <option value="Logística">Logística</option>
                  </select>
                </div>

                {/* Supervisor Suzano */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Supervisor Suzano</label>
                  <input 
                    type="text"
                    value={newFichaData.supervisor_suzano}
                    onChange={e => setNewFichaData({ ...newFichaData, supervisor_suzano: e.target.value })}
                    placeholder="Nome do supervisor Suzano..."
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white font-semibold"
                  />
                </div>

                {/* Document details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-555 dark:text-zinc-500 uppercase tracking-wider">Código Doc.</label>
                    <input 
                      type="text"
                      value={newFichaData.codigo}
                      onChange={e => setNewFichaData({ ...newFichaData, codigo: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-500 dark:text-zinc-400 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-555 dark:text-zinc-500 uppercase tracking-wider">Revisão Doc.</label>
                    <input 
                      type="text"
                      value={newFichaData.revisao}
                      onChange={e => setNewFichaData({ ...newFichaData, revisao: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-500 dark:text-zinc-400 font-mono"
                    />
                  </div>
                </div>

              </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800 mt-4">
              <button type="button" disabled={isSavingFicha} onClick={() => setIsFichaModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-zinc-400 active:text-white transition-colors disabled:opacity-50">
                CANCELAR
              </button>
              <button
                type="submit"
                disabled={isSavingFicha}
                className="px-6 py-2.5 bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSavingFicha ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    SALVANDO...
                  </>
                ) : (
                  'CRIAR FICHA'
                )}
              </button>
            </div>
        </form>
      </BottomSheet>

      {/* ─── MODAL: ADICIONAR OU EDITAR LANÇAMENTO (LINHA) ─── */}
      <BottomSheet
        open={isLancamentoModalOpen && !!selectedFicha}
        onClose={() => { setIsLancamentoModalOpen(false); setEditingLancamentoId(null); }}
        title={editingLancamentoId ? 'Editar Lançamento' : 'Adicionar Lançamento'}
        fullHeight
      >
        {selectedFicha && (
        <form onSubmit={handleAddLancamento} className="flex flex-col h-full">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3">
            Caminhão: {selectedFicha.placa} | Operação: {getMonthName(selectedFicha.mes)} {selectedFicha.ano}
            {(() => {
              const period = Array.isArray(calendario) ? calendario.find(p => p && p.mes === selectedFicha.mes && p.ano === selectedFicha.ano) : null;
              if (!period) return null;
              return ` (${safeFormatDate(period.data_inicio, 'dd/MM/yyyy')} a ${safeFormatDate(period.data_fim, 'dd/MM/yyyy')})`;
            })()}
          </p>

          <div className="flex-1 space-y-4 grid grid-cols-2 gap-x-4">

                {/* Data */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Data do Lançamento</label>
                  <input 
                    type="date"
                    required
                    value={newLancamentoData.data}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, data: e.target.value })}
                    min={(() => {
                      const period = Array.isArray(calendario) ? calendario.find(p => p && p.mes === selectedFicha.mes && p.ano === selectedFicha.ano) : null;
                      return period?.data_inicio || undefined;
                    })()}
                    max={(() => {
                      const period = Array.isArray(calendario) ? calendario.find(p => p && p.mes === selectedFicha.mes && p.ano === selectedFicha.ano) : null;
                      return period?.data_fim || undefined;
                    })()}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white font-mono"
                  />
                  {(() => {
                    const period = Array.isArray(calendario) ? calendario.find(p => p && p.mes === selectedFicha.mes && p.ano === selectedFicha.ano) : null;
                    if (!period) return null;
                    return (
                      <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
                        * Período operacional permitido: de <span className="font-bold text-blue-600 dark:text-blue-400">{safeFormatDate(period.data_inicio, 'dd/MM/yyyy')}</span> até <span className="font-bold text-blue-600 dark:text-blue-400">{safeFormatDate(period.data_fim, 'dd/MM/yyyy')}</span>
                      </p>
                    );
                  })()}
                </div>

                {/* ID Ponto */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">ID Ponto / Outorga*</label>
                  <input 
                    type="text"
                    required
                    value={newLancamentoData.id_ponto}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, id_ponto: e.target.value })}
                    placeholder="Código do ponto..."
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                {/* Volume Captado */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-555 dark:text-zinc-500 uppercase tracking-wider">Volume Captado (Litros)</label>
                  <input 
                    type="number"
                    required
                    value={newLancamentoData.volume_captado}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, volume_captado: e.target.value })}
                    placeholder="Ex: 10000"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white font-mono font-bold"
                  />
                </div>

                {/* Hora Inicial */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Hora Inicial (HH:MM)</label>
                  <input 
                    type="time"
                    required
                    value={newLancamentoData.hora_inicial}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, hora_inicial: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                {/* Hora Final */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Hora Final (HH:MM)</label>
                  <input 
                    type="time"
                    required
                    value={newLancamentoData.hora_final}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, data_final: undefined, hora_final: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                {/* Fazenda Captada */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Fazenda Captada</label>
                  <input 
                    type="text"
                    required
                    value={newLancamentoData.fazenda_captada}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, fazenda_captada: e.target.value })}
                    placeholder="Ex: Flores 74"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white"
                  />
                </div>

                {/* UP Captação */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">UP da Captação</label>
                  <input 
                    type="text"
                    required
                    value={newLancamentoData.up_captacao}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, up_captacao: e.target.value })}
                    placeholder="Ex: 15Bx17"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                {/* Atividade */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Atividade</label>
                  <input 
                    type="text"
                    required
                    value={newLancamentoData.atividade}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, atividade: e.target.value })}
                    placeholder="Ex: Lavagem"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white"
                  />
                </div>

                {/* Fazenda Atividade */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Fazenda da Atividade</label>
                  <input 
                    type="text"
                    required
                    value={newLancamentoData.fazenda_atividade}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, fazenda_atividade: e.target.value })}
                    placeholder="Ex: Flores 77"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white"
                  />
                </div>

                {/* UP Atividade */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">UP da Atividade</label>
                  <input 
                    type="text"
                    required
                    value={newLancamentoData.up_atividade}
                    onChange={e => setNewLancamentoData({ ...newLancamentoData, up_atividade: e.target.value })}
                    placeholder="Ex: 15Bx18"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                {/* Photo Upload Box */}
                <div className="col-span-2 pt-3 border-t border-zinc-200 dark:border-zinc-900 space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">📸 Foto do Ponto de Captação</label>
                  <UploadBox 
                    label="Tirar Foto do Ponto"
                    url={newLancamentoData.foto_ponto}
                    onCapture={() => {
                      if (typeof window !== "undefined" && (window as any).EunamanCamera) {
                        (window as any).EunamanCamera.openCamera();
                      } else {
                        setShowCamera(true);
                      }
                    }}
                    onFileSelect={(base64) => setNewLancamentoData({ ...newLancamentoData, foto_ponto: base64 })}
                    showCameraOption={true}
                  />
                </div>

              </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800 mt-4">
              <button type="button" onClick={() => { setIsLancamentoModalOpen(false); setEditingLancamentoId(null); }} className="px-5 py-2.5 text-xs font-bold text-zinc-400 active:text-white transition-colors">
                CANCELAR
              </button>
              <button type="submit" className="px-6 py-2.5 bg-emerald-600 active:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-lg active:scale-95 transition-all">
                {editingLancamentoId ? 'ATUALIZAR CAPTAÇÃO' : 'SALVAR CAPTAÇÃO'}
              </button>
            </div>
        </form>
        )}
      </BottomSheet>


      {/* ─── MODAL DE DETALHE FOTO EVIDÊNCIA ─── */}
      {activePhoto && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <button 
            onClick={() => setActivePhoto(null)} 
            className="absolute top-6 right-6 p-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full transition-colors z-10 border border-zinc-800"
          >
            <X size={20} />
          </button>
          <div className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center">
            <img src={activePhoto} className="max-w-full max-h-full object-contain rounded-2xl border border-zinc-850 shadow-2xl" alt="Ponto de Captação Evidência" />
          </div>
        </div>
      )}

      {/* Camera modal interface */}
      {showCamera && (
        <CameraModal 
          onCapture={(base64) => { setNewLancamentoData({ ...newLancamentoData, foto_ponto: base64 }); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* ─── MODAL DE ASSINATURA DIGITAL (SUPERVISOR SUZANO) ─── */}
      <BottomSheet open={showSignaturePad} onClose={() => { setShowSignaturePad(false); setIsDrawingSig(false); }} title="Assinatura do Supervisor">
        <div className="flex flex-col gap-4">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
            Assine com o dedo no quadro abaixo
          </p>

          <div className="relative border border-dashed border-zinc-700 bg-zinc-900 rounded-2xl overflow-hidden h-[180px] flex items-center justify-center">
            <canvas
              ref={sigCanvasRef}
              width={340}
              height={176}
              onMouseDown={startDrawingSig}
              onMouseMove={drawSig}
              onMouseUp={stopDrawingSig}
              onMouseLeave={stopDrawingSig}
              onTouchStart={startDrawingSig}
              onTouchMove={(e) => {
                if (e.cancelable) e.preventDefault();
                drawSig(e);
              }}
              onTouchEnd={stopDrawingSig}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowSignaturePad(false); setIsDrawingSig(false); }}
              className="px-4 py-2.5 text-xs font-bold rounded-xl text-zinc-400 active:text-white transition-colors"
              style={{ minHeight: "var(--tap-min)" }}
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={clearSigCanvas}
              className="px-4 py-2.5 text-xs font-bold rounded-xl border border-red-900 text-red-400 active:bg-red-950/30 transition-all uppercase"
              style={{ minHeight: "var(--tap-min)" }}
            >
              LIMPAR
            </button>
            <button
              type="button"
              onClick={handleSaveSignature}
              className="px-5 py-2.5 text-xs font-black rounded-xl bg-amber-600 active:bg-amber-700 text-white transition-all shadow-lg uppercase"
              style={{ minHeight: "var(--tap-min)" }}
            >
              CONFIRMAR
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ─── MAIS AÇÕES DA FICHA (era um stack vertical de ~9 botões no sidebar) ─── */}
      {selectedFicha && (
        <ActionSheet
          open={isFichaActionsOpen}
          onClose={() => setIsFichaActionsOpen(false)}
          title={`Ficha ${selectedFicha.placa}`}
          items={[
            {
              key: "ver",
              label: "Ver Ficha",
              icon: Eye,
              onSelect: () => {
                setConfirmAction({
                  title: "Ver ficha",
                  description: "Deseja realmente ver a ficha?",
                  onConfirm: () => { setIsFichaExpanded(true); setZoomScale(1.0); toast.show("Visualização da ficha aberta.", "success"); },
                });
              },
            },
            ...(profile?.role !== 'visitante' ? [
              selectedFicha.assinatura_supervisor
                ? { key: "assinatura", label: "Remover Assinatura", icon: PenLine, destructive: true, onSelect: () => {
                    setConfirmAction({ title: "Remover assinatura", description: "Deseja realmente remover a assinatura do supervisor?", destructive: true, onConfirm: handleRemoveSignature });
                  } } as ActionSheetItem
                : { key: "assinatura", label: "Assinar Supervisor", icon: PenLine, onSelect: () => {
                    setConfirmAction({ title: "Assinar como supervisor", description: "Deseja realmente assinar como supervisor?", onConfirm: () => {
                      setShowSignaturePad(true);
                      setTimeout(() => {
                        const canvas = sigCanvasRef.current;
                        if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
                      }, 50);
                    } });
                  } } as ActionSheetItem,
            ] : []),
            ...(!isFichaLocked(selectedFicha) && profile?.role !== 'visitante' ? [{
              key: "fechar", label: "Fechar Mês", icon: Lock, onSelect: () => {
                setConfirmAction({ title: "Fechar mês", description: "Deseja realmente fechar o mês?", onConfirm: () => handleCloseFicha(selectedFicha.id) });
              },
            } as ActionSheetItem] : []),
            ...(isFichaLocked(selectedFicha) && ['admin', 'pcm', 'gestao'].includes(profile?.role || '') ? [{
              key: "reabrir", label: "Reabrir Ficha", icon: Unlock, onSelect: () => {
                setConfirmAction({ title: "Reabrir ficha", description: "Reabrir esta ficha para lançar um registro que ficou faltando?", onConfirm: () => handleReabrirFicha(selectedFicha.id) });
              },
            } as ActionSheetItem] : []),
            {
              key: "pdf", label: "Baixar PDF", icon: Download, onSelect: () => {
                setConfirmAction({ title: "Baixar PDF", description: "Deseja realmente baixar o PDF?", onConfirm: () => handleExportPDF("download") });
              },
            },
            { key: "pdf-share", label: "Compartilhar PDF", icon: FileText, onSelect: () => handleExportPDF("share") },
            {
              key: "excel", label: "Baixar Excel", icon: FileSpreadsheet, onSelect: () => {
                setConfirmAction({ title: "Baixar Excel", description: "Deseja realmente baixar o Excel?", onConfirm: handleExportExcel });
              },
            },
            {
              key: "imprimir", label: "Imprimir Ficha", icon: Printer, onSelect: () => {
                setConfirmAction({ title: "Imprimir ficha", description: "Deseja realmente imprimir a ficha?", onConfirm: () => { window.print(); toast.show("Impressão iniciada.", "success"); } });
              },
            },
            ...(['admin', 'pcm', 'gestao'].includes(profile?.role || '') ? [{
              key: "excluir", label: "Excluir Ficha", icon: Trash2, destructive: true, onSelect: () => {
                setConfirmAction({ title: "Excluir ficha", description: "Essa ação não pode ser desfeita.", destructive: true, confirmLabel: "Excluir", onConfirm: () => handleDeleteFicha(selectedFicha.id) });
              },
            } as ActionSheetItem] : []),
          ]}
        />
      )}

      {/* ─── AÇÕES DO LANÇAMENTO (editar / excluir) ─── */}
      {selectedFicha && (() => {
        const row = selectedFicha.lancamentos?.find((l: any) => l.id === actionLancamentoId);
        return (
          <ActionSheet
            open={!!row}
            onClose={() => setActionLancamentoId(null)}
            title="Lançamento"
            items={row ? [
              {
                key: "editar", label: "Editar", icon: Pencil, onSelect: () => {
                  setEditingLancamentoId(row.id);
                  setNewLancamentoData({
                    data: row.data,
                    id_ponto: row.id_ponto,
                    hora_inicial: row.hora_inicial,
                    hora_final: row.hora_final,
                    volume_captado: String(row.volume_captado),
                    fazenda_captada: row.fazenda_captada,
                    up_captacao: row.up_captacao,
                    atividade: row.atividade,
                    fazenda_atividade: row.fazenda_atividade,
                    up_atividade: row.up_atividade,
                    foto_ponto: row.foto_ponto,
                  });
                  setIsLancamentoModalOpen(true);
                },
              },
              {
                key: "excluir", label: "Excluir", icon: Trash2, destructive: true, onSelect: () => {
                  setConfirmAction({
                    title: "Excluir lançamento",
                    description: "Excluir registro permanentemente?",
                    destructive: true,
                    confirmLabel: "Excluir",
                    onConfirm: () => { handleDeleteLancamento(row.id); window.location.reload(); },
                  });
                },
              },
            ] : []}
          />
        );
      })()}

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
        title={confirmAction?.title || ""}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel}
        destructive={confirmAction?.destructive}
      />

      {/* ─── FULLSCREEN EXPANDED FICHA VIEW ─── */}
      {isFichaExpanded && selectedFicha && mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-zinc-950 flex flex-col animate-in fade-in duration-200 select-none print:hidden">
          {/* Header of fullscreen view */}
          <header className="p-3 border-b border-zinc-200 dark:border-zinc-855 flex flex-col sm:flex-row gap-2 items-center justify-between bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-600 rounded-lg text-white"><Droplets size={14} /></span>
              <h3 className="font-extrabold text-zinc-900 dark:text-white text-xs uppercase tracking-wide">
                Ficha: {selectedFicha.placa} ({getMonthName(selectedFicha.mes)} {selectedFicha.ano})
              </h3>
            </div>
            
            {/* Zoom controls & Close */}
            <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
              <div className="flex items-center bg-zinc-105 dark:bg-zinc-955 rounded-xl p-0.5 border border-zinc-200 dark:border-zinc-800">
                <button 
                  onClick={() => setZoomScale(z => Math.max(0.3, Number((z - 0.1).toFixed(1))))} 
                  className="px-2.5 py-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded-lg text-xs font-black text-zinc-550 dark:text-zinc-450 hover:text-zinc-800 dark:hover:text-white transition-colors"
                  title="Diminuir Zoom"
                >
                  A-
                </button>
                <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-400 font-bold px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850/30 rounded-md">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button 
                  onClick={() => setZoomScale(z => Math.min(2.0, Number((z + 0.1).toFixed(1))))} 
                  className="px-2.5 py-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded-lg text-xs font-black text-zinc-550 dark:text-zinc-450 hover:text-zinc-800 dark:hover:text-white transition-colors"
                  title="Aumentar Zoom"
                >
                  A+
                </button>
              </div>

              <button 
                onClick={() => setZoomScale(0.35)} 
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-black text-zinc-650 dark:text-zinc-455 hover:text-zinc-800 dark:hover:text-white transition-colors"
                title="Ajustar ao Celular"
              >
                Ajustar
              </button>

              <button 
                onClick={() => setZoomScale(1.0)} 
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-black text-zinc-650 dark:text-zinc-455 hover:text-zinc-800 dark:hover:text-white transition-colors mr-2"
                title="Resetar Zoom"
              >
                100%
              </button>
              
              <button 
                onClick={() => setIsFichaExpanded(false)} 
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-95"
              >
                <X size={12} />
                <span>FECHAR</span>
              </button>
            </div>
          </header>
          
          {/* Body of fullscreen view with zoom and scroll support */}
          <div className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-start bg-zinc-100 dark:bg-zinc-955 custom-scrollbar touch-pan-x touch-pan-y">
            <div 
              className="origin-top-left"
              style={{ 
                transform: `scale(${zoomScale})`, 
                width: `${1080 * zoomScale}px`, 
                height: `auto`,
                transformOrigin: 'top left'
              }}
            >
              <div className="w-[1080px] shrink-0 bg-white p-4 rounded-xl shadow-2xl text-zinc-955">
                {renderPaperFicha(selectedFicha, setActivePhoto, calendario)}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
