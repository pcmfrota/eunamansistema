"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Trash2,
  X,
  Mail,
  Key,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Settings2,
  ChevronRight,
  ChevronDown,
  Layout,
  Building2,
  Plus,
} from "lucide-react";
import {
  updateUserRole,
  createNewUser,
  deleteUser,
  updateRolePermissions,
  updateUserFilial,
  createFilial,
  adminSetUserPassword,
  aprovarUsuario,
  rejeitarUsuario,
} from "./actions";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { cn } from "@/lib/utils";

type Filial = { id: string; nome: string; ativo: boolean };

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  filial_id: string;
  updated_at: string;
  email?: string | null;
  status?: string | null;
  cargo_solicitado?: string | null;
};

const CARGO_LABEL: Record<string, string> = {
  admin: "Administrador",
  pcm: "PCM",
  gestao: "Gestão",
  mecanico: "Mecânico",
  motorista: "Motorista",
  afiador: "Afiador",
  visitante: "Visitante",
};

type RolePermission = {
  role: string;
  allowed_tabs: string[];
};

export default function UsuariosClient({ 
  initialProfiles,
  initialPermissions,
  initialFiliais,
}: { 
  initialProfiles: Profile[],
  initialPermissions: RolePermission[],
  initialFiliais: Filial[],
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions);
  const [filiais, setFiliais] = useState<Filial[]>(initialFiliais);
  const { isOnline } = useOffline();

  // page.tsx agora sincroniza dado local/offline em segundo plano e repassa versões
  // atualizadas dessas props — sem isso, essa atualização nunca chegaria aqui.
  useEffect(() => { setProfiles(initialProfiles); }, [initialProfiles]);
  useEffect(() => { setPermissions(initialPermissions); }, [initialPermissions]);
  useEffect(() => { setFiliais(initialFiliais); }, [initialFiliais]);
  const [editingPermissions, setEditingPermissions] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showNovaFilial, setShowNovaFilial] = useState(false);
  const [novaFilialNome, setNovaFilialNome] = useState("");
  const [filialError, setFilialError] = useState<string | null>(null);
  const [filialLoading, setFilialLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isVisitante } = useAuth();

  const [passwordModalUser, setPasswordModalUser] = useState<Profile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const closePasswordModal = () => {
    setPasswordModalUser(null);
    setNewPasswordInput("");
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const handleSetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (!isOnline) {
      setPasswordError("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    setPasswordError(null);
    setPasswordLoading(true);

    const result = await adminSetUserPassword(passwordModalUser.id, newPasswordInput);

    if ('error' in result) {
      setPasswordError(result.error || "Erro ao alterar senha.");
      setPasswordLoading(false);
    } else {
      setPasswordSuccess(true);
      setPasswordLoading(false);
    }
  };

  // Autocadastros aguardando aprovação ficam fora da lista principal (que é sobre contas já
  // liberadas) e aparecem no cartão de Aprovações Pendentes, em destaque no topo da página.
  const pendentes = profiles.filter(p => p.status === "pendente");
  const filteredProfiles = profiles
    .filter(p => p.status !== "pendente")
    .filter(p =>
      p.full_name?.toLowerCase().includes(busca.toLowerCase()) ||
      p.role.toLowerCase().includes(busca.toLowerCase())
    );

  const [cargoAprovacao, setCargoAprovacao] = useState<Record<string, string>>({});
  const [aprovandoId, setAprovandoId] = useState<string | null>(null);

  const handleAprovar = async (p: Profile) => {
    if (isVisitante) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    const role = cargoAprovacao[p.id] || p.cargo_solicitado || "visitante";
    setAprovandoId(p.id);
    const result = await aprovarUsuario(p.id, role);
    setAprovandoId(null);
    if ("error" in result && result.error) {
      alert(result.error);
    } else {
      setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, role, status: "aprovado" } : x));
    }
  };

  const handleRejeitar = async (p: Profile) => {
    if (isVisitante) return;
    if (!confirm(`Rejeitar o cadastro de ${p.full_name || p.email}? A pessoa não conseguirá entrar no sistema.`)) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    setAprovandoId(p.id);
    const result = await rejeitarUsuario(p.id);
    setAprovandoId(null);
    if ("error" in result && result.error) {
      alert(result.error);
    } else {
      setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, status: "rejeitado" } : x));
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (isVisitante) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole);
      if ('error' in result) {
        alert(result.error);
      } else {
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
      }
    });
  };

  const handleFilialChange = async (userId: string, newFilial: string) => {
    if (isVisitante) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    startTransition(async () => {
      const result = await updateUserFilial(userId, newFilial);
      if ('error' in result) {
        alert(result.error);
      } else {
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, filial_id: newFilial } : p));
      }
    });
  };

  const handleDelete = async (userId: string) => {
    if (isVisitante) return;
    if (!confirm("Tem certeza que deseja excluir permanentemente este usuário?")) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }

    startTransition(async () => {
      const result = await deleteUser(userId);
      if ('error' in result) {
        alert(result.error);
      } else {
        setProfiles(prev => prev.filter(p => p.id !== userId));
      }
    });
  };

  const handleCreateFilial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isOnline) {
      setFilialError("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    setFilialLoading(true);
    setFilialError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createFilial(formData);

    if ('error' in result) {
      setFilialError(result.error);
      setFilialLoading(false);
    } else {
      setFiliais(prev => [...prev, { id: result.id!, nome: result.nome!, ativo: true }]);
      setNovaFilialNome("");
      setShowNovaFilial(false);
      setFilialLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isOnline) {
      setError("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createNewUser(formData);

    if ('error' in result) {
      setError(result.error);
      setLoading(false);
    } else {
      setShowModal(false);
      window.location.reload(); // Recarrega para pegar a nova lista
    }
  };

  const handleUpdatePermissions = async (role: string, tabs: string[]) => {
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }
    startTransition(async () => {
      const result = await updateRolePermissions(role, tabs);
      if ('error' in result) {
        alert(result.error);
      } else {
        setPermissions(prev => prev.map(p => p.role === role ? { ...p, allowed_tabs: tabs } : p));
      }
    });
  };

  const toggleTab = (role: string, path: string) => {
    const rolePerm = permissions.find(p => p.role === role);
    const currentTabs = rolePerm?.allowed_tabs || [];
    const newTabs = currentTabs.includes(path)
      ? currentTabs.filter(t => t !== path)
      : [...currentTabs, path];
    
    handleUpdatePermissions(role, newTabs);
  };

  const availableTabs = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Ficha Mão de Obra', path: '/mao-de-obra' },
    { name: 'Controle de OS', path: '/os' },
    { name: 'Controle de Horímetros', path: '/preventivas' },
    { name: 'Checklist Mecânicos', path: '/checklist-mecanicos' },
    { name: 'Boletim de Pneus', path: '/pneus' },
    { name: 'Afiação', path: '/afiacao' },
    { name: 'Backlog', path: '/backlog' },
    { name: 'Prog. Preventiva', path: '/programacao-preventiva' },
    { name: 'Base de Frotas', path: '/base-frotas' },
    { name: 'Base de Dados', path: '/base-dados' },
    { name: 'Calendário Suzano', path: '/calendario' },
    { name: 'Controle de Lavagens', path: '/lavagens' },
    { name: 'Captação de Água', path: '/captacao' },
    { name: 'Documentos da Frota', path: '/documentos' },
    { name: 'Gestão de Usuários', path: '/admin/usuarios' },
  ];

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="text-blue-600" /> Gestão de Usuários
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Controle de acesso e cargos da equipe Eunaman</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isVisitante && (
            <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-xs font-bold border border-zinc-200 dark:border-zinc-700">
              SOMENTE LEITURA
            </div>
          )}
          {!isVisitante && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm active:scale-95"
            >
              <UserPlus size={18} /> Novo Usuário
            </button>
          )}
        </div>
      </div>

      {/* Aprovações Pendentes — autocadastros aguardando um admin aprovar */}
      {pendentes.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-amber-200/70 dark:border-amber-900/40">
            <h2 className="text-lg font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <UserPlus size={20} /> Aprovações Pendentes ({pendentes.length})
            </h2>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              Cadastros feitos pelos próprios usuários — eles só conseguem entrar depois de aprovados aqui.
            </p>
          </div>
          <div className="divide-y divide-amber-200/60 dark:divide-amber-900/30">
            {pendentes.map(p => (
              <div key={p.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{p.full_name || "Sem nome"}</p>
                  <p className="text-xs text-zinc-500">{p.email}</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
                    Cargo pedido: {CARGO_LABEL[p.cargo_solicitado || ""] || p.cargo_solicitado || "—"}
                  </p>
                </div>
                {!isVisitante && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={cargoAprovacao[p.id] ?? p.cargo_solicitado ?? "visitante"}
                      onChange={e => setCargoAprovacao(prev => ({ ...prev, [p.id]: e.target.value }))}
                      disabled={aprovandoId === p.id}
                      className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs font-medium bg-white dark:bg-zinc-900 cursor-pointer"
                    >
                      {Object.entries(CARGO_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAprovar(p)}
                      disabled={aprovandoId === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-60 transition-all"
                    >
                      <CheckCircle2 size={14} /> Aprovar
                    </button>
                    <button
                      onClick={() => handleRejeitar(p)}
                      disabled={aprovandoId === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 text-red-600 border border-red-200 dark:border-red-900/50 rounded-lg text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60 transition-all"
                    >
                      <X size={14} /> Rejeitar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filiais Section */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Building2 className="text-blue-600" /> Gestão de Filiais
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Cadastre e visualize as filiais do sistema</p>
          </div>
          {!isVisitante && (
            <button
              onClick={() => setShowNovaFilial(!showNovaFilial)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              {showNovaFilial ? <X size={14} /> : <Plus size={14} />} 
              {showNovaFilial ? 'Cancelar' : 'Nova Filial'}
            </button>
          )}
        </div>

        {showNovaFilial && !isVisitante && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
            <form onSubmit={handleCreateFilial} className="flex gap-3 items-end max-w-md">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Nome da Filial</label>
                <input
                  type="text"
                  name="nome"
                  required
                  placeholder="Ex: Filial Nova Era"
                  value={novaFilialNome}
                  onChange={e => setNovaFilialNome(e.target.value)}
                  disabled={filialLoading}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={filialLoading || !novaFilialNome.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {filialLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </form>
            {filialError && <p className="text-red-500 text-xs mt-2 flex items-center gap-1"><AlertCircle size={14} /> {filialError}</p>}
          </div>
        )}

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filiais.map(f => (
            <div key={f.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate" title={f.nome}>{f.nome}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider truncate" title={f.id}>{f.id}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Permissions Section */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Shield className="text-blue-600" /> Configuração de Acesso por Cargo
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Defina quais abas do sistema cada cargo pode visualizar</p>
          </div>
        </div>
        
        <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {['admin', 'pcm', 'gestao', 'mecanico', 'motorista', 'afiador', 'visitante'].map(role => {
            const rolePerm = permissions.find(p => p.role === role);
            const isEditing = editingPermissions === role;
            
            return (
              <div key={role} className="p-4">
                <button 
                  onClick={() => setEditingPermissions(isEditing ? null : role)}
                  className="w-full flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 p-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      role === 'admin' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" :
                      role === 'pcm' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" :
                      role === 'gestao' ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                      role === 'mecanico' ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30" :
                      role === 'motorista' ? "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30" :
                      role === 'afiador' ? "bg-sky-100 text-sky-600 dark:bg-sky-900/30" :
                      "bg-zinc-100 text-zinc-600 dark:bg-zinc-900/30"
                    )}>
                      <Layout size={18} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm capitalize text-zinc-900 dark:text-zinc-100">{role}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        {rolePerm?.allowed_tabs.length || 0} abas liberadas
                      </p>
                    </div>
                  </div>
                  {isEditing ? <ChevronDown size={18} className="text-zinc-400" /> : <ChevronRight size={18} className="text-zinc-400" />}
                </button>

                {isEditing && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 px-2 animate-in slide-in-from-top-2 duration-200">
                    {availableTabs.map(tab => {
                      const isAllowed = rolePerm?.allowed_tabs.includes(tab.path);
                      return (
                        <button
                          key={tab.path}
                          onClick={() => toggleTab(role, tab.path)}
                          disabled={isPending}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all",
                            isAllowed 
                              ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                              : "bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-500 grayscale opacity-60"
                          )}
                        >
                          <span>{tab.name}</span>
                          <div className={cn(
                            "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                            isAllowed ? "bg-blue-600 border-blue-600" : "border-zinc-300 dark:border-zinc-700"
                          )}>
                            {isAllowed && <CheckCircle2 size={10} className="text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Buscar usuários por nome ou cargo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Usuário</th>
                <th className="px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Cargo / Permissão</th>
                <th className="px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Filial</th>
                <th className="px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {filteredProfiles.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold overflow-hidden">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.full_name || ""} className="w-full h-full object-cover" />
                        ) : (
                          p.full_name?.charAt(0).toUpperCase() || <UserIcon size={20} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          {p.full_name || "Sem nome"}
                          {p.status === "rejeitado" && (
                            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-[9px] font-bold uppercase tracking-wider">
                              Rejeitado
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">{p.email || `${p.id.slice(0, 8)}...`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className={p.role === 'admin' ? 'text-blue-500' : 'text-zinc-400'} />
                      <select
                        value={p.role}
                        onChange={(e) => handleRoleChange(p.id, e.target.value)}
                        disabled={isPending || isVisitante}
                        className={cn(
                          "bg-transparent border-none p-0 pr-6 text-sm font-medium focus:ring-0 text-zinc-700 dark:text-zinc-300",
                          isVisitante ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                        )}
                      >
                        <option value="admin">Administrador</option>
                        <option value="pcm">PCM</option>
                        <option value="gestao">Gestão</option>
                        <option value="mecanico">Mecânico</option>
                        <option value="motorista">Motorista</option>
                        <option value="afiador">Afiador</option>
                        <option value="visitante">Visitante</option>
                      </select>
                    </div>
                  </td>
                  {/* Coluna Filial */}
                  <td className="px-6 py-4">
                    <select
                      value={p.filial_id || 'MATRIZ'}
                      onChange={(e) => handleFilialChange(p.id, e.target.value)}
                      disabled={isPending || isVisitante}
                      className={cn(
                        "bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-medium focus:ring-0",
                        isVisitante ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                      )}
                    >
                      {filiais.map(f => (
                        <option key={f.id} value={f.id}>{f.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!isVisitante && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPasswordModalUser(p)}
                          disabled={isPending}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                          title="Alterar senha"
                        >
                          <Key size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={isPending}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          title="Excluir usuário"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Usuário */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-lg shadow-2xl scale-in-center overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <UserPlus className="text-blue-600" /> Cadastrar Novo Usuário
              </h2>
              <button
                onClick={() => { setShowModal(false); setError(null); }}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input name="full_name" required type="text" placeholder="Ex: João Silva" className={inputCls} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">E-mail Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input name="email" required type="email" placeholder="email@empresa.com" className={inputCls} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Senha Inicial</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input name="password" required type="password" placeholder="Mínimo 6 caracteres" className={inputCls} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Atribuir Cargo 🔒</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['admin', 'pcm', 'gestao', 'mecanico', 'motorista', 'afiador', 'visitante'].map(r => (
                      <label key={r} className="relative flex items-center p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                        <input type="radio" name="role" value={r} defaultChecked={r === 'visitante'} className="sr-only peer" />
                        <div className="w-full flex items-center justify-between">
                          <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">{r}</span>
                          <CheckCircle2 size={16} className="text-blue-600 opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <div className="absolute inset-0 rounded-xl border-2 border-blue-600 opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Campo Filial */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Filial 🏢</label>
                  <select
                    name="filial_id"
                    defaultValue="MATRIZ"
                    className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-zinc-900 dark:text-zinc-100"
                  >
                    {filiais.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  {loading ? "Criando Acesso..." : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alterar Senha */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-2xl scale-in-center">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Key className="text-blue-600" /> Alterar Senha
              </h2>
              <button
                onClick={closePasswordModal}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {passwordSuccess ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-lg flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
                  <CheckCircle2 size={16} /> Senha de {passwordModalUser.full_name || "usuário"} atualizada com sucesso.
                </div>
                <button
                  onClick={closePasswordModal}
                  className="w-full px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Definir uma nova senha para <span className="font-semibold text-zinc-700 dark:text-zinc-300">{passwordModalUser.full_name || "este usuário"}</span>.
                </p>

                {passwordError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle size={16} /> {passwordError}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Nova Senha</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                      autoFocus
                      required
                      type="text"
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      value={newPasswordInput}
                      onChange={e => setNewPasswordInput(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closePasswordModal}
                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading || newPasswordInput.length < 6}
                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                  >
                    {passwordLoading ? "Salvando..." : "Salvar Senha"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-zinc-900 dark:text-zinc-100";
