"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";
import type { Graph } from "@/lib/til";

type SimNode = SimulationNodeDatum & {
  id: string;
  title: string;
  tags: string[];
  degree: number;
};

type SimLink = {
  source: string | SimNode;
  target: string | SimNode;
};

const TAG_COLORS: Record<string, string> = {
  git: "#e0725a",
  css: "#5aa9e6",
  cli: "#7bc17e",
  terminal: "#7bc17e",
  postgres: "#b18cf0",
  databases: "#b18cf0",
  regex: "#e0b25a",
};

function colorForTags(tags: string[]) {
  for (const t of tags) if (TAG_COLORS[t]) return TAG_COLORS[t];
  return "#9c9a92";
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export default function KnowledgeGraph({ graph }: { graph: Graph }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dims, setDims] = useState({ w: 900, h: 560 });
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode, SimLink>> | null>(null);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setDims({ w: Math.max(320, box.width), h: Math.max(420, box.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const simNodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = graph.edges.map((e) => ({ ...e }));

    const sim = forceSimulation<SimNode, SimLink>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120)
          .strength(0.5)
      )
      .force("charge", forceManyBody().strength(-260))
      .force("center", forceCenter(dims.w / 2, dims.h / 2))
      .force("collide", forceCollide().radius(46))
      .stop();

    for (let i = 0; i < 300; i++) sim.tick();
    simRef.current = sim;
    setNodes([...simNodes]);
    setLinks([...simLinks]);
    setView({ x: 0, y: 0, k: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, dims.w, dims.h]);

  const nodeById = useMemo(() => {
    const m = new Map<string, SimNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const connectedIds = useMemo(() => {
    if (!hovered) return null;
    const s = new Set<string>([hovered]);
    links.forEach((l) => {
      const a = typeof l.source === "string" ? l.source : l.source.id;
      const b = typeof l.target === "string" ? l.target : l.target.id;
      if (a === hovered) s.add(b);
      if (b === hovered) s.add(a);
    });
    return s;
  }, [hovered, links]);

  // --- zoom helpers -------------------------------------------------

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // convert screen point to svg viewBox units
    const px = ((clientX - rect.left) / rect.width) * dims.w;
    const py = ((clientY - rect.top) / rect.height) * dims.h;
    setView((prev) => {
      const nextK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.k * factor));
      const scale = nextK / prev.k;
      return {
        k: nextK,
        x: px - (px - prev.x) * scale,
        y: py - (py - prev.y) * scale,
      };
    });
  }, [dims.w, dims.h]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAt(e.clientX, e.clientY, factor);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function zoomButton(factor: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  function resetView() {
    setView({ x: 0, y: 0, k: 1 });
  }

  // --- panning (background drag) ------------------------------------

  const panState = useRef<{ active: boolean } | null>(null);

  function handleBackgroundPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.target !== svgRef.current) return; // only when clicking empty canvas
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = view.x;
    const oy = view.y;
    panState.current = { active: true };

    const onMove = (ev: PointerEvent) => {
      if (!panState.current?.active) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((ev.clientX - startX) / rect.width) * dims.w;
      const dy = ((ev.clientY - startY) / rect.height) * dims.h;
      setView((v) => ({ ...v, x: ox + dx, y: oy + dy }));
    };
    const onUp = () => {
      panState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // --- node dragging (graph-space aware) -----------------------------

  const draggedRef = useRef(false);

  function handleNodeDrag(node: SimNode, e: React.PointerEvent<SVGGElement>) {
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const startX = e.clientX;
    const startY = e.clientY;
    draggedRef.current = false;
    node.fx = node.x;
    node.fy = node.y;

    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) {
        draggedRef.current = true;
      }
      const rect = svg.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / rect.width) * dims.w;
      const sy = ((ev.clientY - rect.top) / rect.height) * dims.h;
      // invert current pan/zoom to get graph-space coords
      node.fx = (sx - view.x) / view.k;
      node.fy = (sy - view.y) / view.k;
      node.x = node.fx;
      node.y = node.fy;
      simRef.current?.alpha(0.15).tick();
      setNodes((prev) => [...prev]);
    };
    const onUp = () => {
      node.fx = null;
      node.fy = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleClick(slug: string) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    router.push(`/til/${slug}`);
  }

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={handleBackgroundPointerDown}
      >
        <defs>
          <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
          {/* edges */}
          <g>
            {links.map((l, i) => {
              const s = typeof l.source === "string" ? nodeById.get(l.source) : (l.source as SimNode);
              const t = typeof l.target === "string" ? nodeById.get(l.target) : (l.target as SimNode);
              if (!s || !t || s.x == null || t.x == null) return null;
              const active = connectedIds && connectedIds.has(s.id) && connectedIds.has(t.id);
              const dim = connectedIds && !active;
              return (
                <line
                  key={i}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={active ? "#e0b25a" : "#5c5a52"}
                  strokeWidth={active ? 1.4 : 0.8}
                  opacity={dim ? 0.12 : active ? 0.85 : 0.35}
                />
              );
            })}
          </g>

          {/* nodes */}
          <g>
            {nodes.map((n) => {
              if (n.x == null || n.y == null) return null;
              const dim = connectedIds && !connectedIds.has(n.id);
              const isHovered = hovered === n.id;
              const color = colorForTags(n.tags);
              const r = 5 + Math.min(n.degree, 8) * 1.4;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  className="cursor-pointer"
                  opacity={dim ? 0.15 : 1}
                  onPointerDown={(e) => handleNodeDrag(n, e)}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleClick(n.id)}
                >
                  <circle
                    r={r}
                    fill={color}
                    filter={isHovered ? "url(#nodeGlow)" : undefined}
                    stroke={isHovered ? "#f3e9d2" : "none"}
                    strokeWidth={isHovered ? 1.5 : 0}
                  />
                  <text
                    x={r + 6}
                    y={4}
                    fontFamily="var(--font-mono)"
                    fontSize={11}
                    fill={isHovered ? "#f3e9d2" : "#c9c6ba"}
                    style={{ pointerEvents: "none" }}
                  >
                    {n.title.length > 42 ? n.title.slice(0, 40) + "…" : n.title}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* zoom controls, obsidian-style */}
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-sm border border-cork-light/70 bg-cork-dark/90 font-mono text-sm text-card shadow-lg">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomButton(1.3)}
          className="h-8 w-8 border-b border-cork-light/70 hover:bg-cork-light/40"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomButton(1 / 1.3)}
          className="h-8 w-8 border-b border-cork-light/70 hover:bg-cork-light/40"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset view"
          onClick={resetView}
          className="h-8 w-8 text-xs hover:bg-cork-light/40"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
