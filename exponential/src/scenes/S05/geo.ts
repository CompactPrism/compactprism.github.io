// Geodesic cage (frequency-2 icosphere): 42 vertices, 120 edges. Edges are ordered by graph distance
// from the "team" seed vertices at the bottom, so the cage weaves itself closed from below.
type V3 = [number, number, number];

const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};

const build = () => {
  const p = (1 + Math.sqrt(5)) / 2;
  const verts: V3[] = [
    [-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0],
    [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p],
    [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1],
  ].map((v) => norm(v as V3));
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const cache = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (cache.has(k)) return cache.get(k)!;
    const va = verts[a];
    const vb = verts[b];
    verts.push(norm([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2]));
    cache.set(k, verts.length - 1);
    return verts.length - 1;
  };
  const f2: number[][] = [];
  for (const [a, b, c] of faces) {
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    f2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];
  for (const f of f2) {
    for (let i = 0; i < 3; i++) {
      const a = f[i];
      const b = f[(i + 1) % 3];
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!edgeSet.has(k)) {
        edgeSet.add(k);
        edges.push(a < b ? [a, b] : [b, a]);
      }
    }
  }
  // tilt so no vertex sits exactly at a pole (looks more organic)
  const tilt = 0.32;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const tv = verts.map(([x, y, z]) => [x, y * ct - z * st, y * st + z * ct] as V3);
  // seeds: the 7 lowest vertices (the team rises to these)
  const order = tv.map((v, i) => ({i, y: v[1]})).sort((a, b) => a.y - b.y);
  const seeds = order.slice(0, 7).map((o) => o.i);
  // BFS distance
  const adj: number[][] = tv.map(() => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const dist = tv.map(() => Infinity);
  const q: number[] = [];
  for (const s of seeds) {
    dist[s] = 0;
    q.push(s);
  }
  while (q.length) {
    const v = q.shift()!;
    for (const w of adj[v]) {
      if (dist[w] === Infinity) {
        dist[w] = dist[v] + 1;
        q.push(w);
      }
    }
  }
  const maxD = Math.max(...dist);
  // each edge: from the closer vertex to the farther; key in [0,1)
  const E = edges.map(([a, b], k) => {
    const [from, to] = dist[a] <= dist[b] ? [a, b] : [b, a];
    const key = (Math.min(dist[a], dist[b]) + (dist[a] === dist[b] ? 0.5 : 0) + ((k * 0.618) % 1) * 0.3) / (maxD + 0.8);
    return {from, to, key};
  });
  // each seed walks upward (greedy) for the team-light paths
  const paths = seeds.map((s, si) => {
    const path = [s];
    let cur = s;
    for (let step = 0; step < maxD + 1; step++) {
      const cand = adj[cur].filter((w) => dist[w] > dist[cur]);
      if (!cand.length) break;
      cur = cand[(si * 3 + step) % cand.length];
      path.push(cur);
    }
    return path;
  });
  return {verts: tv, edges: E, seeds, paths, maxD};
};

export const CAGE = build();
