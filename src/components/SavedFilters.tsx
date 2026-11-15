import { useState, type FormEvent } from 'react';
import { Bookmark, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { FilterCriteria, SavedFilter } from '../types/pm';
import {
  deleteFilterPreset,
  renameFilterPreset,
  saveFilterPreset,
} from '../lib/searchService';

interface SavedFiltersProps {
  uid: string;
  projectId: string;
  savedFilters: SavedFilter[];
  currentCriteria: FilterCriteria;
  onApplyCriteria: (criteria: FilterCriteria) => void;
}

export function SavedFilters({
  uid,
  projectId,
  savedFilters,
  currentCriteria,
  onApplyCriteria,
}: SavedFiltersProps) {
  const [open, setOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const projectPresets = savedFilters.filter(
    (f) => !f.projectId || f.projectId === projectId
  );

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    setSaving(true);
    try {
      await saveFilterPreset({
        uid,
        name: presetName.trim(),
        projectId,
        criteria: currentCriteria,
      });
      setPresetName('');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = (filter: SavedFilter) => {
    try {
      const parsed = JSON.parse(filter.criteriaJson) as FilterCriteria;
      onApplyCriteria(parsed);
      setOpen(false);
    } catch {
      // ignore invalid JSON
    }
  };

  const handleRename = async (filter: SavedFilter) => {
    if (!editName.trim()) return;
    await renameFilterPreset({
      uid,
      filterId: filter.id,
      name: editName.trim(),
      projectId: filter.projectId,
      criteriaJson: filter.criteriaJson,
    });
    setEditingId(null);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="btn-blush inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
      >
        <Bookmark className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#F1BBC8]" />
        <span>Presets</span>
        {projectPresets.length > 0 && (
          <span className="font-mono text-[11px] text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
            ({projectPresets.length})
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 glass-strong rounded-[20px] z-40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-bold text-[#3D1023] dark:text-[#FFF5F6]">
              Saved Filter Presets
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close presets"
              className="p-1 rounded-[10px] text-[#795D6B] hover:text-[#7A2346] dark:text-[#D9B7C4] dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="flex items-center gap-1.5">
            <input
              type="text"
              value={presetName}
              maxLength={60}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Save current filters as..."
              className="input-blush flex-1 px-2.5 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={saving || !presetName.trim()}
              aria-label="Save filter preset"
              className="btn-burgundy p-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>

          {projectPresets.length === 0 ? (
            <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4] py-1">
              No saved filter presets yet. Configure filters and save one above.
            </p>
          ) : (
            <ul className="divide-y divide-[#EAD7DE]/60 dark:divide-[#E9A8B8]/12 max-h-52 overflow-y-auto">
              {projectPresets.map((f) => (
                <li key={f.id} className="py-1.5 flex items-center justify-between gap-2">
                  {editingId === f.id ? (
                    <div className="flex-1 flex items-center gap-1">
                      <input
                        type="text"
                        value={editName}
                        maxLength={60}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        className="input-blush flex-1 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRename(f)}
                        className="p-1 text-[#21865B] cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApply(f)}
                        className="flex-1 text-left text-xs font-medium text-[#3D1023] dark:text-[#FFF5F6] hover:text-[#7A2346] dark:hover:text-[#F1BBC8] truncate cursor-pointer"
                      >
                        {f.name}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(f.id);
                            setEditName(f.name);
                          }}
                          aria-label={`Rename ${f.name}`}
                          className="p-1 text-[#A58C98] hover:text-[#7A2346] dark:hover:text-white cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteFilterPreset({ uid, filterId: f.id })}
                          aria-label={`Delete ${f.name}`}
                          className="p-1 text-[#A58C98] hover:text-[#D94C65] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
