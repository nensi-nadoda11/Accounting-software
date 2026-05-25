import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { SectionNavItem } from "../../constants/navigation";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

const toComparableUrl = (value: string) => new URL(value, "http://localhost");

const isTabActive = (currentPath: string, href: string) => {
  const current = toComparableUrl(currentPath);
  const target = toComparableUrl(href);

  if (current.pathname !== target.pathname) {
    return current.pathname.startsWith(`${target.pathname}/`);
  }

  return target.search ? current.search === target.search : true;
};

export const NestedRouteSidebar = ({
  title,
  currentPath,
  tabs,
  open,
  onToggle,
}: {
  title: string;
  currentPath: string;
  tabs: readonly SectionNavItem[];
  open: boolean;
  onToggle: () => void;
}) => {
  if (!open) {
    return (
      <div className="w-full lg:w-auto lg:flex-none">
        <Button type="button" variant="secondary" className="rounded-2xl" onClick={onToggle}>
          <ChevronRight className="mr-2 size-4" />
          Show {title}
        </Button>
      </div>
    );
  }

  return (
    <aside className="w-full lg:w-64 lg:flex-none">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:min-h-[calc(100vh-7.5rem)]">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-9 rounded-xl px-0"
            onClick={onToggle}
            aria-label={`Hide ${title} sidebar`}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        <nav className="space-y-1">
          {tabs.map((tab) => {
            const active = isTabActive(currentPath, tab.href);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={cn(
                  "flex min-h-11 items-center rounded-2xl border px-4 py-3 text-sm font-medium transition",
                  active
                    ? "app-accent-text border-transparent bg-[var(--app-accent-soft)]"
                    : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
