"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormField } from "@form-walrus/client";
import { GripVertical, Trash2, Asterisk, Plus, X, Type, List as ListIcon, Star, CheckSquare, ChevronDown } from "lucide-react";
import { useState } from "react";

interface SortableFieldProps {
  field: FormField;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FormField>) => void;
}

export function SortableField({ field, onDelete, onUpdate }: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const [newOption, setNewOption] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
  };

  const hasOptions = ["dropdown", "checkbox_group"].includes(field.type);

  const addOption = () => {
    if (!newOption.trim()) return;
    const currentOptions = field.options || [];
    if (currentOptions.includes(newOption.trim())) return;
    onUpdate(field.id, { options: [...currentOptions, newOption.trim()] });
    setNewOption("");
  };

  const removeOption = (opt: string) => {
    onUpdate(field.id, { options: (field.options || []).filter(o => o !== opt) });
  };

  const getIcon = () => {
    switch(field.type) {
      case 'short_text':
      case 'long_text':
      case 'rich_text':
      case 'url_input': return <Type size={14} />;
      case 'dropdown': return <ChevronDown size={14} />;
      case 'star_rating': return <Star size={14} />;
      case 'checkbox_group': return <CheckSquare size={14} />;
      default: return <ListIcon size={14} />;
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`
        border rounded-[14px] p-4 group relative bg-[#111116] flex flex-col gap-4 mb-3 transition-all duration-200
        ${isDragging ? "shadow-[0_12px_40px_rgba(0,0,0,0.5)] border-purple-500/50" : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"}
      `}
    >
      <div className="flex items-center gap-4">
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-grab text-white/10 hover:text-white/40 transition-colors p-1"
        >
          <GripVertical size={16} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <input 
              value={field.label} 
              onChange={(e) => onUpdate(field.id, { label: e.target.value })}
              className="font-semibold text-white outline-none bg-transparent flex-1 border-b border-transparent focus:border-purple-500/30 transition-colors text-[14px] placeholder-white/20"
              placeholder="Question label..."
            />
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                onClick={() => onUpdate(field.id, { required: !field.required })}
                className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${field.required ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/5 border-white/10 text-white/20 hover:text-white/40"}`}
                title={field.required ? "Required" : "Optional"}
               >
                <Asterisk size={12} strokeWidth={3} />
               </button>
               <button 
                onClick={() => onDelete(field.id)} 
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/5 border border-red-500/10 text-red-500/40 hover:text-red-400 transition-all"
               >
                <Trash2 size={12} />
               </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.15em] flex items-center gap-1.5">
                <span className="text-purple-500/50">{getIcon()}</span>
                {field.type.replace("_", " ")}
             </span>
             {field.required && <span className="text-[9px] font-bold text-red-500/40 uppercase tracking-widest px-1.5 py-0.5 bg-red-500/5 rounded">Required</span>}
          </div>
        </div>
      </div>

      {hasOptions && (
        <div className="pl-9 space-y-4 animate-fade-in">
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map(opt => (
              <div key={opt} className="flex items-center gap-2 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">
                <span className="text-[11px] font-medium text-white/50">{opt}</span>
                <button 
                  onClick={() => removeOption(opt)}
                  className="text-white/20 hover:text-red-400 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {(!field.options || field.options.length === 0) && (
              <p className="text-[11px] text-white/20 italic">No options defined</p>
            )}
          </div>
          <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
            <input 
              value={newOption}
              onChange={e => setNewOption(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addOption()}
              className="bg-[#1a1a2e] px-3 py-1.5 text-[11px] font-medium text-white outline-none flex-1 border border-white/[0.15] rounded-lg placeholder-white/10"
              placeholder="New option..."
            />
            <button 
              onClick={addOption}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-white/40 hover:bg-purple-600 hover:text-white transition-all"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
