import {
  EDGE_CARD_CLEARANCE,
  EDGE_CROSS_PENALTY,
  EDGE_LANE_SAMPLES,
  EDGE_MAX_DETOUR,
  EDGE_SHARE_PENALTY,
  EDGE_STUB,
  LANE_PITCH,
  LANE_SHARE_MARGIN,
} from "./constants";

/**
 * Where every edge's vertical trunk goes, decided for the whole diagram at once
 * rather than one edge at a time.
 *
 * `RelationshipEdge` can only ever see its own two anchors, so on a dense
 * diagram it makes two mistakes it has no way to notice: a dozen edges between
 * the same two clusters all derive nearly the same bend and collapse into one
 * grey slab, and every trunk is drawn straight through whichever cards happen
 * to lie between the endpoints. Both are decisions about the *set* of edges,
 * which is why they are made here and handed down as a number.
 *
 * Pure, and deterministic to the pixel: the search runs in id order and reads
 * no clock, no randomness and no previous result, so two collaborators looking
 * at the same tables route them the same way.
 */

/** One end of an edge: the anchor point, and the flank it leaves from. */
export type EdgeEnd = {
  x: number;
  y: number;
  /** Outward normal of the card edge: 1 right, -1 left. */
  direction: number;
  tableId: string;
};

export type EdgeInput = { id: string; from: EdgeEnd; to: EdgeEnd };

export type Obstacle = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * The bend `RelationshipEdge` would pick on its own: past both stubs, halfway
 * between them when the cards face each other and beyond the further one when
 * both ends leave on the same flank. Every routed edge is scored against this,
 * so an edge with nothing in its way stays exactly where it is today.
 */
export const idealBend = (from: EdgeEnd, to: EdgeEnd) => {
  const fromStub = from.x + from.direction * EDGE_STUB;
  const toStub = to.x + to.direction * EDGE_STUB;
  if (from.direction !== to.direction) return (fromStub + toStub) / 2;
  return from.direction === 1
    ? Math.max(fromStub, toStub)
    : Math.min(fromStub, toStub);
};

/**
 * How far the trunk may be moved. Facing anchors bound it on both sides -- the
 * corridor between the two cards is the only place a bend belongs. Anchors
 * leaving the same flank are open on one side, so the detour is capped instead:
 * a trunk that wanders further than this to dodge a card has stopped being
 * easier to read than the card it crossed.
 */
const bendRange = (from: EdgeEnd, to: EdgeEnd): [number, number] => {
  const fromStub = from.x + from.direction * EDGE_STUB;
  const toStub = to.x + to.direction * EDGE_STUB;
  if (from.direction !== to.direction)
    return [Math.min(fromStub, toStub), Math.max(fromStub, toStub)];
  const outer =
    from.direction === 1
      ? Math.max(fromStub, toStub)
      : Math.min(fromStub, toStub);
  return from.direction === 1
    ? [outer, outer + EDGE_MAX_DETOUR]
    : [outer - EDGE_MAX_DETOUR, outer];
};

const spans = (a: number, b: number) =>
  ([Math.min(a, b), Math.max(a, b)] as const);

const overlaps = (a: readonly [number, number], b: readonly [number, number]) =>
  a[0] < b[1] && b[0] < a[1];

/**
 * Whether two trunks in the same lane would read as one line. Bands that merely
 * touch still do -- two edges meeting end to end at the same x draw a single
 * unbroken stroke -- so the test is loosened by a margin rather than left strict.
 */
const shares = (a: readonly [number, number], b: readonly [number, number]) =>
  a[0] < b[1] + LANE_SHARE_MARGIN && b[0] < a[1] + LANE_SHARE_MARGIN;

export function routeEdges(edges: EdgeInput[], obstacles: Obstacle[]) {
  const routed = new Map<string, number>();
  /** Trunks already placed, by lane, so a later edge can see what it would sit on. */
  const taken = new Map<number, [number, number][]>();
  // Id order, never input order: the map has to be identical on every client.
  [...edges]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .forEach((edge) => {
      const { from, to } = edge;
      const ideal = idealBend(from, to);
      const band = spans(from.y, to.y);
      const [low, high] = bendRange(from, to);
      // Only the cards the trunk could actually run into, and never the two it
      // is attached to.
      const blocking = obstacles
        .filter(
          (box) =>
            box.id !== from.tableId &&
            box.id !== to.tableId &&
            overlaps(band, [box.y, box.y + box.height]),
        )
        .map(
          (box) =>
            [
              box.x - EDGE_CARD_CLEARANCE,
              box.x + box.width + EDGE_CARD_CLEARANCE,
            ] as [number, number],
        );
      const width = high - low;
      // A corridor narrower than one lane has nothing to choose between.
      if (width < LANE_PITCH) {
        routed.set(edge.id, ideal);
        return;
      }
      // Sampling rather than sweeping keeps a canvas-wide corridor as cheap as
      // a narrow one; the step only ever grows past a lane, never shrinks.
      const step = Math.max(LANE_PITCH, width / EDGE_LANE_SAMPLES);
      const count = Math.floor(width / step);
      let bestX = ideal;
      let bestCost = Infinity;
      for (let index = 0; index <= count; index += 1) {
        const x = low + index * step;
        const crossings = blocking.filter(
          (box) => x > box[0] && x < box[1],
        ).length;
        const lane = Math.round(x / LANE_PITCH);
        const shared = (taken.get(lane) ?? []).filter((other) =>
          shares(band, other),
        ).length;
        const cost =
          crossings * EDGE_CROSS_PENALTY +
          shared * EDGE_SHARE_PENALTY +
          Math.abs(x - ideal);
        // Strictly less: ties go to the earlier sample, and the samples run
        // low to high, so an equal-cost choice is never coin-flipped.
        if (cost < bestCost) {
          bestCost = cost;
          bestX = x;
        }
      }
      const lane = Math.round(bestX / LANE_PITCH);
      taken.set(lane, [...(taken.get(lane) ?? []), [band[0], band[1]]]);
      routed.set(edge.id, bestX);
    });
  return routed;
}
