import { Tag, X } from "lucide-preact";
import type { FunctionalComponent as FC } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

const TagFilter: FC<{
  availableTags: string[];
  tagCounts: ReadonlyMap<string, number>;
  selectedTags: string[];
  onChangeSelectedTags: (tags: string[]) => void;
}> = ({ availableTags, tagCounts, selectedTags, onChangeSelectedTags }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (availableTags.length === 0) {
    return null;
  }

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChangeSelectedTags(selectedTags.filter((item) => item !== tag));
      return;
    }
    onChangeSelectedTags([...selectedTags, tag]);
  };

  const clearTags = () => {
    onChangeSelectedTags([]);
  };

  return (
    <div className="tag-filter" ref={rootRef}>
      <button
        type="button"
        className={
          open || selectedTags.length > 0 ? "tag-filter__trigger is-active" : "tag-filter__trigger"
        }
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Tag size={14} aria-hidden />
        Tags
        {selectedTags.length > 0 ? (
          <span className="tag-filter__badge">{selectedTags.length}</span>
        ) : null}
      </button>

      {open ? (
        <div className="tag-filter__menu" role="listbox" aria-label="Filter by tag">
          {availableTags.map((tag) => {
            const checked = selectedTags.includes(tag);
            const count = tagCounts.get(tag) ?? 0;
            return (
              <label key={tag} className="tag-filter__option">
                <input type="checkbox" checked={checked} onChange={() => toggleTag(tag)} />
                <span className="tag-filter__option-label">{tag}</span>
                <span className="tag-filter__option-count">{count}</span>
              </label>
            );
          })}
          {selectedTags.length > 0 ? (
            <div className="tag-filter__menu-footer">
              <button type="button" className="tag-filter__clear" onClick={clearTags}>
                Clear
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedTags.length > 0 ? (
        <div className="tag-filter__chips" aria-label="Selected tags">
          {selectedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="tag-filter__chip"
              aria-label={`Remove tag ${tag}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
              <X size={12} aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default TagFilter;
