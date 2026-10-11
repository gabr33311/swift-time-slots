/**
 * Side-by-side columns for items that overlap in time (several professionals
 * at once), so none is drawn on top of another. Released items (cancelled /
 * expired) are left out and keep the full width, behind the live ones.
 */
export function layoutLanes(
  rows: { id: string; start: number; end: number; released?: boolean }[],
): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  const live = rows.filter((r) => !r.released).sort((a, b) => a.start - b.start);
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const r of live) {
    if (r.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= r.start);
    if (lane === -1) lane = laneEnds.push(r.end) - 1;
    else laneEnds[lane] = r.end;
    cluster.push({ id: r.id, lane });
    clusterEnd = Math.max(clusterEnd, r.end);
  }
  flush();
  return out;
}
