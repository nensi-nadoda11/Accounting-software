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
      <div className="w-full lg:sticky lg:top-4 lg:w-auto lg:flex-none lg:self-start">
        <Button type="button" variant="secondary" className="rounded-2xl" onClick={onToggle}>
          <ChevronRight className="mr-2 size-4" />
          Show {title}
        </Button>
      </div>
    );
  }

  return (
    <aside className="w-full lg:sticky lg:top-4 lg:h-[calc(100svh-5.5rem)] lg:w-64 lg:flex-none lg:self-start">
      <div className="app-sidebar-surface rounded-3xl border p-4 shadow-sm lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--app-shell-border)] pb-3">
          <p className="app-shell-text text-base font-semibold">{title}</p>
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

        <nav className="app-hide-scrollbar space-y-1 overscroll-contain lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
          {tabs.map((tab) => {
            const active = isTabActive(currentPath, tab.href);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={cn(
                  "app-sidebar-link flex min-h-11 items-center rounded-2xl border px-4 py-3 text-sm font-medium transition",
                  active
                    ? "app-sidebar-link-active"
                    : "border-transparent",
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
