import type { ComponentChildren } from "preact";

import type { ActiveFilters } from "./types";

interface ToggleOptionProps {
  children: ComponentChildren;
  filter: "low" | "medium" | "high";
  activeFilters: ActiveFilters;
  setFilters: (filters: ActiveFilters) => void;
}

function ToggleOption({ children, filter, activeFilters, setFilters }: ToggleOptionProps) {
  return (
    <button
      className={"toggle__option " + (activeFilters[filter] ? "is-toggled" : "")}
      onClick={() =>
        setFilters({
          ...activeFilters,
          [filter]: !activeFilters[filter],
        })
      }
    >
      {children}
    </button>
  );
}

interface FilterToggleProps {
  activeFilters: ActiveFilters;
  setFilters: (filters: ActiveFilters) => void;
}

export default function FilterToggle({ activeFilters, setFilters }: FilterToggleProps) {
  return (
    <div className="toggle">
      <div className="toggle__label">Filter:</div>
      <div className="toggle__options">
        <ToggleOption filter="low" activeFilters={activeFilters} setFilters={setFilters}>
          Low
        </ToggleOption>
        <ToggleOption filter="medium" activeFilters={activeFilters} setFilters={setFilters}>
          Medium
        </ToggleOption>
        <ToggleOption filter="high" activeFilters={activeFilters} setFilters={setFilters}>
          High
        </ToggleOption>
      </div>
    </div>
  );
}
