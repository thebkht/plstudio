"use client";

import {
  memo,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTransformControls } from "@/app/hooks";
import {
  GROUP_PALETTE,
  tableHeight,
  type CardStyle,
  tableWidth,
  type Memo,
  type SchemaGroup,
  type Table,
} from "@/app/lib/schema";
import { MEMO_COLORS } from "../constants";

/** The map's box, in screen pixels. */
const WIDTH = 200;
const HEIGHT = 136;
/** Canvas-space margin, so a card on the edge of the diagram is not flush with the map's. */
const MARGIN = 120;
/** A table's accent strip and corner, in screen pixels: at map scale the card's own 7px strip is a sliver. */
const STRIP = 2.5;
const CORNER = 1.5;

type Box = { x: number; y: number; width: number; height: number };

/**
 * The whole diagram in a corner, with the visible part outlined.
 *
 * Drawn from *committed* geometry only -- it takes `schema` arrays, never
 * `dragPosition` -- so a drag re-renders it zero times and a card snaps to its
 * new spot on the map when the drop commits. The viewport outline never
 * re-renders at all: it is positioned in CSS from the `--pan-x`/`--pan-y`/
 * `--inverse-zoom` properties `applyViewport` writes on `.canvas-wrap`, which
 * this sits inside, so a pan or a zoom moves it for free.
 */
function MinimapComponent({
  tables,
  groups,
  memos,
  cardStyle,
}: {
  tables: Table[];
  cardStyle: CardStyle;
  /** Passed as they sit on the schema, possibly absent: a fresh `[]` per render would defeat `memo`. */
  groups: SchemaGroup[] | undefined;
  memos: Memo[] | undefined;
}) {
  const { applyViewport, setPan, stopAnimation, panRef, zoomRef, viewportRef } =
    useTransformControls();
  const rootRef = useRef<HTMLDivElement>(null);

  const boxes: (Box & { fill: string; kind: string })[] = [
    ...(groups ?? []).map((group) => ({ ...group, fill: GROUP_PALETTE[group.color].border, kind: "group" })),
    ...(memos ?? []).map((item) => ({ ...item, fill: (MEMO_COLORS.find((color) => color.id === item.color) ?? MEMO_COLORS[0]).border, kind: "memo" })),
    ...tables.map((table) => ({ x: table.x, y: table.y, width: tableWidth(table), height: tableHeight(table, cardStyle), fill: table.color.a, kind: "table" })),
  ];
  const edge = (pick: (box: Box) => number, pickEnd: (box: Box) => number) =>
    boxes.length ? [Math.min(...boxes.map(pick)), Math.max(...boxes.map(pickEnd))] : [0, 0];
  const [left, right] = edge((box) => box.x, (box) => box.x + box.width);
  const [top, bottom] = edge((box) => box.y, (box) => box.y + box.height);
  const minX = left - MARGIN;
  const minY = top - MARGIN;
  const worldWidth = right + MARGIN - minX;
  const worldHeight = bottom + MARGIN - minY;
  const scale = Math.min(WIDTH / worldWidth, HEIGHT / worldHeight);
  // Letterboxed, so the diagram keeps its aspect ratio in the map.
  const offsetX = (WIDTH - worldWidth * scale) / 2;
  const offsetY = (HEIGHT - worldHeight * scale) / 2;

  /*
   * The canvas frame's size, for the outline's width and height. Only a resize
   * changes it, so it is observed rather than read per frame -- and written as
   * a custom property, like the camera, so it costs no render either.
   */
  useLayoutEffect(() => {
    // Found from the map's own node: a child's layout effect can run before
    // the parent's ref is attached, so `viewportRef` may still be empty here.
    const root = rootRef.current;
    const frame = root?.closest<HTMLElement>(".canvas-wrap");
    if (!frame || !root) return;
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty("--wrap-w", `${entry.contentRect.width}px`);
      root.style.setProperty("--wrap-h", `${entry.contentRect.height}px`);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  /** Canvas point under a pointer on the map. */
  const toCanvas = (event: { clientX: number; clientY: number }) => {
    const rect = rootRef.current!.getBoundingClientRect();
    return {
      x: minX + (event.clientX - rect.left - offsetX) / scale,
      y: minY + (event.clientY - rect.top - offsetY) / scale,
    };
  };
  /** Centre the view on the point under the pointer: live, no render. */
  const centreOn = (event: { clientX: number; clientY: number }) => {
    const frame = viewportRef.current;
    if (!frame) return;
    const point = toCanvas(event);
    const zoom = zoomRef.current;
    applyViewport(
      { x: frame.clientWidth / 2 - point.x * zoom, y: frame.clientHeight / 2 - point.y * zoom },
      zoom,
    );
  };

  const draggingRef = useRef(false);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // The map is chrome over the canvas: its presses must not pan or marquee it.
    event.stopPropagation();
    event.preventDefault();
    stopAnimation();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    centreOn(event);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (draggingRef.current) centreOn(event);
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!draggingRef.current) return;
    draggingRef.current = false;
    // Committed once, on release -- the same settle rule every camera gesture follows.
    setPan(panRef.current);
  };

  return (
    <div
      ref={rootRef}
      className="minimap"
      role="img"
      aria-label="Diagram overview. Click or drag to move the view."
      style={
        {
          width: WIDTH,
          height: HEIGHT,
          "--mm-scale": scale,
          "--mm-x": `${offsetX - minX * scale}px`,
          "--mm-y": `${offsetY - minY * scale}px`,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <svg width={WIDTH} height={HEIGHT} aria-hidden="true">
        <g transform={`translate(${offsetX - minX * scale} ${offsetY - minY * scale}) scale(${scale})`}>
          {/* A table is drawn as the card it is -- white, a hairline, its colour
              on a strip -- the way the dashboard previews draw it. Filled solid,
              a dark-coloured table became the loudest thing in the corner and
              the map read as swatches rather than as the diagram. */}
          {boxes.map((box, index) =>
            box.kind === "table" ? (
              <g key={index}>
                <rect className="minimap-table" x={box.x} y={box.y} width={box.width} height={box.height} rx={CORNER / scale} vectorEffect="non-scaling-stroke" />
                <rect x={box.x} y={box.y} width={box.width} height={Math.min(STRIP / scale, box.height)} rx={CORNER / scale} fill={box.fill} />
              </g>
            ) : (
              <rect key={index} className={`minimap-${box.kind}`} x={box.x} y={box.y} width={box.width} height={box.height} fill={box.fill} />
            ),
          )}
        </g>
      </svg>
      <div className="minimap-viewport" aria-hidden="true" />
    </div>
  );
}

export const Minimap = memo(MinimapComponent);
