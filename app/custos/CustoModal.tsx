"use client";

import { useRef, useState } from "react";
import { X, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CurrencyInput } from "@/components/CurrencyInput";
import { createClient } from "@/utils/supabase/client";
import { localDb, serializeFormData } from "@/lib/offline-db";
import { upsertCusto, CustoManutencao, StatusCusto, FormaPagamentoCartao, Fornecedor, AreaCusto, ParcelaCartao } from "./actions";
import { formatarMoeda } from "./CustosClient";
import { AREA_LABEL, CATEGORIAS_POR_AREA } from "./config";

const STATUS_OPTIONS: { value: StatusCusto; label: string; cls: string }[] = [
  { value: "PAGO", label: "Pago", cls: "bg-emerald-600 text-white border-emerald-600" },
  { value: "AG_PAGAMENTO", label: "Ag. Pagamento", cls: "bg-red-600 text-white border-red-600" },
  { value: "FATURADO", label: "Faturado", cls: "bg-blue-600 text-white border-blue-600" },
  { value: "PAGO_CARTAO", label: "Pago via Cartão", cls: "bg-purple-600 text-white border-purple-600" },
];

export default function CustoModal({
  isOpen,
  onClose,
  editingData,
  area,
  equipamentos,
  fornecedores,
  isOnline,
  parcelasExistentes = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  editingData: CustoManutencao | null;
  area: AreaCusto;
  equipamentos: any[];
  fornecedores: Fornecedor[];
  isOnline: boolean;
  parcelasExistentes?: ParcelaCartao[];
}) {
  const isManutencao = area === "MANUTENCAO";
  const categoriasArea = CATEGORIAS_POR_AREA[area];

  const [placa, setPlaca] = useState(editingData?.placa || "");
  const [fornecedor, setFornecedor] = useState(editingData?.fornecedor || "");
  const [pecas, setPecas] = useState(editingData?.pecas || 0);
  const [maoObra, setMaoObra] = useState(editingData?.mao_obra || 0);
  const [status, setStatus] = useState<StatusCusto>(editingData?.status || "AG_PAGAMENTO");
  const [formaPagamentoCartao, setFormaPagamentoCartao] = useState<FormaPagamentoCartao>(editingData?.forma_pagamento_cartao || "AVISTA");
  const [cartao, setCartao] = useState(editingData?.cartao || "");
  const [parcelasTotal, setParcelasTotal] = useState(editingData?.parcelas_total || 2);
  const boletosOrdenados = [...parcelasExistentes].sort((a, b) => a.numero - b.numero);
  const [quantidadeBoletos, setQuantidadeBoletos] = useState(
    editingData?.status === "FATURADO" && editingData?.parcelas_total ? editingData.parcelas_total : 1
  );
  const [boletoDatas, setBoletoDatas] = useState<string[]>(boletosOrdenados.map((p) => p.mes_vencimento));
  const [categoria, setCategoria] = useState(editingData?.categoria || categoriasArea[0]?.value || "");
  const [categoriaOutros, setCategoriaOutros] = useState(editingData?.categoria_outros || "");
  const [loading, setLoading] = useState(false);
  const [anexoUrl, setAnexoUrl] = useState(editingData?.anexo_url || "");
  const [previewAberto, setPreviewAberto] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  const placasOptions = equipamentos
    .map((eq) => ({ value: eq.placa, label: eq.placa }))
    .filter((o, i, arr) => o.value && arr.findIndex((a) => a.value === o.value) === i)
    .sort((a, b) => a.label.localeCompare(b.label));

  const fornecedoresOptions = fornecedores
    .map((f) => ({ value: f.nome_fantasia, label: f.nome_fantasia }))
    .sort((a, b) => a.label.localeCompare(b.label));

  async function salvar(formData: FormData, manterAberto: boolean) {
    // SearchableSelect usa um input hidden por baixo, que o HTML5 "required" ignora — por
    // isso a validação de fornecedor obrigatório é feita aqui, não via reportValidity().
    if (!String(formData.get("fornecedor") || "").trim()) {
      alert("Selecione um fornecedor.");
      return;
    }
    setLoading(true);
    try {
      let anexo = anexoUrl;
      const file = formData.get("arquivo_comprovante") as File;
      if (file && file.size > 0) {
        if (!isOnline) {
          alert("Não é possível anexar arquivos offline. Conecte-se à internet para fazer upload.");
          setLoading(false);
          return;
        }
        const supabase = createClient();
        const ext = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("comprovantes-financeiro").upload(fileName, file);
        if (uploadError) throw new Error("Erro ao enviar comprovante: " + uploadError.message);
        const { data: { publicUrl } } = supabase.storage.from("comprovantes-financeiro").getPublicUrl(fileName);
        anexo = publicUrl;
      }
      formData.delete("arquivo_comprovante");
      formData.set("anexo_url", anexo);
      if (editingData?.id) formData.set("id", editingData.id);

      const storeItem: any = {
        id: editingData?.id || `custo_${Date.now()}`,
        data: formData.get("data") as string,
        placa: String(formData.get("placa") || "").toUpperCase(),
        tipo_manutencao: formData.get("tipo_manutencao"),
        descricao: formData.get("descricao"),
        fornecedor: formData.get("fornecedor"),
        pecas: parseFloat(formData.get("pecas") as string) || 0,
        mao_obra: parseFloat(formData.get("mao_obra") as string) || 0,
        status: formData.get("status"),
        forma_pagamento_cartao: formData.get("forma_pagamento_cartao") || null,
        cartao: formData.get("cartao") || null,
        parcelas_total: status === "FATURADO"
          ? (formData.get("quantidade_boletos") ? parseInt(formData.get("quantidade_boletos") as string, 10) : null)
          : (formData.get("parcelas_total") ? parseInt(formData.get("parcelas_total") as string, 10) : null),
        observacoes: formData.get("observacoes"),
        anexo_url: anexo,
        filial_id: editingData?.filial_id || "MATRIZ",
        area,
        categoria: formData.get("categoria") || null,
        categoria_outros: formData.get("categoria_outros") || null,
      };

      if (isOnline) {
        const result = await upsertCusto(formData);
        if (result?.error) throw new Error(result.error);
        await localDb.put("custos_manutencao", storeItem);
      } else {
        const serialized = serializeFormData(formData);
        if (editingData?.id) {
          await localDb.put("custos_manutencao", { ...storeItem, _isPendingSync: true });
          await localDb.addToQueue("custos_manutencao", "update", { id: editingData.id, ...serialized });
        } else {
          await localDb.put("custos_manutencao", { ...storeItem, _isPendingSync: true });
          await localDb.addToQueue("custos_manutencao", "create", serialized);
        }
      }

      window.dispatchEvent(new CustomEvent("offline-db-updated-custos_manutencao"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));

      if (manterAberto) {
        formRef.current?.reset();
        setPlaca("");
        setFornecedor("");
        setPecas(0);
        setMaoObra(0);
        setStatus("AG_PAGAMENTO");
        setFormaPagamentoCartao("AVISTA");
        setCartao("");
        setParcelasTotal(2);
        setQuantidadeBoletos(1);
        setBoletoDatas([]);
        setCategoria(categoriasArea[0]?.value || "");
        setCategoriaOutros("");
        setAnexoUrl("");
      } else {
        onClose();
      }
    } catch (err: any) {
      alert("Erro ao salvar: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-emerald-500";
  const total = pecas + maoObra;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {editingData?.id ? "Editar Lançamento" : `Novo Lançamento — ${AREA_LABEL[area]}`}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Insira os dados do serviço, custos e status financeiro</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={20} />
          </button>
        </div>

        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            salvar(new FormData(e.currentTarget), false);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="area" value={area} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">Data</label>
              <input type="date" name="data" required defaultValue={editingData?.data || new Date().toISOString().slice(0, 10)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Placa {!isManutencao && <span className="normal-case font-normal text-zinc-400">(opcional)</span>}
              </label>
              <SearchableSelect name="placa" options={placasOptions} value={placa} onChange={setPlaca} placeholder="Selecione a placa..." />
            </div>

            {isManutencao ? (
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Tipo de Manutenção</label>
                <select name="tipo_manutencao" required defaultValue={editingData?.tipo_manutencao || "CORRETIVA"} className={inputCls}>
                  <option value="CORRETIVA">Corretiva</option>
                  <option value="PREVENTIVA">Preventiva</option>
                  <option value="PREDITIVA">Preditiva</option>
                </select>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase text-zinc-500 mb-1.5 block">Categoria</label>
                <div className="flex flex-wrap gap-2">
                  {categoriasArea.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategoria(c.value)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-bold border transition-all",
                        categoria === c.value ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="categoria" value={categoria} />
                {categoria === "OUTROS" && (
                  <input
                    value={categoriaOutros}
                    onChange={(e) => setCategoriaOutros(e.target.value)}
                    name="categoria_outros"
                    className={cn(inputCls, "mt-2")}
                    placeholder="Qual categoria?"
                  />
                )}
              </div>
            )}

            <div className={isManutencao ? "" : "sm:col-span-2"}>
              <label className="text-xs font-bold uppercase text-zinc-500">Fornecedor / Oficina <span className="text-red-500">*</span></label>
              <SearchableSelect name="fornecedor" options={fornecedoresOptions} value={fornecedor} onChange={setFornecedor} placeholder="Selecione o fornecedor..." />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">{isManutencao ? "Descrição do Serviço" : "Descrição"}</label>
            <textarea name="descricao" required defaultValue={editingData?.descricao || ""} rows={2} className={inputCls} placeholder={isManutencao ? "Ex: RECAPAGEM DE PNEUS" : "Ex: COMPRA DE MATERIAL DE ESCRITÓRIO"} />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Observações / PC</label>
            <input name="observacoes" defaultValue={editingData?.observacoes || ""} className={inputCls} placeholder="Ex: PC 010673" />
          </div>

          {isManutencao ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Peças (R$)</label>
                <CurrencyInput name="pecas" value={pecas} onValueChange={setPecas} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Mão de Obra (R$)</label>
                <CurrencyInput name="mao_obra" value={maoObra} onValueChange={setMaoObra} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Total (R$)</label>
                <input readOnly value={formatarMoeda(total)} className={cn(inputCls, "bg-zinc-100 dark:bg-zinc-800 font-bold cursor-not-allowed")} />
              </div>
            </div>
          ) : (
            <div className="sm:max-w-xs">
              <label className="text-xs font-bold uppercase text-zinc-500">Valor (R$)</label>
              <CurrencyInput name="pecas" value={pecas} onValueChange={setPecas} className={inputCls} />
              <input type="hidden" name="mao_obra" value={0} />
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500 mb-1.5 block">Status</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm font-bold border transition-all",
                    status === opt.value ? opt.cls : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="status" value={status} />
          </div>

          {status === "PAGO_CARTAO" && (
            <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/20 space-y-3">
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500 mb-1.5 block">Foi à vista ou parcelado?</label>
                <div className="flex gap-2">
                  {(["AVISTA", "PARCELADO"] as FormaPagamentoCartao[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormaPagamentoCartao(opt)}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg text-sm font-bold border transition-all",
                        formaPagamentoCartao === opt ? "bg-purple-600 text-white border-purple-600" : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800"
                      )}
                    >
                      {opt === "AVISTA" ? "À Vista" : "Parcelado"}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="forma_pagamento_cartao" value={formaPagamentoCartao} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500">Qual Cartão?</label>
                  <input name="cartao" value={cartao} onChange={(e) => setCartao(e.target.value)} className={inputCls} placeholder="Ex: Nubank Empresarial" />
                </div>
                {formaPagamentoCartao === "PARCELADO" && (
                  <div>
                    <label className="text-xs font-bold uppercase text-zinc-500">Em quantas parcelas?</label>
                    <input
                      type="number" name="parcelas_total" min={2} max={48} value={parcelasTotal}
                      onChange={(e) => setParcelasTotal(parseInt(e.target.value, 10) || 2)}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>

              {formaPagamentoCartao === "PARCELADO" && parcelasTotal > 0 && (
                <p className="text-xs text-purple-700 dark:text-purple-400 font-semibold">
                  {parcelasTotal}x de {formatarMoeda(total / parcelasTotal)}
                </p>
              )}
            </div>
          )}

          {status === "FATURADO" && (
            <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 space-y-3">
              <div className="max-w-xs">
                <label className="text-xs font-bold uppercase text-zinc-500">Quantos boletos?</label>
                <input
                  type="number" name="quantidade_boletos" min={1} max={48} value={quantidadeBoletos}
                  onChange={(e) => {
                    const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setQuantidadeBoletos(n);
                    setBoletoDatas((atual) => Array.from({ length: n }, (_, i) => atual[i] || ""));
                  }}
                  className={inputCls}
                />
              </div>

              {quantidadeBoletos > 1 && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Array.from({ length: quantidadeBoletos }).map((_, i) => (
                      <div key={i}>
                        <label className="text-[10px] font-bold uppercase text-zinc-500">Boleto {i + 1} — Vencimento</label>
                        <input
                          type="date" required name="boleto_data" value={boletoDatas[i] || ""}
                          onChange={(e) => setBoletoDatas((atual) => {
                            const novo = [...atual];
                            novo[i] = e.target.value;
                            return novo;
                          })}
                          className={inputCls}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold">
                    {quantidadeBoletos}x de {formatarMoeda(total / quantidadeBoletos)}
                  </p>
                </>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Comprovante (Nota Fiscal / O.S.)</label>
            <input type="file" name="arquivo_comprovante" accept="image/*,application/pdf" className={inputCls} />
            {anexoUrl && (
              anexoUrl.toLowerCase().endsWith(".pdf") ? (
                <a href={anexoUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 text-xs text-blue-600 hover:underline w-fit">
                  <FileText size={28} className="text-red-500 shrink-0" />
                  Visualizar PDF anexado
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreviewAberto(true)}
                  className="group relative mt-2 w-20 h-20 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                  title="Clique para ampliar"
                >
                  <img src={anexoUrl} alt="Comprovante anexado" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                    <Eye size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </button>
              )
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border dark:border-zinc-800 rounded-lg">
              Cancelar
            </button>
            {!editingData?.id && (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (!formRef.current?.reportValidity()) return;
                  salvar(new FormData(formRef.current), true);
                }}
                className="px-4 py-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg disabled:opacity-50"
              >
                Salvar e Adicionar Outro
              </button>
            )}
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {loading ? "Salvando..." : "Salvar Lançamento"}
            </button>
          </div>
        </form>
      </div>

      {previewAberto && anexoUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85"
          onClick={() => setPreviewAberto(false)}
        >
          <button
            onClick={() => setPreviewAberto(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X size={28} />
          </button>
          <img
            src={anexoUrl}
            alt="Comprovante anexado"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
