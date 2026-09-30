import { describe, expect, it } from "vitest";
import {
  fanPorts,
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

describe("fanPorts", () => {
  /** Three keys landing on one row of the right-hand card, as in a hub table. */
  const port = (id: string, fromY: number, bendX: number) => ({ edge: { id, from: end(100, fromY, 1, `t-${id}`), to: end(900, 400, -1, "hub") }, bendX });
  const fanOf = (entries: ReturnType<typeof port>[]) => {
    const bends = new Map(entries.map(({ edge, bendX }) => [edge.id, bendX]));
    return new Map(fanPorts(entries.map(({ edge }) => edge), (edge) => bends.get(edge.id)!).map((edge) => [edge.id, edge]));
  };

  it("leaves an unshared port exactly where it was", () => {
    const fanned = fanOf([port("a", 100, 500)]);
    expect(fanned.get("a")!.to).toMatchObject({ y: 400, markerShift: 0 });
  });

  it("gives every edge on a shared port its own row, centred on the anchor", () => {
    const ys = [...fanOf([port("a", 100, 500), port("b", 120, 860), port("c", 700, 600)]).values()].map((edge) => edge.to.y).sort((a, b) => a - b);
    expect(ys).toEqual([392, 400, 408]);
  });

  it("puts the nearer trunk from above on top, so the farther run passes under its turn", () => {
    const fanned = fanOf([port("far", 100, 500), port("near", 120, 860)]);
    expect(fanned.get("near")!.to.y).toBeLessThan(fanned.get("far")!.to.y);
  });

  it("puts the nearer trunk from below at the bottom, mirroring the edges from above", () => {
    const fanned = fanOf([port("far", 700, 500), port("near", 720, 860)]);
    expect(fanned.get("near")!.to.y).toBeGreaterThan(fanned.get("far")!.to.y);
  });

  it("orders edges from above before edges from below", () => {
    const fanned = fanOf([port("below", 700, 860), port("above", 100, 500)]);
    expect(fanned.get("above")!.to.y).toBeLessThan(fanned.get("below")!.to.y);
  });

  it("keeps a crowded port inside its row", () => {
    const entries = Array.from({ length: 7 }, (_, index) => port(`e${index}`, 100 + index, 300 + index * 40));
    const ys = [...fanOf(entries).values()].map((edge) => edge.to.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(36 - 12);
  });

  it("steps neighbouring pills apart along the line, never past the bend", () => {
    const fanned = fanOf([port("far", 100, 500), port("near", 120, 860)]);
    const shifts = [fanned.get("near")!.to.markerShift, fanned.get("far")!.to.markerShift];
    expect(shifts).toContain(0);
    // "near" turns 40px out of the card: no room to step its pill further along.
    expect(fanned.get("near")!.to.markerShift).toBe(0);
    expect(fanned.get("far")!.to.markerShift).toBe(26);
  });

  it("is independent of input order", () => {
    const entries = [port("a", 100, 500), port("b", 120, 860), port("c", 700, 600)];
    const forward = fanOf(entries);
    const backward = fanOf([...entries].reverse());
    entries.forEach(({ edge }) => expect(backward.get(edge.id)).toEqual(forward.get(edge.id)));
  });
});
