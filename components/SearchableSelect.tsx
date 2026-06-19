import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = "Selecione...", className, disabled, name }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={cn("relative w-full", className)} ref={wrapperRef}>
      {name && <input type="hidden" name={name} value={value} />}
      <div 
        className={cn(
          "w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold flex items-center justify-between cursor-pointer transition-all",
          isOpen ? "ring-2 ring-indigo-500 border-transparent" : "",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={cn("block truncate", !selectedOption && "text-zinc-400 dark:text-zinc-500")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={cn("text-zinc-400 shrink-0 ml-2 transition-transform", isOpen && "rotate-180")} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-60 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 flex items-center gap-2">
             <Search size={14} className="text-zinc-400" />
             <input
               type="text"
               className="w-full bg-transparent text-sm font-medium outline-none text-zinc-800 dark:text-zinc-200"
               placeholder="Pesquisar..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               onClick={e => e.stopPropagation()}
               autoFocus
             />
          </div>
          <div className="overflow-y-auto p-1 custom-scrollbar">
             {filteredOptions.length === 0 ? (
               <div className="p-3 text-sm text-center text-zinc-500">Nenhum resultado</div>
             ) : (
               filteredOptions.map(opt => (
                 <div
                   key={opt.value}
                   className={cn(
                     "px-3 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors",
                     opt.value === value 
                       ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" 
                       : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                   )}
                   onClick={() => {
                     onChange(opt.value);
                     setIsOpen(false);
                     setSearchTerm('');
                   }}
                 >
                   {opt.label}
                 </div>
               ))
             )}
          </div>
        </div>
      )}
    </div>
  );
}
