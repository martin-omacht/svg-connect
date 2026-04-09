'use strict';

// SVG path merge logic — runs in both browser and Node.js (via svg-connect.js)
// Browser uses native DOMParser/XMLSerializer; Node.js injects them via the wrapper.

const NARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

const fmt = x => +parseFloat(x.toFixed(6));

function makeNear(tolerance) {
  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  return (a, b) => a && b && dist(a, b) <= tolerance;
}

// Parse SVG path d attribute into absolute segments.
// Each segment: { type, pts: [{x,y},...], from: {x,y}, ...arc extras }
function parseD(d) {
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)/g;
  const toks = [];
  let m;
  while ((m = re.exec(d)) !== null)
    toks.push(m[1] ? { t: 'c', v: m[1] } : { t: 'n', v: parseFloat(m[2]) });

  const segs = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let prevType = '', prevCtrl = null;
  let i = 0;

  while (i < toks.length) {
    if (toks[i].t !== 'c') { i++; continue; }
    const raw = toks[i].v; i++;
    const cmd = raw.toLowerCase();
    const rel = raw !== raw.toUpperCase();
    const n = NARGS[cmd];

    if (cmd === 'z') {
      segs.push({ type: 'Z', pts: [], from: { x: cx, y: cy } });
      cx = sx; cy = sy; prevType = 'Z'; continue;
    }

    let first = true;
    while (i < toks.length && toks[i].t === 'n') {
      const a = [];
      for (let j = 0; j < n && i < toks.length && toks[i].t === 'n'; j++) a.push(toks[i++].v);
      if (a.length < n) break;

      const ec = (cmd === 'm' && !first) ? 'l' : cmd;
      first = false;
      const from = { x: cx, y: cy };
      const r = (v, base) => rel ? base + v : v;

      switch (ec) {
        case 'm':
          cx = r(a[0], cx); cy = r(a[1], cy); sx = cx; sy = cy;
          segs.push({ type: 'M', pts: [{ x: cx, y: cy }], from });
          prevType = 'M'; prevCtrl = null; break;

        case 'l':
          cx = r(a[0], cx); cy = r(a[1], cy);
          segs.push({ type: 'L', pts: [{ x: cx, y: cy }], from });
          prevType = 'L'; prevCtrl = null; break;

        case 'h':
          cx = r(a[0], cx);
          segs.push({ type: 'L', pts: [{ x: cx, y: cy }], from });
          prevType = 'L'; prevCtrl = null; break;

        case 'v':
          cy = r(a[0], cy);
          segs.push({ type: 'L', pts: [{ x: cx, y: cy }], from });
          prevType = 'L'; prevCtrl = null; break;

        case 'c': {
          const x1 = r(a[0], cx), y1 = r(a[1], cy);
          const x2 = r(a[2], cx), y2 = r(a[3], cy);
          cx = r(a[4], cx); cy = r(a[5], cy);
          segs.push({ type: 'C', pts: [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: cx, y: cy }], from });
          prevType = 'C'; prevCtrl = { x: x2, y: y2 }; break;
        }

        case 's': {
          const cp1 = prevType === 'C'
            ? { x: 2 * cx - prevCtrl.x, y: 2 * cy - prevCtrl.y }
            : { x: cx, y: cy };
          const x2 = r(a[0], cx), y2 = r(a[1], cy);
          cx = r(a[2], cx); cy = r(a[3], cy);
          segs.push({ type: 'C', pts: [cp1, { x: x2, y: y2 }, { x: cx, y: cy }], from });
          prevType = 'C'; prevCtrl = { x: x2, y: y2 }; break;
        }

        case 'q': {
          const x1 = r(a[0], cx), y1 = r(a[1], cy);
          cx = r(a[2], cx); cy = r(a[3], cy);
          segs.push({ type: 'Q', pts: [{ x: x1, y: y1 }, { x: cx, y: cy }], from });
          prevType = 'Q'; prevCtrl = { x: x1, y: y1 }; break;
        }

        case 't': {
          const cp1 = prevType === 'Q'
            ? { x: 2 * cx - prevCtrl.x, y: 2 * cy - prevCtrl.y }
            : { x: cx, y: cy };
          cx = r(a[0], cx); cy = r(a[1], cy);
          segs.push({ type: 'Q', pts: [cp1, { x: cx, y: cy }], from });
          prevType = 'Q'; prevCtrl = cp1; break;
        }

        case 'a': {
          const [rx, ry, rot, large, sweep] = a;
          cx = r(a[5], cx); cy = r(a[6], cy);
          segs.push({ type: 'A', pts: [{ x: cx, y: cy }], from, rx, ry, rot, large, sweep });
          prevType = 'A'; prevCtrl = null; break;
        }
      }
    }
  }
  return segs;
}

