import {
  EDGE_CARD_CLEARANCE,
  EDGE_CROSS_PENALTY,
  EDGE_LANE_SAMPLES,
  EDGE_MAX_DETOUR,
  EDGE_SHARE_PENALTY,
  EDGE_STUB,
  LANE_PITCH,
  LANE_SHARE_MARGIN,
  MARKER_DISTANCE,
  PORT_MARKER_STEP,
  PORT_PITCH,
  PORT_ROW_MARGIN,
  ROW_HEIGHT,
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

/** An end after fanning: nudged within its row, and how far its pill steps out. */
export type FannedEnd = EdgeEnd & { markerShift: number };
export type FannedEdge = { id: string; from: FannedEnd; to: FannedEnd };

/**
 * Edges that land on the same port -- one row, one flank of one card -- would
 * otherwise run their last stretch on the same pixel row and read as a single
 * line with three meanings (a composite key anchors on its first column, so
 * this happens whenever two keys share a leading column with a plain one).
 * Each gets its own slot across the row instead.
 *
 * The order is what keeps the fan from crossing itself. An edge's last run is
 * horizontal, from its trunk to the port; a trunk coming down from above that
 * sits nearer the card must end *above* the farther ones, so their runs pass
 * beneath the corner where it turns rather than through its trunk. Edges from
 * below are the mirror image, and a straight, bend-free edge takes the middle.
 *
 * Pure and deterministic: ties fall back to the edge id, as `routeEdges` does.
 */
export function fanPorts(edges: EdgeInput[], bendOf: (edge: EdgeInput) => number): FannedEdge[] {
  type Slot = { edge: EdgeInput; side: "from" | "to"; approach: number; reach: number };
  const ports = new Map<string, Slot[]>();
  edges.forEach((edge) => {
    const bend = bendOf(edge);
    (["from", "to"] as const).forEach((side) => {
      const own = edge[side];
      const other = edge[side === "from" ? "to" : "from"];
      const key = `${own.tableId}:${own.direction}:${Math.round(own.y)}`;
      // -1 arrives from above, 1 from below, 0 is a straight run across.
      const approach = Math.abs(other.y - own.y) <= 4 ? 0 : Math.sign(other.y - own.y);
      ports.set(key, [...(ports.get(key) ?? []), { edge, side, approach, reach: Math.abs(bend - own.x) }]);
    });
  });
  const nudged = new Map<string, { dy: number; shift: number }>();
  ports.forEach((slots) => {
    if (slots.length < 2) return;
    const pitch = Math.min(PORT_PITCH, (ROW_HEIGHT - 2 * PORT_ROW_MARGIN) / (slots.length - 1));
    // Two pills per step while they clear each other vertically, three once the pitch is too tight for that.
    const columns = pitch * 2 >= 16 ? 2 : 3;
    [...slots]
      .sort((a, b) =>
        a.approach - b.approach ||
        (a.approach < 0 ? a.reach - b.reach : b.reach - a.reach) ||
        (a.edge.id < b.edge.id ? -1 : a.edge.id > b.edge.id ? 1 : 0),
      )
      .forEach((slot, index) => {
        const room = Math.max(0, slot.reach - MARKER_DISTANCE - PORT_MARKER_STEP / 2);
        nudged.set(`${slot.edge.id}:${slot.side}`, {
          dy: (index - (slots.length - 1) / 2) * pitch,
          // Only as far as the straight run allows: past the bend the pill would float off its line.
          shift: Math.min((index % columns) * PORT_MARKER_STEP, room),
        });
      });
  });
  const fan = (edge: EdgeInput, side: "from" | "to"): FannedEnd => {
    const own = edge[side];
    const move = nudged.get(`${edge.id}:${side}`);
    return { ...own, y: own.y + (move?.dy ?? 0), markerShift: move?.shift ?? 0 };
  };
  return edges.map((edge) => ({ id: edge.id, from: fan(edge, "from"), to: fan(edge, "to") }));
}

/**
 * Which flank of a card an edge leaves from, before any hysteresis: toward the
 * other card when the two are clear of each other, and otherwise out whichever
 * side has the closer-aligned edges, so overlapping cards get a C-shaped route.
 * `relationshipPoint` adds the per-anchor memory on top; the image export,
 * which draws one still frame, uses this as it is.
 */
export const facingSide = (x: number, width: number, otherX: number, otherWidth: number): 1 | -1 => {
  const right = x + width;
  const otherRight = otherX + otherWidth;
  if (otherX >= right) return 1;
  if (otherRight <= x) return -1;
  return Math.abs(right - otherRight) <= Math.abs(x - otherX) ? 1 : -1;
};

/**
 * The path an edge draws: out of its anchor sideways, a rounded turn onto the
 * trunk at `bendX`, and in to the other anchor. Facing anchors on the same row
 * need no bend at all.
 */
export function edgePath(from: Omit<EdgeEnd, "tableId">, to: Omit<EdgeEnd, "tableId">, bendX: number) {
  const deltaY = to.y - from.y;
  if (Math.abs(deltaY) <= 4 && from.direction !== to.direction) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const exitDirection = Math.sign(bendX - from.x) || from.direction;
  const enterDirection = Math.sign(to.x - bendX) || to.direction;
  const verticalDirection = Math.sign(deltaY) || 1;
  const radius = Math.min(10, Math.abs(bendX - from.x) / 2, Math.abs(to.x - bendX) / 2, Math.abs(deltaY) / 2);
  return `M ${from.x} ${from.y} H ${bendX - exitDirection * radius} Q ${bendX} ${from.y} ${bendX} ${from.y + verticalDirection * radius} V ${to.y - verticalDirection * radius} Q ${bendX} ${to.y} ${bendX + enterDirection * radius} ${to.y} H ${to.x}`;
}

/** How far a curve's control points reach out of their cards, at the least. */
export const CURVE_MIN_REACH = 48;

/**
 * The document style's edge: one cubic out of each anchor along its flank's
 * normal, the way a printed ERD draws them. It needs no router -- a curve
 * crossing a card reads as passing over it, where a right-angled trunk reads
 * as running into it -- so it is a function of its two anchors alone.
 */
export function curvePath(from: Omit<EdgeEnd, "tableId">, to: Omit<EdgeEnd, "tableId">) {
  const reach = Math.max(CURVE_MIN_REACH, Math.abs(to.x - from.x) / 2);
  const r = (value: number) => Math.round(value * 100) / 100;
  return `M ${r(from.x)} ${r(from.y)} C ${r(from.x + from.direction * reach)} ${r(from.y)} ${r(to.x + to.direction * reach)} ${r(to.y)} ${r(to.x)} ${r(to.y)}`;
}

/**
 * Crow's-foot ends, drawn arriving at a card: +x points into it and the
 * reference point is its edge. `orient="auto-start-reverse"` turns the same
 * glyph round for the start of a path, so one definition serves both ends.
 * Shared by the canvas (as JSX) and the export (as a string).
 */
export const CROW_MARKER_SIZE = 12;
export const CROW_ONE = "M5 1 V11 M9 1 V11";
export const CROW_MANY = "M1 6 L12 1 M1 6 L12 11 M1 6 L12 6";
/** Which glyph a cardinality label ends in: `1` is one, anything else (n, m, 0..*) many. */
export const crowMarker = (label: string) => (label === "1" ? "one" : "many");
