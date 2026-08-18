/**
 * A layered layout for the tidy command: tables that reference each other are
 * placed in ascending columns, and the order within a column is chosen to pull
 * the edges between two columns straight.
 *
 * Left to right rather than top to bottom, because that is the axis the canvas
 * already has an opinion about -- an edge only ever leaves a card's left or
 * right flank, so a child placed to the left of its parent joins it with one
 * horizontal run and no detour.
 *
 * Pure, and deterministic: every traversal, tie and sweep breaks on the node's
 * id, so the same graph lays out the same way on every client and a second tidy
 * changes nothing.
 */

export type LayoutBox = { id: string; width: number; height: number };
export type LayoutLink = { from: string; to: string };

/** Sorted, deduplicated, self-references and dangling ends dropped. */
const cleanLinks = (boxes: LayoutBox[], links: LayoutLink[]) => {
  const present = new Set(boxes.map((box) => box.id));
  const seen = new Set<string>();
  return links
    .filter(
      (link) =>
        link.from !== link.to &&
        present.has(link.from) &&
        present.has(link.to) &&
        !seen.has(`${link.from}>${link.to}`) &&
        seen.add(`${link.from}>${link.to}`) !== undefined,
    )
    .sort((a, b) =>
      a.from === b.from
        ? a.from < b.from
          ? -1
          : a.to < b.to
            ? -1
            : 1
        : a.from < b.from
          ? -1
          : 1,
    );
};

/**
 * The links, minus the ones that close a cycle. A schema is free to contain
 * them -- a parent table with a pointer back to its child is ordinary -- and a
 * layering cannot exist while one does, so the back edge is dropped for the
 * purpose of ordering only. Nothing about the relationship itself changes.
 */
function acyclic(ids: string[], links: LayoutLink[]) {
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  links.forEach((link) => out.get(link.from)!.push(link.to));
  const state = new Map<string, 0 | 1 | 2>();
  const kept: LayoutLink[] = [];
  const visit = (id: string) => {
    state.set(id, 1);
    (out.get(id) ?? []).forEach((to) => {
      // On the stack means this arc closes a loop back to where we came from.
      if (state.get(to) === 1) return;
      kept.push({ from: id, to });
      if (!state.get(to)) visit(to);
    });
    state.set(id, 2);
  };
  [...ids].sort().forEach((id) => {
    if (!state.get(id)) visit(id);
  });
  return kept;
}

/** Longest path from a root, so an arc always points one column onward. */
function layerOf(ids: string[], links: LayoutLink[]) {
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  links.forEach((link) => {
    out.get(link.from)!.push(link.to);
    indegree.set(link.to, indegree.get(link.to)! + 1);
  });
  const layer = new Map<string, number>(ids.map((id) => [id, 0]));
  const queue = [...ids].sort().filter((id) => indegree.get(id) === 0);
  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head];
    (out.get(id) ?? []).forEach((to) => {
      layer.set(to, Math.max(layer.get(to)!, layer.get(id)! + 1));
      indegree.set(to, indegree.get(to)! - 1);
      if (indegree.get(to) === 0) queue.push(to);
    });
  }
  return layer;
}

/** How many sweeps of the median heuristic to run. Past this it stops paying. */
const SWEEPS = 4;

/**
 * The median heuristic: a node moves to the middle of wherever its neighbours
 * in the adjacent column sit, and the sweep alternates direction so both ends
 * of an edge get their say. This is the step that actually removes crossings.
 */
function orderLayers(layers: string[][], links: LayoutLink[]) {
  const near = new Map<string, string[]>();
  links.forEach(({ from, to }) => {
    near.set(from, [...(near.get(from) ?? []), to]);
    near.set(to, [...(near.get(to) ?? []), from]);
  });
  const ordered = layers.map((layer) => [...layer]);
  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    const forward = sweep % 2 === 0;
    const steps = ordered.map((_, index) =>
      forward ? index : ordered.length - 1 - index,
    );
    steps.forEach((index) => {
      const anchor = ordered[forward ? index - 1 : index + 1];
      if (!anchor) return;
      const place = new Map(anchor.map((id, at) => [id, at]));
      const median = new Map(
        ordered[index].map((id, at) => {
          const spots = (near.get(id) ?? [])
            .map((other) => place.get(other))
            .filter((spot): spot is number => spot !== undefined)
            .sort((a, b) => a - b);
          // No neighbour in that column: stay put rather than drift to one end.
          return [id, spots.length ? spots[(spots.length - 1) >> 1] : at];
        }),
      );
      ordered[index] = [...ordered[index]].sort(
        (a, b) =>
          median.get(a)! - median.get(b)! || (a < b ? -1 : a > b ? 1 : 0),
      );
    });
  }
  return ordered;
}

/**
 * Where each box lands, in the order they were given -- the same shape the
 * shelf packer returns, so a caller can choose between them by the shape of
 * the bucket it is laying out.
 */
export function layeredPlaces(
  boxes: LayoutBox[],
  links: LayoutLink[],
  gap: number,
) {
  if (!boxes.length) return { places: [], width: 0, height: 0 };
  const ids = boxes.map((box) => box.id);
  const sized = new Map(boxes.map((box) => [box.id, box]));
  const kept = acyclic(ids, cleanLinks(boxes, links));
  const layer = layerOf(ids, kept);
  const depth = Math.max(...ids.map((id) => layer.get(id)!)) + 1;
  const layers = orderLayers(
    Array.from({ length: depth }, (_, index) =>
      [...ids].sort().filter((id) => layer.get(id) === index),
    ),
    kept,
  );
  const columnWidth = layers.map((column) =>
    Math.max(0, ...column.map((id) => sized.get(id)!.width)),
  );
  const columnHeight = layers.map(
    (column) =>
      column.reduce((total, id) => total + sized.get(id)!.height, 0) +
      Math.max(0, column.length - 1) * gap,
  );
  const height = Math.max(...columnHeight);
  const at = new Map<string, { x: number; y: number }>();
  let x = 0;
  layers.forEach((column, index) => {
    // Columns are centred against the tallest, so the diagram reads as a band
    // rather than as a staircase hanging off the top edge.
    let y = Math.round((height - columnHeight[index]) / 2);
    column.forEach((id) => {
      at.set(id, { x, y });
      y += sized.get(id)!.height + gap;
    });
    x += columnWidth[index] + gap;
  });
  return {
    places: ids.map((id) => at.get(id)!),
    width: Math.max(0, x - gap),
    height,
  };
}