function segsToD(segs) {
  const p = pt => `${fmt(pt.x)},${fmt(pt.y)}`;
  return segs.map(s => {
    switch (s.type) {
      case 'M': return `M ${p(s.pts[0])}`;
      case 'L': return `L ${p(s.pts[0])}`;
      case 'C': return `C ${p(s.pts[0])} ${p(s.pts[1])} ${p(s.pts[2])}`;
      case 'Q': return `Q ${p(s.pts[0])} ${p(s.pts[1])}`;
      case 'A': return `A ${fmt(s.rx)},${fmt(s.ry)} ${fmt(s.rot)} ${s.large} ${s.sweep} ${p(s.pts[0])}`;
      case 'Z': return 'Z';
      default: return '';
    }
  }).join(' ');
}

function endpoints(segs) {
  let start = null, end = null;
  for (const s of segs) {
    if (!s.pts.length) continue;
    const pt = s.pts[s.pts.length - 1];
    if (start === null) start = pt;
    end = pt;
  }
  return { start, end };
}

function reverseSegs(segs) {
  let newStart = null;
  for (let i = segs.length - 1; i >= 0; i--) {
    if (segs[i].pts.length) { newStart = segs[i].pts[segs[i].pts.length - 1]; break; }
  }
  if (!newStart) return segs;

  const result = [{ type: 'M', pts: [newStart], from: newStart }];
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const to = s.from;
    switch (s.type) {
      case 'M': break;
      case 'L':   result.push({ type: 'L', pts: [to], from: s.pts[0] }); break;
      case 'C':   result.push({ type: 'C', pts: [s.pts[1], s.pts[0], to], from: s.pts[2] }); break;
      case 'Q':   result.push({ type: 'Q', pts: [s.pts[0], to], from: s.pts[1] }); break;
      case 'A':   result.push({ type: 'A', pts: [to], from: s.pts[0], rx: s.rx, ry: s.ry, rot: s.rot, large: s.large, sweep: s.sweep ? 0 : 1 }); break;
      case 'Z': break;
    }
  }
  return result;
}

function appendSegs(a, b) {
  return [...a, ...b.filter((s, idx) => !(s.type === 'M' && idx === 0))];
}

function processGroup(pathEls, near) {
  let paths = pathEls.map(el => {
    const segs = parseD(el.getAttribute('d') || '');
    return { el, segs, ...endpoints(segs) };
  }).filter(p => p.start && p.end);

  let merged = 0;
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const pi = paths[i], pj = paths[j];
        let newSegs = null, keepEl = pi.el, removeEl = pj.el;

        if (near(pi.end, pj.start)) {
          newSegs = appendSegs(pi.segs, pj.segs);
        } else if (near(pi.end, pj.end)) {
          newSegs = appendSegs(pi.segs, reverseSegs(pj.segs));
        } else if (near(pj.end, pi.start)) {
          newSegs = appendSegs(pj.segs, pi.segs);
          keepEl = pj.el; removeEl = pi.el;
        } else if (near(pi.start, pj.start)) {
          newSegs = appendSegs(reverseSegs(pi.segs), pj.segs);
          keepEl = pj.el; removeEl = pi.el;
        }

        if (newSegs) {
          keepEl.setAttribute('d', segsToD(newSegs));
          removeEl.parentNode.removeChild(removeEl);
          paths = paths.filter(p => p !== pi && p !== pj);
          paths.push({ el: keepEl, segs: newSegs, ...endpoints(newSegs) });
          merged++;
          changed = true;
          break outer;
        }
      }
    }
  }
  return merged;
}

function walk(el, near) {
  if (!el || el.nodeType !== 1) return 0;
  let total = 0;

  if (el.tagName === 'g') {
    const pathEls = [];
    for (let k = 0; k < el.childNodes.length; k++) {
      const child = el.childNodes[k];
      if (child.nodeType === 1 && child.tagName === 'path') pathEls.push(child);
    }
    if (pathEls.length > 1) total += processGroup(pathEls, near);
  }

  const children = [];
  for (let k = 0; k < el.childNodes.length; k++) children.push(el.childNodes[k]);
  for (const child of children) total += walk(child, near);
  return total;
}

function mergeSVG(svgText, tolerance, domParser, xmlSerializer) {
  // domParser / xmlSerializer: injected for Node.js compatibility;
  // in the browser they are omitted and window globals are used.
  const parser = domParser || new DOMParser();
  const serializer = xmlSerializer || new XMLSerializer();
  const near = makeNear(tolerance);
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const merged = walk(doc.documentElement, near);
  return { svg: serializer.serializeToString(doc), merged };
}

// Export for Node.js; in the browser this file is loaded as a plain <script>
if (typeof module !== 'undefined') module.exports = { mergeSVG };
