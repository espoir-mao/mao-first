"use client";

import { ChevronRightIcon } from "../Icons";

interface OptionRowProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export default function OptionRow({
  label,
  description,
  selected,
  onClick,
  icon,
}: OptionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 border-b border-l-4 border-neutral-100 py-3.5 pr-3 text-left transition last:border-b-0 ${
        selected
          ? "border-l-[#7a9a5a] bg-spring-50 pl-3"
          : "border-l-transparent pl-3 hover:bg-neutral-50"
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          selected
            ? "bg-[#7a9a5a] text-white"
            : "bg-neutral-100 text-neutral-500"
        }`}
      >
        {icon ?? label.charAt(0)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-bold ${
            selected ? "text-[#4a5f34]" : "text-neutral-900"
          }`}
        >
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-neutral-500">
            {description}
          </span>
        )}
      </span>
      <ChevronRightIcon
        className={`flex-shrink-0 transition ${
          selected ? "text-[#7a9a5a]" : "text-neutral-300"
        }`}
      />
    </button>
  );
}
