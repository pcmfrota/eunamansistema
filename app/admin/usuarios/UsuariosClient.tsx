"use client";

import { useState, useTransition } from "react";
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
  Layout
} from "lucide-react";
import { 
  updateUserRole, 
  createNewUser, 
  deleteUser, 
  updateRolePermissions 
} from "./actions";
import { useAuth } from "@/components/auth-context";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  updated_at: string;
};

type RolePermission = {
  role: string;
  allowed_tabs: string[];
};

export default function UsuariosClient({ 
  initialProfiles,
  initialPermissions 
}: { 
  initialProfiles: Profile[],
  initialPermissions: RolePermission[] 
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions);
  const [editingPermissions, setEditingPermissions] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isVisitante } = useAuth();

  const filteredProfiles = profiles.filter(p =>
    p.full_name?.toLowerCase().includes(busca.toLowerCase()) ||
    p.role.toLowerCase().includes(busca.toLowerCase())
  );

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (isVisitante) return;
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole);
      if ('error' in result) {
        alert(result.error);
      } else {
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
      }
    });
  };

  const handleDelete = async (userId: string) => {
    if (isVisitante) return;
    if (!confirm("Tem certeza que deseja excluir permanentemente este usuário?")) return;

    startTransition(async () => {
      const result = await deleteUser(userId);
      if ('error' in result) {
        alert(result.error);
      } else {
        setProfiles(prev => prev.filter(p => p.id !== userId));
      }
    });
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    { name: 'Dashboard', path: '/' },
    { name: 'Controle de OS', path: '/os' },
    { name: 'Controle de Horímetros', path: '/preventivas' },
    { name: 'Boletim de Pneus', path: '/pneus' },
    { name: 'Backlog', path: '/backlog' },
    { name: 'Prog. Preventiva', path: '/programacao-preventiva' },
    { name: 'Base de Frotas', path: '/base-frotas' },
    { name: 'Base de Dados', path: '/base-dados' },
    { name: 'Calendário Suzano', path: '/calendario' },
    { name: 'Controle de Lavagens', path: '/lavagens' },
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
          {['admin', 'pcm', 'gestao', 'visitante'].map(role => {
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
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{p.full_name || "Sem nome"}</p>
                        <p className="text-xs text-zinc-500">{p.id.slice(0, 8)}...</p>
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
                        <option value="visitante">Visitante</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!isVisitante && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={isPending}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Excluir usuário"
                      >
                        <Trash2 size={18} />
                      </button>
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
                    {['admin', 'pcm', 'gestao', 'visitante'].map(r => (
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
    </div>
  );
}

const inputCls = "w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-zinc-900 dark:text-zinc-100";
