import { describe, expect, it } from "vitest";
import {
  idealBend,
  routeEdges,
  type EdgeEnd,
  type EdgeInput,
  type Obstacle,
} from "@/app/components/designer/edge-routing";

const end = (x: number, y: number, direction: 1 | -1, tableId: string): EdgeEnd => ({
  x,
  y,
  direction,
  tableId,
});

const box = (id: string, x: number, y: number, width = 220, height = 200): Obstacle => ({
  id,
  x,
  y,
  width,
  height,
});

/** Two cards facing each other across a wide gap, with room for many lanes. */
const facing = (id: string, y: number): EdgeInput => ({
  id,
  from: end(300, y, 1, "left"),
  to: end(1200, y + 40, -1, "right"),
});

describe("idealBend", () => {
  it("puts facing anchors halfway between their stubs", () => {
    expect(idealBend(end(0, 0, 1, "a"), end(400, 0, -1, "b"))).toBe(200);
  });

  it("puts same-flank anchors past the further stub", () => {
    expect(idealBend(end(0, 0, 1, "a"), end(120, 0, 1, "b"))).toBe(164);
    expect(idealBend(end(0, 0, -1, "a"), end(120, 0, -1, "b"))).toBe(-44);
  });
});

describe("routeEdges", () => {
  it("leaves a lone edge with a clear run where it already was", () => {
    const edge = facing("r1", 100);
    const routed = routeEdges([edge], [box("left", 80, 40), box("right", 1200, 40)]);
    expect(routed.get("r1")).toBe(idealBend(edge.from, edge.to));
  });

  it("routes around a card standing in the trunk's way", () => {
    const edge = facing("r1", 100);
    // Straddles the ideal bend (750) and spans the edge's whole y-band.
    const blocker = box("mid", 700, 0, 220, 400);
    const routed = routeEdges([edge], [blocker]);
    const bend = routed.get("r1")!;
    // Either side of the card is a fine answer; through it is not.
    expect(bend <= blocker.x || bend >= blocker.x + blocker.width).toBe(true);
  });

  it("ignores the two cards the edge is attached to", () => {
    const edge = facing("r1", 100);
    const routed = routeEdges(
      [edge],
      [box("left", 80, 40, 220, 400), box("right", 1200, 40, 220, 400)],
    );
    expect(routed.get("r1")).toBe(idealBend(edge.from, edge.to));
  });

  it("gives overlapping trunks their own lanes", () => {
    const routed = routeEdges(
      [facing("r1", 100), facing("r2", 120), facing("r3", 140)],
      [],
    );
    expect(new Set([...routed.values()]).size).toBe(3);
  });

  it("lets trunks that never overlap vertically share a lane", () => {
    const routed = routeEdges(
      [facing("r1", 100), { ...facing("r2", 100), id: "r2" }],
      [],
    );
    const apart = routeEdges(
      [
        facing("r1", 100),
        {
          id: "r2",
          from: end(300, 4000, 1, "left"),
          to: end(1200, 4040, -1, "right"),
        },
      ],
      [],
    );
    // Same y-band: pushed apart. Disjoint bands: both sit on the ideal bend.
    expect(new Set([...routed.values()]).size).toBe(2);
    expect(new Set([...apart.values()]).size).toBe(1);
  });

  it("is stable under input order", () => {
    const edges = [facing("r1", 100), facing("r2", 120), facing("r3", 140)];
    const forward = routeEdges(edges, []);
    const backward = routeEdges([...edges].reverse(), []);
    expect([...forward.entries()].sort()).toEqual([...backward.entries()].sort());
  });

  it("falls back to the self-derived bend when there is no room to move", () => {
    // Anchors close enough that the corridor is narrower than one lane.
    const edge: EdgeInput = {
      id: "r1",
      from: end(300, 100, 1, "left"),
      to: end(384, 140, -1, "right"),
    };
    const routed = routeEdges([edge], [box("mid", 300, 0, 200, 400)]);
    expect(routed.get("r1")).toBe(idealBend(edge.from, edge.to));
  });

  it("caps how far a same-flank trunk will detour", () => {
    const edge: EdgeInput = {
      id: "r1",
      from: end(300, 100, 1, "left"),
      to: end(340, 600, 1, "left"),
    };
    // A wall wide enough that no lane in range clears it.
    const routed = routeEdges([edge], [box("wall", 0, 0, 4000, 900)]);
    const ideal = idealBend(edge.from, edge.to);
    expect(routed.get("r1")! - ideal).toBeLessThanOrEqual(320);
  });
});
