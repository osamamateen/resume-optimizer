"use client";

import type { ReactNode } from "react";

interface ListEditorProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  addLabel: string;
  emptyLabel?: string;
}

export function ListEditor<T>({ items, onChange, createItem, renderItem, addLabel, emptyLabel }: ListEditorProps<T>) {
  function updateItem(index: number, patch: Partial<T>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && emptyLabel && <p className="text-[13px] text-text-secondary">{emptyLabel}</p>}
      {items.map((item, index) => (
        <div key={index} className="bg-surface border border-border-hairline rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
                className="px-2 py-1 border border-border-hairline rounded-md bg-transparent text-text-secondary text-[11px] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Move down"
                className="px-2 py-1 border border-border-hairline rounded-md bg-transparent text-text-secondary text-[11px] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="text-[12px] text-red-600 dark:text-red-400 cursor-pointer"
            >
              Remove
            </button>
          </div>
          {renderItem(item, (patch) => updateItem(index, patch))}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, createItem()])}
        className="w-full px-4 py-[9px] border border-dashed border-border-hairline rounded-lg bg-transparent text-text-secondary text-[13px] cursor-pointer"
      >
        {addLabel}
      </button>
    </div>
  );
}
