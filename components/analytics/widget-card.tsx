"use client";

import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, Eye, EyeOff, GripVertical, Maximize2, MoreHorizontal, Settings2, Trash2, Columns2, RectangleHorizontal } from "lucide-react";
import type { WidgetId, WidgetSettings } from "@/lib/analytics-layout";

export interface WidgetActions {
  configure: () => void;
  expand: () => void;
  download: () => void;
  remove: () => void;
  move: (offset: -1 | 1) => void;
  update: (patch: Partial<WidgetSettings>) => void;
}

interface Props {
  settings: WidgetSettings;
  title: string;
  subtitle: ReactNode;
  tools?: ReactNode;
  actions: WidgetActions;
  isFirst: boolean;
  isLast: boolean;
  canDownload: boolean;
  dragging: WidgetId | null;
  onDragStart: (id: WidgetId) => void;
  onDragEnd: () => void;
  onDrop: (target: WidgetId, after: boolean) => void;
  children: ReactNode;
}

export function WidgetCard({ settings, title, subtitle, tools, actions, isFirst, isLast, canDownload, dragging, onDragStart, onDragEnd, onDrop, children }: Props) {
  const [draggable, setDraggable] = useState(false);
  const [dropSide, setDropSide] = useState<"before" | "after" | null>(null);
  const titleId = useId();

  function side(event: DragEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return event.clientY > box.top + box.height / 2 ? "after" : "before";
  }

  return <article
    className={`widget ${settings.size}${dragging === settings.id ? " is-dragging" : ""}${dropSide ? ` drop-${dropSide}` : ""}`}
    aria-labelledby={titleId}
    draggable={draggable}
    onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", settings.id); onDragStart(settings.id); }}
    onDragEnd={() => { setDraggable(false); setDropSide(null); onDragEnd(); }}
    onDragOver={(event) => { if (!dragging || dragging === settings.id) return; event.preventDefault(); setDropSide(side(event)); }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropSide(null); }}
    onDrop={(event) => { event.preventDefault(); const after = side(event) === "after"; setDropSide(null); if (dragging && dragging !== settings.id) onDrop(settings.id, after); }}>
    <header className="widget-head">
      <button type="button" className="widget-grip" aria-label={`Reorder ${title}. Drag, or use the menu to move it.`} title="Drag to reorder"
        onPointerDown={() => setDraggable(true)} onPointerUp={() => setDraggable(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" && !isFirst) { event.preventDefault(); actions.move(-1); }
          if (event.key === "ArrowDown" && !isLast) { event.preventDefault(); actions.move(1); }
        }}>
        <GripVertical size={16} aria-hidden />
      </button>
      <div className="widget-title"><h2 id={titleId}>{title}</h2><p>{subtitle}</p></div>
      <div className="widget-tools">{tools}<WidgetMenu title={title} settings={settings} actions={actions} isFirst={isFirst} isLast={isLast} canDownload={canDownload} /></div>
    </header>
    <div className="widget-body">{children}</div>
  </article>;
}

function WidgetMenu({ title, settings, actions, isFirst, isLast, canDownload }: { title: string; settings: WidgetSettings; actions: WidgetActions; isFirst: boolean; isLast: boolean; canDownload: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const onPointer = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    trigger.current?.focus();
    action();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const items = [...(wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
    else if (event.key === "Home") { event.preventDefault(); items[0]?.focus(); }
    else if (event.key === "End") { event.preventDefault(); items.at(-1)?.focus(); }
    else if (event.key === "Tab") setOpen(false);
  }

  return <div className="menu-wrap" ref={wrap} onKeyDown={open ? onKeyDown : undefined}>
    <button ref={trigger} type="button" className="icon-button widget-menu-button" aria-label={`${title} options`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(!open)}><MoreHorizontal size={18} /></button>
    {open && <div className="dropdown widget-menu" role="menu" id={menuId} aria-label={`${title} options`}>
      <button type="button" role="menuitem" onClick={() => run(actions.configure)}><Settings2 size={15} aria-hidden /> Configure chart</button>
      <button type="button" role="menuitem" onClick={() => run(actions.expand)}><Maximize2 size={15} aria-hidden /> Expand chart</button>
      <button type="button" role="menuitem" disabled={!canDownload} onClick={() => run(actions.download)}><Download size={15} aria-hidden /> Download data (CSV)</button>
      <span className="menu-divider" role="separator" />
      <button type="button" role="menuitem" onClick={() => run(() => actions.update({ showLegend: !settings.showLegend }))}>{settings.showLegend ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />} {settings.showLegend ? "Hide legend" : "Show legend"}</button>
      <button type="button" role="menuitem" onClick={() => run(() => actions.update({ size: settings.size === "full" ? "half" : "full" }))}>{settings.size === "full" ? <Columns2 size={15} aria-hidden /> : <RectangleHorizontal size={15} aria-hidden />} {settings.size === "full" ? "Half width" : "Full width"}</button>
      <button type="button" role="menuitem" disabled={isFirst} onClick={() => run(() => actions.move(-1))}><ArrowUp size={15} aria-hidden /> Move earlier</button>
      <button type="button" role="menuitem" disabled={isLast} onClick={() => run(() => actions.move(1))}><ArrowDown size={15} aria-hidden /> Move later</button>
      <span className="menu-divider" role="separator" />
      <button type="button" role="menuitem" className="danger-item" onClick={() => run(actions.remove)}><Trash2 size={15} aria-hidden /> Remove from dashboard</button>
    </div>}
  </div>;
}
