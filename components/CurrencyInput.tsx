"use client";

import { useEffect, useState } from "react";

// Máscara de moeda BRL tratando a digitação como centavos (padrão de caixa: o usuário digita
// da direita pra esquerda e o input vai formatando "R$ 1.234,56" sozinho). Renderiza também um
// input hidden com o valor decimal puro, pra plugar direto no FormData nativo (mesmo padrão de
// formulário não controlado usado no resto do app — ver SearchableSelect.tsx).
function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CurrencyInput({
  name,
  defaultValue = 0,
  value,
  onValueChange,
  className,
  placeholder,
  disabled,
}: {
  name?: string;
  defaultValue?: number;
  value?: number;
  onValueChange?: (valorReais: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [centavos, setCentavos] = useState(() => Math.round((value ?? defaultValue) * 100));

  useEffect(() => {
    if (value != null) setCentavos(Math.round(value * 100));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitos = e.target.value.replace(/\D/g, "");
    const novo = digitos ? parseInt(digitos, 10) : 0;
    setCentavos(novo);
    onValueChange?.(novo / 100);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={(centavos / 100).toFixed(2)} />}
      <input
        type="text"
        inputMode="numeric"
        value={formatarCentavos(centavos)}
        onChange={handleChange}
        placeholder={placeholder || "R$ 0,00"}
        disabled={disabled}
        className={className}
      />
    </>
  );
}
