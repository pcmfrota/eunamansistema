"use client";

import React, { useState, useRef, useEffect } from 'react';
import Script from 'next/script';
import { 
  Download,
  Upload,
  Plus, 
  Search, 
  Pencil,
  Trash2,
  X,
  Truck
} from 'lucide-react';
import { cn } from "@/lib/utils";

const initialVehicles = [
  { placa: "TCC4D15", tipo: "COMBOIO", tipoColor: "blue", categoria: "PESADA", modulo: "ALUGADO", horimetro: "799h", ultimaAtualizacao: "2026-03-26" },
  { placa: "PTT8D76", tipo: "MUNCK", tipoColor: "amber", categoria: "PESADA", modulo: "CARREGAMENTO", horimetro: "-", ultimaAtualizacao: "2026-02-09" },
  { placa: "PTV4G53", tipo: "MULTIFUNCIONAL", tipoColor: "pink", categoria: "PESADA", modulo: "CARREGAMENTO", horimetro: "-", ultimaAtualizacao: "2025-12-11" },
  { placa: "SGJ7H05", tipo: "MUNCK", tipoColor: "amber", categoria: "PESADA", modulo: "SILVICULTURA", horimetro: "-", ultimaAtualizacao: "2025-12-11" },
  { placa: "TCC2E83", tipo: "PIPA", tipoColor: "purple", categoria: "PESADA", modulo: "5", horimetro: "-", ultimaAtualizacao: "2025-12-11" },
  { placa: "TCN7J82", tipo: "COMBOIO", tipoColor: "blue", categoria: "PESADA", modulo: "CARREGAMENTO", horimetro: "-", ultimaAtualizacao: "2025-12-11" },
];

const colorMap: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
};

