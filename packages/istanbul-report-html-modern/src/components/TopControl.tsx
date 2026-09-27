import { List, ListTree, Moon, Sun } from "lucide-preact";
import type { FunctionalComponent as FC } from "preact";

import { useTheme } from "../theme-context";
import TagFilter from "./TagFilter";

const TopControl: FC<{
  total: number;
  showMode: string;
  filenameKeywords: string;
  availableTags: string[];
  tagCounts: ReadonlyMap<string, number>;
  selectedTags: string[];
  onChangeSelectedTags: (tags: string[]) => void;
  onChangeShowMode: (mode: string) => void;
  onChangeKeywords: (word: string) => void;
}> = ({
  total,
  showMode,
  onChangeShowMode,
  onChangeKeywords,
  filenameKeywords,
  availableTags,
  tagCounts,
  selectedTags,
  onChangeSelectedTags,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="top-control">
      <div className="top-control__row">
        <div className="top-control__left">
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={showMode === "tree" ? "view-toggle__btn is-active" : "view-toggle__btn"}
              onClick={() => onChangeShowMode("tree")}
            >
              <ListTree size={14} aria-hidden />
              Code Tree
            </button>
            <button
              type="button"
              className={showMode === "list" ? "view-toggle__btn is-active" : "view-toggle__btn"}
              onClick={() => onChangeShowMode("list")}
            >
              <List size={14} aria-hidden />
              File List
            </button>
          </div>
          <span className="top-control__count">{total} Total Files</span>
        </div>

        <div className="top-control__right">
          <div className="top-control__filters">
            <TagFilter
              availableTags={availableTags}
              tagCounts={tagCounts}
              selectedTags={selectedTags}
              onChangeSelectedTags={onChangeSelectedTags}
            />
            <input
              className="search-input"
              type="search"
              placeholder="Search for files"
              value={filenameKeywords}
              onChange={(event) => onChangeKeywords(event.currentTarget.value)}
            />
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopControl;
