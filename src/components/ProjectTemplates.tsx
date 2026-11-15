import { Layers, Sparkles, Trash2 } from 'lucide-react';
import type { ProjectTemplate } from '../types/pm';
import { BUILTIN_PROJECT_TEMPLATES } from '../lib/templateService';

interface ProjectTemplatesProps {
  customTemplates: ProjectTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (tpl: ProjectTemplate | null) => void;
  onDeleteCustomTemplate?: (templateId: string) => void;
}

export function ProjectTemplates({
  customTemplates,
  selectedTemplateId,
  onSelectTemplate,
  onDeleteCustomTemplate,
}: ProjectTemplatesProps) {
  const allTemplates = [...customTemplates, ...BUILTIN_PROJECT_TEMPLATES];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#513443] dark:text-[#F8DDE3]">
          Project Template (optional)
        </span>
        {selectedTemplateId && (
          <button
            type="button"
            onClick={() => onSelectTemplate(null)}
            className="text-[11px] font-medium text-[#7A2346] dark:text-[#F1BBC8] hover:underline cursor-pointer"
          >
            Use blank / starter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
        {allTemplates.map((tpl) => {
          const selected = selectedTemplateId === tpl.id;
          return (
            <div
              key={tpl.id}
              onClick={() => onSelectTemplate(selected ? null : tpl)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTemplate(selected ? null : tpl);
                }
              }}
              className={`p-3 rounded-[14px] border text-left transition-all cursor-pointer ${
                selected
                  ? 'border-[#C86B88] bg-[#FCE8EC]/85 dark:bg-[#5B1733]/55 shadow-xs'
                  : 'border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-[#FBEFF1]/65 dark:bg-[#2A0D19]/50 hover:border-[#C86B88]/55'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {tpl.isCustom ? (
                      <Sparkles className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8] shrink-0" />
                    ) : (
                      <Layers className="w-3.5 h-3.5 text-[#C86B88] dark:text-[#D989A2] shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6] truncate">
                      {tpl.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4] mt-0.5 tabular-nums">
                    {tpl.category} · {tpl.tasks.length} tasks · {tpl.milestones.length} milestones
                  </p>
                </div>
                {tpl.isCustom && onDeleteCustomTemplate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCustomTemplate(tpl.id);
                    }}
                    aria-label={`Delete custom template ${tpl.name}`}
                    className="p-1 text-[#A58C98] hover:text-[#D94C65] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[#513443] dark:text-[#F8DDE3] line-clamp-2 mt-1.5">
                {tpl.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