export default function BaseFrotasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>(initialVehicles);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar dados salvos no navegador (se houver) quando a página montar
  useEffect(() => {
    const saved = localStorage.getItem('@eunaman:frotas');
    if (saved) {
      try {
        setVehicles(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar dados salvos:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Salvar sempre que vehicles mudar
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('@eunaman:frotas', JSON.stringify(vehicles));
    }
  }, [vehicles, isLoaded]);

  // Selecionar todos/nenhum
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedVehicles(vehicles.map(v => v.placa));
    } else {
      setSelectedVehicles([]);
    }
  };

  const handleSelectVehicle = (placa: string) => {
    if (selectedVehicles.includes(placa)) {
      setSelectedVehicles(selectedVehicles.filter(p => p !== placa));
    } else {
      setSelectedVehicles([...selectedVehicles, placa]);
    }
  };

  const handleDelete = (placa: string) => {
    if (confirm(`Tem certeza que deseja excluir o veículo ${placa}?`)) {
      setVehicles(vehicles.filter(v => v.placa !== placa));
      setSelectedVehicles(selectedVehicles.filter(p => p !== placa));
    }
  };

  const handleBatchDelete = () => {
    if (confirm(`Tem certeza que deseja excluir os ${selectedVehicles.length} veículos selecionados?`)) {
      setVehicles(vehicles.filter(v => !selectedVehicles.includes(v.placa)));
      setSelectedVehicles([]);
    }
  };

  const handleEdit = (vehicle: any) => {
    setEditingVehicle(vehicle);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const exportToJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vehicles, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "base_frotas.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportToExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("A biblioteca do Excel ainda está carregando. Tente novamente em alguns instantes.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(vehicles);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Frotas");
    XLSX.writeFile(workbook, "base_frotas.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("A biblioteca do Excel ainda está carregando. Tente novamente em alguns instantes.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        const newImportedVehicles: any[] = [];
        
        for (const obj of json) {
          // Normalize keys assuming users might have "placa", "Placa", etc.
          const normalizedObj: any = {};
          for (const key in obj) {
            normalizedObj[key.trim().toLowerCase()] = obj[key] !== undefined && obj[key] !== null ? String(obj[key]).trim() : "-";
          }
          
          if (!normalizedObj.placa) continue;

          const tipo = normalizedObj.tipo || "-";
          let tipoColor = "slate";
          if (tipo.toUpperCase() === "COMBOIO") tipoColor = "blue";
          if (tipo.toUpperCase() === "MUNCK") tipoColor = "amber";
          if (tipo.toUpperCase() === "MULTIFUNCIONAL") tipoColor = "pink";
          if (tipo.toUpperCase() === "PIPA") tipoColor = "purple";
          
          newImportedVehicles.push({
            placa: normalizedObj.placa.toUpperCase(),
            tipo: tipo.toUpperCase(),
            tipoColor,
            categoria: normalizedObj.categoria ? normalizedObj.categoria.toUpperCase() : "-",
            modulo: normalizedObj.modulo || "-",
            horimetro: normalizedObj.horimetro || "-",
            ultimaAtualizacao: normalizedObj.ultimaatualizacao || new Date(Date.now() - 3 * 3600 * 1000).toISOString().split('T')[0]
          });
        }
        
        if (newImportedVehicles.length > 0) {
          setVehicles(prev => [...newImportedVehicles, ...prev]);
          alert(`${newImportedVehicles.length} veículos importados com sucesso a partir do Excel!`);
        } else {
          alert("Nenhum veículo válido encontrado na planilha. Verifique se a coluna 'placa' ou 'Placa' existe.");
        }
      } catch (err) {
        console.error("Erro ao importar Excel", err);
        alert("Erro ao processar o arquivo Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateVehicle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Assign correct color tag based on type
    const tipo = formData.get("tipo") as string;
    let tipoColor = "slate";
    if (tipo === "COMBOIO") tipoColor = "blue";
    if (tipo === "MUNCK") tipoColor = "amber";
    if (tipo === "MULTIFUNCIONAL") tipoColor = "pink";
    if (tipo === "PIPA") tipoColor = "purple";

    const newVehicle = {
      placa: formData.get("placa") as string || "-",
      tipo: tipo || "-",
      tipoColor,
      categoria: formData.get("categoria") as string || "-",
      modulo: formData.get("modulo") as string || "-",
      horimetro: formData.get("horimetro") as string || "-",
      ultimaAtualizacao: formData.get("ultimaAtualizacao") as string || new Date(Date.now() - 3 * 3600 * 1000).toISOString().split('T')[0],
    };

    if (editingVehicle) {
      setVehicles(vehicles.map(v => v.placa === editingVehicle.placa ? newVehicle : v));
    } else {
      setVehicles([newVehicle, ...vehicles]);
    }
    closeModal();
  };

  return (
    <div className="p-5 md:p-8 flex flex-col gap-6 bg-[#f8fafc] dark:bg-[#0f1115] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-xl">
            <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1e293b] dark:text-zinc-100">Base de Frotas</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Cadastro completo dos veículos e equipamentos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
          <input 
            type="file" 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
            className="hidden" 
          />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-sm">
            <Upload size={16} /> Importar Excel/CSV
          </button>
          <button onClick={exportToJSON} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shadow-sm">
            <Download size={16} /> JSON
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
            <Download size={16} /> Excel (.xlsx)
          </button>
          <button 
            onClick={() => { setEditingVehicle(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Novo Veículo
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col w-full">
        {/* Top bar with count and search */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Veículos Cadastrados ({vehicles.length})</h2>
            
            {selectedVehicles.length > 0 && (
              <button 
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                title={`Excluir ${selectedVehicles.length} selecionados`}
              >
                <Trash2 size={14} /> Excluir Selecionados ({selectedVehicles.length})
              </button>
            )}
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar por placa, tipo ou módulo..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[13px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 border-b border-slate-100 dark:bg-slate-900/50 dark:border-slate-700/50">
              <tr>
                <th className="py-4 px-6 w-12">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={vehicles.length > 0 && selectedVehicles.length === vehicles.length}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                  />
                </th>
                <th className="py-4 px-6 font-semibold">Placa</th>
                <th className="py-4 px-6 font-semibold">Tipo</th>
                <th className="py-4 px-6 font-semibold">Categoria</th>
                <th className="py-4 px-6 font-semibold">Módulo</th>
                <th className="py-4 px-6 font-semibold">Horímetro Atual</th>
                <th className="py-4 px-6 font-semibold">Última Atualização</th>
                <th className="py-4 px-6 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle, idx) => (
                <tr key={idx} className={cn(
                  "border-b last:border-0 border-slate-100 dark:border-slate-700/50 transition-colors",
                  selectedVehicles.includes(vehicle.placa) ? "bg-blue-50/50 dark:bg-blue-500/5" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                )}>
                  <td className="py-3.5 px-6">
                    <input 
                      type="checkbox" 
                      onChange={() => handleSelectVehicle(vehicle.placa)}
                      checked={selectedVehicles.includes(vehicle.placa)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                    />
                  </td>
                  <td className="py-3.5 px-6 font-medium text-slate-900 dark:text-white">{vehicle.placa}</td>
                  <td className="py-3.5 px-6">
                    <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-md uppercase tracking-wide", colorMap[vehicle.tipoColor] || colorMap.slate)}>
                      {vehicle.tipo}
                    </span>
                  </td>
                  <td className="py-3.5 px-6">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      {vehicle.categoria}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">{vehicle.modulo}</td>
                  <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">{vehicle.horimetro}</td>
                  <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">{vehicle.ultimaAtualizacao}</td>
                  <td className="py-3.5 px-6">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(vehicle)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors" 
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(vehicle.placa)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" 
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Veículo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingVehicle ? "Editar Veículo" : "Novo Veículo"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {editingVehicle ? "Atualize os dados do veículo abaixo" : "Preencha as informações para cadastrar um novo veículo no sistema."}
                </p>
              </div>
              <button 
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Container */}
            <form onSubmit={handleCreateVehicle} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto w-full flex-1">
                <div className="flex flex-col gap-6">
                
                {/* Informações Básicas Section */}
                <div className="bg-[#f0f5ff] dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Informações Básicas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Placa <span className="text-red-500">*</span></label>
                      <input name="placa" required defaultValue={editingVehicle?.placa} type="text" placeholder="ABC1234" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tipo <span className="text-red-500">*</span></label>
                      <select name="tipo" required defaultValue={editingVehicle?.tipo || ""} className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white">
                        <option value="">Selecione</option>
                        <option value="COMBOIO">COMBOIO</option>
                        <option value="MUNCK">MUNCK</option>
                        <option value="MULTIFUNCIONAL">MULTIFUNCIONAL</option>
                        <option value="PIPA">PIPA</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Categoria <span className="text-red-500">*</span></label>
                      <select name="categoria" required defaultValue={editingVehicle?.categoria || ""} className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white">
                        <option value="">Selecione</option>
                        <option value="PESADA">PESADA</option>
                        <option value="LEVE">LEVE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Módulo <span className="text-red-500">*</span></label>
                      <input name="modulo" required defaultValue={editingVehicle?.modulo} type="text" placeholder="BASE" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                    </div>
                  </div>
                </div>

                {/* Horímetro Section */}
                <div className="bg-[#ecfdf5] dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Horímetro</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Horímetro Atual</label>
                      <input name="horimetro" defaultValue={editingVehicle?.horimetro} type="text" placeholder="103276" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data da Última Atualização</label>
                      <input name="ultimaAtualizacao" defaultValue={editingVehicle?.ultimaAtualizacao} type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all dark:text-white" />
                    </div>
                  </div>
                </div>

                {/* Documentação Section */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Documentação do Veículo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Laudo Eletromecânico */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800/50">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Laudo Eletromecânico</h4>
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Número do Documento</label>
                          <input type="text" placeholder="Nº do documento" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Expedição</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Validade</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CRLV */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800/50">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">CRLV</h4>
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Número do Documento</label>
                          <input type="text" placeholder="Nº do documento" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Expedição</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Validade</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Implemento */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800/50">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Implemento</h4>
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Número do Documento</label>
                          <input type="text" placeholder="Nº do documento" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Expedição</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Validade</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tacógrafo */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800/50">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Tacógrafo</h4>
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Número do Documento</label>
                          <input type="text" placeholder="Nº do documento" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Expedição</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Validade</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CIV/CIPP */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800/50">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">CIV/CIPP</h4>
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Número do Documento</label>
                          <input type="text" placeholder="Nº do documento" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Expedição</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data de Validade</label>
                            <input type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
              </div>
              
              {/* Footer */}
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-xl shrink-0">
                <button 
                  type="button"
                  onClick={closeModal} 
                  className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm">
                  {editingVehicle ? "Salvar Alterações" : "Cadastrar"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
      {/* External Scripts */}
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />
    </div>
  );
}
