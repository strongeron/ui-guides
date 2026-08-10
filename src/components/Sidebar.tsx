import { useEffect, useRef, useCallback, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { categories } from '../data/principles';
import { Principle, PrincipleCategory, PatternSource } from '../types/principle';
import { Button } from '@/components/ui/button';
import { principlePath, shouldInterceptClick } from '@/lib/routes';
import { useMounted } from '@/hooks/useMounted';
import { FilterPopover } from './FilterPopover';
import { SIDEBAR_FOCUS_DELAY_MS, SIDEBAR_WIDTH_CLASS } from '@/constants/ui';
import { categoryIcons, fallbackCategoryIcon } from '@/constants/categories';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  principles: Principle[];
  currentPrincipleId: string;
  onPrincipleSelect: (principleId: string) => void;
  selectedSources: PatternSource[];
  onSourcesChange: (sources: PatternSource[]) => void;
  availableSources: PatternSource[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  /** Whether we're on a screen size where sidebar is always visible */
  isDesktop?: boolean;
}

export function Sidebar({
  isOpen,
  onClose,
  principles,
  currentPrincipleId,
  onPrincipleSelect,
  selectedSources,
  onSourcesChange,
  availableSources,
  selectedTags,
  onTagsChange,
  availableTags,
  isDesktop = false,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // Prerendered HTML carries only the current rule's category. All 404 links render at
  // 340 KB per page — 137 MB across the corpus — which is a lot of bytes for LCP and for
  // the build to earn back in internal linking. One category is ~6% of that, still gives
  // a crawler real links to follow, and the rest fill in on mount.
  const mounted = useMounted();
  const currentCategory = principles.find((p) => p.id === currentPrincipleId)?.category;
  // No current category means a non-rule route (/sources), where the page's own content
  // is what matters and a 340 KB nav would be pure weight. Ship none of it until mount.
  const visiblePrinciples = mounted
    ? principles
    : currentCategory
      ? principles.filter((p) => p.category === currentCategory)
      : [];

  // Filter principles by selected sources AND tags (empty selection = show all)
  const filteredPrinciples = visiblePrinciples.filter((p) => {
    const sourceOk = selectedSources.length === 0 || (p.source && selectedSources.includes(p.source));
    const tagOk = selectedTags.length === 0 || (p.tags?.some((t) => selectedTags.includes(t)) ?? false);
    return sourceOk && tagOk;
  });

  const groupedPrinciples = categories.reduce(
    (acc, category) => {
      acc[category.id] = filteredPrinciples.filter(
        (p) => p.category === category.id
      );
      return acc;
    },
    {} as Record<PrincipleCategory, Principle[]>
  );

  const handlePrincipleClick = (principleId: string) => {
    onPrincipleSelect(principleId);
    // Only close on mobile
    if (!isDesktop) {
      onClose();
    }
  };

  // Focus trap implementation (mobile only)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !sidebarRef.current || isDesktop) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = sidebarRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    },
    [isOpen, onClose, isDesktop]
  );

  // Manage focus when sidebar opens/closes (mobile only)
  useEffect(() => {
    // On desktop, sidebar is always visible - no focus management needed
    if (isDesktop) return;

    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus close button when sidebar opens
      setTimeout(() => closeButtonRef.current?.focus(), SIDEBAR_FOCUS_DELAY_MS);
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when sidebar is open
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      // Return focus to previous element
      previousActiveElement.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown, isDesktop]);

  // `inert` and `aria-hidden` are applied in an effect rather than during render.
  // They depend on isDesktop, which is unknowable on the server — setting them while
  // rendering would make the prerendered markup disagree with the client's first pass
  // and break hydration. Everything else about the drawer is expressed in CSS.
  const isVisible = isDesktop || isOpen;
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    if (isVisible) {
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    } else {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    }
  }, [isVisible]);

  return (
    <>
      {/* Overlay - mobile only. isOpen starts false everywhere, so this is SSR-safe. */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-overlay z-40 transition-opacity md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={`
          fixed top-14 bottom-0 ${SIDEBAR_WIDTH_CLASS} bg-background border-r border-border
          flex flex-col
          transition-[left] duration-300 ease-in-out
          z-50 shadow-2xl md:z-30 md:shadow-none
          ${isOpen ? 'left-0' : '-left-80'} md:left-0
        `}
        aria-label="Navigation menu"
      >
        {/* Mobile close button */}
        <div className="md:hidden shrink-0 flex items-center justify-between p-4 border-b border-border">
            <span className="text-sm font-medium text-foreground">Navigation</span>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close menu"
              className="h-8 w-8"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} />
            </Button>
        </div>

        {/* Consolidated source + tag filter */}
        <div className="shrink-0 p-4 border-b border-border">
          <FilterPopover
            selectedSources={selectedSources}
            onSourcesChange={onSourcesChange}
            availableSources={availableSources}
            selectedTags={selectedTags}
            onTagsChange={onTagsChange}
            availableTags={availableTags}
          />
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
          {filteredPrinciples.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">No rules match these filters</p>
              <p className="text-xs mt-1">Clear the source or tag filter to see all</p>
            </div>
          ) : (
            categories.map((category) => {
              const categoryPrinciples = groupedPrinciples[category.id];
              if (!categoryPrinciples?.length) return null;

              const isCollapsed = collapsedCategories.has(category.id);
              const CategoryIcon = categoryIcons[category.id] ?? fallbackCategoryIcon;

              return (
                <div key={category.id} className="border-b border-border">
                  {/* The opaque backdrop lives on the sticky wrapper, not the button: a
                      `hover:bg-*` on the button would REPLACE `bg-background` with a
                      translucent tint, letting the list scroll visibly through the header. */}
                  <div className="sticky top-0 z-10 bg-background">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      aria-expanded={!isCollapsed}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-foreground/[0.04] transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          size={12}
                          className={`text-muted-foreground shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                          aria-hidden="true"
                        />
                        <CategoryIcon className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider truncate">
                          {category.title}
                        </h3>
                      </span>
                      <span className="text-[11px] font-medium tabular-nums rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                        {categoryPrinciples.length}
                      </span>
                    </button>
                  </div>
                  {!isCollapsed && (
                    <ul>
                      {categoryPrinciples.map((principle) => (
                        <li key={principle.id}>
                          <Button
                            variant="ghost"
                            asChild
                            className={`w-full justify-start rounded-none pl-15 pr-4 py-2 h-auto text-sm text-left whitespace-normal leading-snug transition-colors hover:bg-foreground/[0.06] dark:hover:bg-foreground/[0.06] hover:text-foreground focus-visible:border-transparent focus-visible:ring-inset focus-visible:ring-foreground/25 ${
                              currentPrincipleId === principle.id
                                ? 'bg-foreground/10 text-foreground font-medium'
                                : 'text-foreground'
                            }`}
                          >
                            {/* A real href, so a crawler can follow it and ⌘-click works;
                                the handler intercepts plain left-clicks for client nav. */}
                            <a
                              href={principlePath(principle.id)}
                              aria-current={
                                currentPrincipleId === principle.id ? 'page' : undefined
                              }
                              onClick={(e) => {
                                if (!shouldInterceptClick(e)) return;
                                e.preventDefault();
                                handlePrincipleClick(principle.id);
                              }}
                            >
                              {principle.title}
                            </a>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}

        </nav>
      </aside>
    </>
  );
}
