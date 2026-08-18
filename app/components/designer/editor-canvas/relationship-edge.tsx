"use client";

import { memo } from "react";
import { MARKER_DISTANCE } from "../constants";

/**
 * One relationship as SVG. Up to nine nodes per edge and a nine-command path
 * string, so on a busy diagram this is most of what the canvas reconciles.
 *
 * Every prop is a number, a string or a boolean, which is the point: dragging a
 * table moves two anchors, and memo lets every other edge skip re-rendering
 * rather than rebuilding an identical path.
 */

/**
 * SVG text cannot ellipsize in CSS, and generated FK names run long enough to
 * cross the tables they connect. The full name stays in the Relationships panel.
 */
const ellipsize = (text: string, max = 30) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

export type EdgeAnchor = {
  x: number;
  y: number;
  /** Outward normal of the card edge the line leaves from: 1 right, -1 left. */
  direction: number;
};

export const RelationshipEdge = memo(function RelationshipEdge({
  fromX,
  fromY,
  fromDirection,
  toX,
  toY,
  toDirection,
  bendX,
  fromCardinality,
  toCardinality,
  label,
  active,
  showCardinality,
  showLabel,
}: {
  fromX: number;
  fromY: number;
  fromDirection: number;
  toX: number;
  toY: number;
  toDirection: number;
  /** Where the vertical trunk runs, decided across the whole diagram by
   *  `routeEdges` so the trunks fan into lanes instead of stacking. */
  bendX: number;
  fromCardinality: string;
  toCardinality: string;
  label: string;
  active: boolean;
  showCardinality: boolean;
  showLabel: boolean;
}) {
  const deltaY = toY - fromY;
  // Every edge leaves its anchor sideways and runs clear of the card before it
  // turns, so the line always emerges from the column's own edge and passes
  // through that end's marker. Where it then turns is `bendX`, which is not
  // this edge's to decide: a bend that reads well is one no other trunk and no
  // card is already sitting on, and only the router sees all of them.
  const exitDirection = Math.sign(bendX - fromX) || fromDirection;
  const enterDirection = Math.sign(toX - bendX) || toDirection;
  const verticalDirection = Math.sign(deltaY) || 1;
  const radius = Math.min(
    10,
    Math.abs(bendX - fromX) / 2,
    Math.abs(toX - bendX) / 2,
    Math.abs(deltaY) / 2,
  );
  // Facing anchors on the same row need no bend at all; the straight run
  // already passes through both markers.
  const path =
    Math.abs(deltaY) <= 4 && fromDirection !== toDirection
      ? `M ${fromX} ${fromY} L ${toX} ${toY}`
      : `M ${fromX} ${fromY} H ${bendX - exitDirection * radius} Q ${bendX} ${fromY} ${bendX} ${fromY + verticalDirection * radius} V ${toY - verticalDirection * radius} Q ${bendX} ${toY} ${bendX + enterDirection * radius} ${toY} H ${toX}`;
  // The SVG paints before the cards, so the outward normal is the only
  // direction that clears the card a marker belongs to.
  const fromMarkerX = fromX + fromDirection * MARKER_DISTANCE;
  const toMarkerX = toX + toDirection * MARKER_DISTANCE;
  return (
    <g className="relationship">
      {/* Invisible fat stroke so the thin line is easy to hover. */}
      <path d={path} className="relationship-hit" />
      <path d={path} className={`relationship-path ${active ? "active" : ""}`} />
      {showCardinality && (
        <>
          <rect className="relationship-marker" x={fromMarkerX - 14} y={fromY - 12} width="28" height="24" rx="12" />
          <text className="relationship-marker-text" x={fromMarkerX} y={fromY}>{fromCardinality}</text>
          <rect className="relationship-marker" x={toMarkerX - 14} y={toY - 12} width="28" height="24" rx="12" />
          <text className="relationship-marker-text" x={toMarkerX} y={toY}>{toCardinality}</text>
        </>
      )}
      {/* On the bend, not between the anchors: the midpoint of a C-shaped route
          lands nowhere near the line. */}
      {showLabel && (
        <text className="relationship-label" x={bendX} y={(fromY + toY) / 2} textAnchor="middle">
          <title>{label}</title>
          {ellipsize(label)}
        </text>
      )}
    </g>
  );
});
