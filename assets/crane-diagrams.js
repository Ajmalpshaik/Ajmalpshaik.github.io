/* ajmalps.com - Crane Lift Calculator, the five drawings.
   Drawn from window.craneLift and the 'cranelift' event, which crane-calc.js
   publishes at the end of every calc(). Nothing here computes a check: every
   number shown is one the calculator already worked out. If a drawing ever
   disagrees with a card, the card is right and this file is wrong.

   Everything is to scale unless the drawing says otherwise. Colours come from
   the --d-* and --c-* variables in toolbox.css, so the print stylesheet can
   swap the whole palette for paper without touching this file. */
(function () {
  'use strict';

  var uid = 0;
  function f(n, d) { return (isFinite(n) ? n : 0).toFixed(d == null ? 2 : d); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function r1(n) { return Math.round(n * 10) / 10; }

  /* ---------- drawing primitives (strings of SVG) ---------- */
  function line(x1, y1, x2, y2, cls, extra) {
    return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" class="' + cls + '"' + (extra || '') + '/>';
  }
  function rect(x, y, w, h, cls, extra) {
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(Math.max(w, 0)) + '" height="' + r1(Math.max(h, 0)) + '" class="' + cls + '"' + (extra || '') + '/>';
  }
  function text(x, y, s, cls, anchor, size, extra) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" class="' + cls + '" text-anchor="' + (anchor || 'middle') + '" font-size="' + (size || 10) + '"' + (extra || '') + '>' + esc(s) + '</text>';
  }
  function poly(pts, cls, extra) {
    return '<polygon points="' + pts.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') + '" class="' + cls + '"' + (extra || '') + '/>';
  }
  function path(d, cls, extra) { return '<path d="' + d + '" class="' + cls + '"' + (extra || '') + '/>'; }

  /* a dimension: line, slashed ticks, extension stubs, label beside it */
  function dimV(x, y1, y2, label, side, cls) {
    var s = line(x, y1, x, y2, cls || 'dg-dim');
    s += line(x - 3, y1 + 3, x + 3, y1 - 3, cls || 'dg-dim') + line(x - 3, y2 + 3, x + 3, y2 - 3, cls || 'dg-dim');
    if (label) {
      var my = (y1 + y2) / 2;
      if (side === 'along') {
        /* read along the line, as on a drawing, so it needs no width beside it */
        s += text(x - 4, my, label, 'dg-t-dim', 'middle', 9.5, ' font-weight="700" transform="rotate(-90 ' + r1(x - 4) + ' ' + r1(my) + ')"');
      } else {
        var dx = side === 'left' ? -5 : 5;
        s += text(x + dx, my + 3.5, label, 'dg-t-dim', side === 'left' ? 'end' : 'start', 9);
      }
    }
    return s;
  }
  function dimH(x1, x2, y, label, below, cls) {
    var s = line(x1, y, x2, y, cls || 'dg-dim');
    s += line(x1 - 3, y + 3, x1 + 3, y - 3, cls || 'dg-dim') + line(x2 - 3, y + 3, x2 + 3, y - 3, cls || 'dg-dim');
    if (label) s += text((x1 + x2) / 2, below ? y + 11 : y - 4, label, 'dg-t-dim', 'middle', 9);
    return s;
  }
  function hatch(id, cls) {
    return '<pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<line x1="0" y1="0" x2="0" y2="6" class="' + cls + '"/></pattern>';
  }

  /* how close a figure is to its limit: the limit sits at 80% of the track,
     so an overload still shows how far over it is */
  function gauge(x, y, w, val, lim, cls, left, right) {
    var s = text(x, y - 5, left, 'dg-tx', 'start', 9.5);
    if (right) s += text(x + w, y - 5, right, 'dg-tx ' + (cls || ''), 'end', 9.5, ' font-weight="700"');
    s += rect(x, y, w, 6, 'dg-track', ' rx="3"');
    if (lim > 0 && val >= 0) {
      var fill = clamp(val / lim * 0.8, 0, 1) * w;
      s += rect(x, y, Math.max(fill, 2), 6, 'dg-fill ' + (cls || ''), ' rx="3"');
      s += line(x + w * 0.8, y - 2, x + w * 0.8, y + 8, 'dg-limit');
    }
    return s;
  }

  function head(svg, title) {
    svg.setAttribute('aria-label', title);
  }
  /* nothing to draw yet: say what is missing rather than draw a speck */
  function empty(svg, w, h, msg) {
    svg.innerHTML = rect(0, 0, w, h, 'd-sky') + text(w / 2, h / 2, msg, 'dg-t-mute', 'middle', 11);
    head(svg, msg);
  }
  /* where the building's near face is: the edge the user gave, or a stand-in
     the same as the 3D view's when they gave none */
  function buildingFace(L, spread, halfL) {
    var R = Math.max(L.workingRadius, 0);
    if (L.buildingEdge != null && L.buildingEdge < R) return { near: L.buildingEdge, real: true };
    var near = Math.max(spread + 1.4, R - Math.max(halfL + 2, 4));
    if (near > R - halfL) near = R - halfL - 0.3;
    return { near: near, real: false };
  }

  /* ---------- 1. Ground pressure: section and plan of one pad ---------- */
  function drawGround(svg, L) {
    var id = 'h' + (++uid);
    var pad = Math.max(L.padDimension, 0), minPad = Math.max(L.minPad || 0, 0);
    var gbpKnown = L.gbp > 0;
    var s = '<defs>' + hatch(id, 'dg-soil') + '</defs>';
    s += rect(0, 0, 320, 230, 'd-sky');
    /* section */
    var gy = 150, cx = 100;
    var span = Math.max(pad, minPad, 0.3);
    var k = 150 / span;
    s += rect(0, gy, 205, 46, '', ' fill="url(#' + id + ')"');
    s += line(0, gy, 205, gy, 'dg-ground');
    s += rect(4, 54, cx - 4, 14, 'd-steel-d', ' rx="2"');
    s += rect(cx - 10, 50, 20, 22, 'd-steel-d', ' rx="2"');
    s += rect(cx - 6, 72, 12, 54, 'd-steel', ' rx="2"');
    s += rect(cx - 17, 126, 34, 6, 'd-steel-d', ' rx="1.5"');
    if (minPad > 0 && Math.abs(minPad - pad) > 0.005) {
      s += rect(cx - minPad * k / 2, 132, minPad * k, 14, 'dg-ghost');
    }
    if (pad > 0) s += rect(cx - pad * k / 2, 132, pad * k, 14, 'dg-pad ' + L.gpCls, ' rx="2"');
    /* the reaction, spread under the pad */
    if (pad > 0) {
      for (var i = 0; i <= 4; i++) {
        var ax = cx - pad * k / 2 + 6 + i * (pad * k - 12) / 4;
        s += line(ax, gy + 24, ax, gy + 4, 'dg-react') + poly([[ax - 3, gy + 8], [ax + 3, gy + 8], [ax, gy + 3]], 'dg-react-h');
      }
      s += text(cx, gy + 38, 'q = ' + f(L.actualPressure, 1) + ' T/m²', 'dg-t-strong ' + L.gpCls, 'middle', 10.5);
    }
    s += line(cx, 14, cx, 44, 'dg-force') + poly([[cx - 6, 38], [cx + 6, 38], [cx, 48]], 'dg-force-h');
    s += text(cx + 10, 26, f(L.outriggerForce, 2) + ' T', 'dg-t-strong', 'start', 11);
    s += text(cx + 10, 38, 'worst outrigger', 'dg-t-mute', 'start', 8.5);
    /* plan */
    var px = 262, py = 92, pk = 78 / span;
    s += text(px, 22, 'PLAN', 'dg-t-mute', 'middle', 8.5, ' letter-spacing="1"');
    if (minPad > 0) s += rect(px - minPad * pk / 2, py - minPad * pk / 2, minPad * pk, minPad * pk, 'dg-ghost');
    if (pad > 0) {
      s += rect(px - pad * pk / 2, py - pad * pk / 2, pad * pk, pad * pk, 'dg-pad ' + L.gpCls, ' rx="2"');
      s += rect(px - 8, py - 8, 16, 16, 'd-steel-d', ' rx="1.5"');
      s += dimH(px - pad * pk / 2, px + pad * pk / 2, py + pad * pk / 2 + 10, f(pad, 2) + ' m', true);
    }
    if (minPad > 0) s += text(px, 172, 'min ' + f(minPad, 2) + ' m', 'dg-t-mute', 'middle', 9);
    if (minPad > 0) s += text(px, 183, '(dashed)', 'dg-t-mute', 'middle', 8);
    /* how close to the limit */
    s += gauge(14, 212, 292, L.actualPressure, L.gbp, L.gpCls,
      'Ground pressure vs allowable',
      gbpKnown ? f(L.actualPressure, 1) + ' / ' + f(L.gbp, 1) + ' T/m² · ' + (L.gpCls === 'ok' ? 'PASS' : 'FAIL') : 'Enter allowable GBP');
    svg.innerHTML = s;
    head(svg, 'Outrigger pad in section and plan: ' + f(L.outriggerForce) + ' T on a ' + f(pad) + ' m pad gives ' +
      f(L.actualPressure, 1) + ' T/m² against ' + (gbpKnown ? f(L.gbp, 1) + ' allowed' : 'no limit entered'));
  }

  /* ---------- 2. Slings: true view of the two legs that carry ---------- */
  function drawSling(svg, L) {
    if (!(L.slingLength > 0) || !(L.loadLength > 0) || !(L.loadHeight > 0)) return empty(svg, 320, 230, 'Enter sling length and load size');
    var legs = clamp(L.slingLegs | 0, 1, 4);
    var a = clamp(L.slingAngle, 0.5, 90) * Math.PI / 180;
    var sp = Math.max(L.slingLength, 0) * Math.cos(a);
    var drop = Math.max(L.slingVerticalDrop, 0);
    var span = legs === 4 ? Math.hypot(L.loadLength, L.loadWidth) : Math.max(L.loadLength, 0.1);
    var reach = legs === 4 ? span / 2 : legs === 3 ? Math.min(L.loadLength, L.loadWidth) / 2 : span / 2;
    var H = Math.max(L.loadHeight, 0.05);
    var wW = Math.max(2 * sp, span, 0.5), wH = drop + H;
    var k = Math.min(250 / wW, 120 / Math.max(wH, 0.5));
    var cx = 160, hy = 52;
    var topY = hy + drop * k;
    var s = rect(0, 0, 320, 230, 'd-sky');
    /* hook */
    s += line(cx, 8, cx, 22, 'dg-rope');
    s += rect(cx - 9, 22, 18, 14, 'd-steel-d', ' rx="2.5"');
    s += path('M ' + cx + ' 36 C ' + cx + ' 42, ' + (cx - 8) + ' 42, ' + (cx - 8) + ' 47 C ' + (cx - 8) + ' 52, ' + (cx + 1) + ' 54, ' + (cx + 4) + ' 50', 'dg-hook');
    var legCls = 'dg-leg ' + (L.slingCls || 'warn');
    var lx = sp * k;
    if (legs === 1) {
      s += line(cx, hy, cx, topY, legCls);
    } else {
      s += line(cx, hy, cx - lx, topY, legCls) + line(cx, hy, cx + lx, topY, legCls);
      /* angle at the left lift point, measured from the horizontal */
      var ar = clamp(lx * 0.35, 12, 26);
      if (L.slingAngle < 89.5) {
        s += line(cx - lx, topY, cx - lx + ar + 10, topY, 'dg-dim-thin');
        s += path('M ' + r1(cx - lx + ar) + ' ' + r1(topY) + ' A ' + ar + ' ' + ar + ' 0 0 0 ' + r1(cx - lx + ar * Math.cos(a)) + ' ' + r1(topY - ar * Math.sin(a)), 'dg-arc');
      }
      s += text(cx - lx + ar + 4, topY - 6, f(L.slingAngle, 0) + '°', 'dg-t-dim', 'start', 10.5, ' font-weight="700"');
      /* tension on the right leg */
      var mx = cx + lx / 2, my = (hy + topY) / 2;
      s += text(mx + 8, my, f(L.tensionPerLeg, 2) + ' T', 'dg-t-strong ' + (L.slingCls || ''), 'start', 10.5);
      s += text(mx + 8, my + 11, 'per leg', 'dg-t-mute', 'start', 8.5);
    }
    /* the load, to the same scale */
    s += rect(cx - span * k / 2, topY, span * k, H * k, 'd-load', ' rx="2" stroke-width="1.2"');
    if (legs > 1) {
      s += rect(cx - lx - 3, topY - 3, 6, 5, 'd-steel-d', ' rx="1"') + rect(cx + lx - 3, topY - 3, 6, 5, 'd-steel-d', ' rx="1"');
    }
    s += text(cx, topY + H * k / 2 + 3.5, f(L.loadWeight + L.gearWeight, 2) + ' T', 'dg-t-onload', 'middle', 10);
    var notes = legs > 2 ? (legs + ' legs fitted, 2 counted (BS 7121)') : legs === 2 ? '2 legs, both counted' : '1 leg, vertical';
    s += text(160, Math.min(topY + H * k + 15, 186), notes, 'dg-t-mute', 'middle', 9);
    if (legs > 1 && sp > reach + 0.05) s += text(160, Math.min(topY + H * k + 27, 197), 'Lift points fall outside the load', 'dg-tx warn', 'middle', 9, ' font-weight="700"');
    s += gauge(14, 212, 292, L.tensionPerLeg, L.effectiveWLL, L.slingCls,
      'Tension per leg vs WLL',
      L.effectiveWLL > 0 ? f(L.tensionPerLeg, 2) + ' / ' + f(L.effectiveWLL, 2) + ' T · ' + L.slingStatus : 'Enter sling WLL');
    svg.innerHTML = s;
    head(svg, 'Slings: ' + f(L.tensionPerLeg) + ' T per leg at ' + f(L.slingAngle, 0) + ' degrees, ' + L.slingStatus);
  }

  /* ---------- 3. Wind: the sail face, and the result against the chart ---------- */
  function drawWind(svg, L) {
    if (!(Math.max(L.loadLength, L.loadWidth) > 0) || !(L.loadHeight > 0)) return empty(svg, 320, 230, 'Enter the load size');
    var id = 'h' + (++uid);
    var fw = Math.max(L.loadLength, L.loadWidth, 0.1), H = Math.max(L.loadHeight, 0.05);
    var k = Math.min(120 / fw, 92 / H);
    var cx = 205, by = 128;
    var s = '<defs>' + hatch(id, 'dg-sail') + '</defs>';
    s += rect(0, 0, 320, 230, 'd-sky');
    s += line(cx, 8, cx, by - H * k - 8, 'dg-rope');
    s += rect(cx - 6, by - H * k - 9, 12, 5, 'd-steel-d', ' rx="1"');
    s += rect(cx - fw * k / 2, by - H * k, fw * k, H * k, 'd-load', ' rx="2" stroke-width="1.2"');
    s += rect(cx - fw * k / 2, by - H * k, fw * k, H * k, '', ' fill="url(#' + id + ')"');
    s += dimH(cx - fw * k / 2, cx + fw * k / 2, by + 12, f(fw, 2) + ' m', true);
    s += dimV(cx + fw * k / 2 + 10, by - H * k, by, f(H, 2) + ' m', 'right');
    for (var i = 0; i < 3; i++) {
      var y = by - H * k * (0.2 + i * 0.3);
      var x2 = cx - fw * k / 2 - 8;
      s += line(Math.max(x2 - 80, 8) + i * 10, y, x2, y, 'dg-wind') + poly([[x2 - 7, y - 4], [x2 - 7, y + 4], [x2, y]], 'dg-wind-h');
    }
    s += text(14, 24, 'Max permissible wind', 'dg-t-mute', 'start', 9);
    s += text(14, 44, L.windOk ? f(L.maxWind, 1) + ' m/s' : '--', 'dg-t-big', 'start', 20);
    s += text(14, 160, 'Face ' + f(fw * H, 2) + ' m² · area used ' + f(L.sailArea, 2) + ' m² · Cw ' + f(L.dragCoeff, 1), 'dg-t-mute', 'start', 9);
    var capped = L.windOk && L.windRaw > L.vChart && L.vChart > 0;
    s += text(14, 174, !L.windOk ? 'Enter load weight, sail area and Cw' :
      capped ? 'Load allows ' + f(L.windRaw, 1) + ' m/s · chart limit governs' : 'Below the crane chart limit', capped ? 'dg-tx' : 'dg-tx', 'start', 9);
    s += gauge(14, 212, 292, L.maxWind, L.vChart, '',
      'Permissible vs crane chart limit',
      L.vChart > 0 ? f(L.maxWind, 1) + ' / ' + f(L.vChart, 1) + ' m/s' : 'Enter V chart');
    svg.innerHTML = s;
    head(svg, 'Wind on the load: max permissible ' + f(L.maxWind, 1) + ' metres per second, crane chart limit ' + f(L.vChart, 1));
  }

  /* ---------- 4. Headroom: the stack, vertical to scale ---------- */
  function drawHeadroom(svg, L) {
    if (!(L.heightRequired > 0.05)) return empty(svg, 320, 230, 'Enter target height and rigging');
    var T = Math.max(L.targetHeight, 0), clr = Math.max(L.clearanceMargin, 0);
    var lH = Math.max(L.loadHeight, 0), drop = Math.max(L.slingVerticalDrop, 0), hook = Math.max(L.hookHeight, 0);
    var tip = Math.max(L.heightRequired, 0.5);
    var gy = 214, k = 192 / tip;
    var y = function (m) { return gy - m * k; };
    var bx = 34, bw = 92, cx = bx + bw / 2;
    var s = rect(0, 0, 320, 230, 'd-sky');
    s += text(10, 14, 'Vertical to scale', 'dg-t-mute', 'start', 8.5);
    s += rect(0, gy, 320, 16, 'd-ground') + line(0, gy, 320, gy, 'dg-ground');
    if (T > 0) {
      s += rect(bx, y(T), bw, T * k, 'dg-bld');
      for (var fl = 3.5; fl < T - 0.4; fl += 3.5) s += line(bx, y(fl), bx + bw, y(fl), 'dg-floor');
      s += rect(bx - 3, y(T) - 2, bw + 6, 3, 'd-steel-l');
    }
    var lb = T + clr, lt = lb + lH, hk = lt + drop;
    var lw = 58;
    s += rect(cx - lw / 2, y(lt), lw, Math.max(lH * k, 2), 'd-load', ' rx="2" stroke-width="1"');
    s += line(cx, y(hk), cx - lw / 2 + 4, y(lt), 'dg-rope') + line(cx, y(hk), cx + lw / 2 - 4, y(lt), 'dg-rope');
    s += rect(cx - 7, y(tip), 14, Math.max(hook * k, 3), 'd-steel-d', ' rx="2"');
    /* boom head, so the top of the stack has something to hang from */
    s += poly([[cx - 16, y(tip) - 1], [cx + 22, y(tip) - 12], [cx + 22, y(tip) - 5], [cx - 12, y(tip) + 4]], 'dg-crane');
    s += '<circle cx="' + r1(cx) + '" cy="' + r1(y(tip)) + '" r="3.2" class="d-steel-l"/>';
    /* the chain, each segment labelled, labels pushed apart where segments are thin */
    var segs = [
      [0, T, 'Target', T], [T, lb, 'Clearance', clr], [lb, lt, 'Load', lH], [lt, hk, 'Sling drop', drop], [hk, tip, 'Hook block', hook],
    ];
    var dx = 168;
    var labels = [];
    segs.forEach(function (g) {
      if (g[1] - g[0] <= 0.0001) return;
      s += line(dx, y(g[0]), dx, y(g[1]), 'dg-dim');
      s += line(dx - 3, y(g[0]) + 3, dx + 3, y(g[0]) - 3, 'dg-dim');
      var mid = (y(g[0]) + y(g[1])) / 2;
      labels.push({ y: mid, y0: mid, t: g[2] + ' ' + f(g[3], 2) + ' m' });
    });
    s += line(dx - 3, y(tip) + 3, dx + 3, y(tip) - 3, 'dg-dim');
    labels.sort(function (p, q) { return q.y - p.y; });
    for (var i = 1; i < labels.length; i++) if (labels[i - 1].y - labels[i].y < 12) labels[i].y = labels[i - 1].y - 12;
    var shift = Math.max(0, 14 - labels[labels.length - 1].y);
    labels.forEach(function (l) {
      var ly = l.y + shift;
      /* a label pushed off its segment gets a leader back to it */
      if (Math.abs(ly - l.y0) > 1) s += line(dx + 1, l.y0, dx + 6, ly, 'dg-ext');
      s += text(dx + 8, ly + 3.5, l.t, 'dg-tx', 'start', 9.5);
    });
    /* extension lines from the drawing to the chain */
    [T, lb, lt, hk, tip].forEach(function (m) { s += line(cx + lw / 2 + 2, y(m), dx + 4, y(m), 'dg-ext'); });
    s += dimV(304, y(0), y(tip), 'Boom tip ' + f(tip, 2) + ' m', 'along', 'dg-dim-strong');
    svg.innerHTML = s;
    head(svg, 'Headroom: target ' + f(T) + ' m plus clearance, load, sling and hook gives a boom tip height of ' + f(tip) + ' m');
  }

  /* ---------- 5. Lift overview: side elevation, everything to scale ---------- */
  function drawOverview(svg, L) {
    if (!(L.workingRadius > 0) || !(L.heightRequired > 0.05)) return empty(svg, 380, 240, 'Enter working radius and target height');
    var R = Math.max(L.workingRadius, 0), tip = Math.max(L.heightRequired, 0), piv = Math.max(L.pivotHeight, 0);
    var T = Math.max(L.targetHeight, 0);
    var lL = Math.max(L.loadLength, 0.05), lH = Math.max(L.loadHeight, 0.05);
    var halfL = lL / 2;
    /* outrigger spread and building edge as the 3D view draws them: illustrative,
       because the calculator is not given either */
    var spread = clamp(2.2 + L.craneWeight * 0.04, 2.6, 6.5);
    var face = buildingFace(L, spread, halfL), near = face.near;
    var far = R + Math.max(halfL + 3, 6);
    var x0 = Math.min(-Math.max(spread, 4.2) - 0.8, near - 1.5), x1 = far + 3.2, y1 = Math.max(tip, T) + 2.2;
    var W = 380, Hh = 240, gy = 206, left = 12, top = 14;
    var k = Math.min((W - 2 * left) / (x1 - x0), (gy - top) / y1);
    var X = function (m) { return left + (m - x0) * k + ((W - 2 * left) - (x1 - x0) * k) / 2; };
    var Y = function (m) { return gy - m * k; };
    var s = rect(0, 0, W, Hh, 'd-sky');
    s += rect(0, gy, W, Hh - gy, 'd-ground') + line(0, gy, W, gy, 'dg-ground');
    /* building */
    if (T > 0.05) {
      s += rect(X(near), Y(T), (far - near) * k, T * k, 'dg-bld');
      for (var fl = 3.5; fl < T - 0.4; fl += 3.5) s += line(X(near), Y(fl), X(far), Y(fl), 'dg-floor');
      s += rect(X(near) - 1.5, Y(T) - 1.5, (far - near) * k + 3, 2.5, 'd-steel-l');
    }
    /* crane, seen from the side of the boom: outriggers, carrier end-on, superstructure */
    var chTop = clamp(piv / 2.1, 0.45, 1.5) * 1.3;
    var padW = Math.max(L.padDimension, 0.2);
    s += rect(X(-spread), Y(0.55 * chTop), spread * 2 * k, Math.max(0.28 * k, 2), 'dg-crane-d');
    [-spread, spread].forEach(function (x) {
      s += rect(X(x) - 1.5, Y(0.55 * chTop), 3, 0.55 * chTop * k, 'd-steel');
      s += rect(X(x - padW / 2), Y(0.12), padW * k, Math.max(0.12 * k, 2), 'dg-pad ' + L.gpCls);
    });
    s += rect(X(-1.25), Y(chTop), 2.5 * k, (chTop - 0.45) * k, 'dg-crane');
    s += rect(X(-1.4), Y(0.6), 0.5 * k, 0.6 * k, 'dg-tyre', ' rx="1"') + rect(X(0.9), Y(0.6), 0.5 * k, 0.6 * k, 'dg-tyre', ' rx="1"');
    var deckTop = Math.max(piv - 0.15, chTop + 0.4);
    s += rect(X(-3.4), Y(deckTop), 4.3 * k, (deckTop - chTop) * k, 'dg-crane');
    if (L.counterWeight > 0) {
      var vol = L.counterWeight / 7.2, chh = clamp(Math.cbrt(vol) * 0.9, 0.35, 2.4), cd = clamp(vol / (2.4 * chh), 0.15, 6);
      s += rect(X(-3.4), Y(deckTop + chh), cd * k, chh * k, 'd-steel');
    }
    s += rect(X(-0.5), Y(deckTop + 1.4), 1.6 * k, 1.4 * k, 'dg-crane', ' rx="1.5"');
    s += rect(X(0.6), Y(deckTop + 1.1), 0.45 * k, 0.8 * k, 'd-glass');
    /* boom: three telescopic sections, foot at the slew centre */
    var a = L.boomAngle * Math.PI / 180, bl = Math.max(L.boomLength, 0);
    var bw = clamp(0.9 * k, 3, 9);
    var seg = [[0, 0.46, 1], [0.42, 0.74, 0.82], [0.7, 1, 0.64]];
    seg.forEach(function (q, i) {
      var ax = q[0] * bl * Math.cos(a), ay = piv + q[0] * bl * Math.sin(a);
      var bx2 = q[1] * bl * Math.cos(a), by2 = piv + q[1] * bl * Math.sin(a);
      s += line(X(ax), Y(ay), X(bx2), Y(by2), i % 2 ? 'dg-boom-d' : 'dg-boom', ' stroke-width="' + r1(bw * q[2]) + '" stroke-linecap="round"');
    });
    s += '<circle cx="' + r1(X(0)) + '" cy="' + r1(Y(piv)) + '" r="' + r1(Math.max(bw * 0.35, 1.8)) + '" class="d-steel-l"/>';
    /* hook, slings, load */
    var hook = Math.max(L.hookHeight, 0), hp = tip - hook, lt = hp - L.slingVerticalDrop;
    var sp = Math.max(L.slingLength, 0) * Math.cos(clamp(L.slingAngle, 0.5, 90) * Math.PI / 180);
    s += rect(X(R) - 3, Y(tip), 6, Math.max(hook * k, 3), 'd-steel-d', ' rx="1"');
    if (L.slingLegs > 1) s += line(X(R), Y(hp), X(R - sp), Y(lt), 'dg-leg-thin ' + L.slingCls) + line(X(R), Y(hp), X(R + sp), Y(lt), 'dg-leg-thin ' + L.slingCls);
    else s += line(X(R), Y(hp), X(R), Y(lt), 'dg-leg-thin ' + L.slingCls);
    s += rect(X(R - halfL), Y(lt), lL * k, lH * k, 'd-load', ' rx="1" stroke-width="1"');
    /* dimensions */
    s += line(X(0), Y(0), X(0), Y(piv), 'dg-axis');
    s += dimH(X(0), X(R), gy + 12, 'Radius ' + f(R, 2) + ' m', true, 'dg-dim-strong');
    s += line(X(0), gy, X(0), gy + 15, 'dg-ext') + line(X(R), Y(lt - lH) + 2, X(R), gy + 15, 'dg-ext');
    if (bl > 0.2) {
      var ox = -Math.sin(a) * 9, oy = -Math.cos(a) * 9;
      var p1x = X(0) + ox, p1y = Y(piv) + oy, p2x = X(R) + ox, p2y = Y(tip) + oy;
      s += line(p1x, p1y, p2x, p2y, 'dg-dim');
      var mx = (p1x + p2x) / 2 + ox * 1.1, my = (p1y + p2y) / 2 + oy * 1.1;
      s += text(mx, my, 'Boom ' + f(bl, 2) + ' m', 'dg-t-dim', 'middle', 10, ' font-weight="700" transform="rotate(' + r1(-a * 180 / Math.PI) + ' ' + r1(mx) + ' ' + r1(my) + ')"');
      var ar = clamp(bl * k * 0.22, 14, 40);
      s += line(X(0), Y(piv), X(0) + ar + 12, Y(piv), 'dg-dim-thin');
      s += path('M ' + r1(X(0) + ar) + ' ' + r1(Y(piv)) + ' A ' + ar + ' ' + ar + ' 0 0 0 ' + r1(X(0) + ar * Math.cos(a)) + ' ' + r1(Y(piv) - ar * Math.sin(a)), 'dg-arc');
      s += text(X(0) + (ar + 10) * Math.cos(a / 2), Y(piv) - (ar + 10) * Math.sin(a / 2) + 3, f(L.boomAngle, 2) + '°', 'dg-t-dim', 'start', 10, ' font-weight="700"');
    }
    /* heights on the far side of the building, clear of the boom, read along the line */
    var tx1 = X(far) + Math.max(1.0 * k, 14), tx2 = tx1 + Math.max(1.2 * k, 16);
    if (T > 0.05) {
      s += line(X(far), Y(T), tx1 + 4, Y(T), 'dg-ext');
      s += dimV(tx1, Y(0), Y(T), 'Target ' + f(T, 2) + ' m', 'along');
    }
    s += line(X(R) + 4, Y(tip), tx2 + 4, Y(tip), 'dg-ext');
    s += dimV(tx2, Y(0), Y(tip), 'Tip ' + f(tip, 2) + ' m', 'along', 'dg-dim-strong');
    /* the boom over the roof edge, when the edge was given */
    if (face.real && T > 0.05 && L.boomAtEdge != null) {
      var ey = L.boomAtEdge, ec = L.boomClrCls || '';
      s += line(X(near), Y(T), X(near), Y(Math.max(ey, T)), 'dg-leg-thin ' + ec, ' stroke-dasharray="3 2"');
      s += '<circle cx="' + r1(X(near)) + '" cy="' + r1(Y(ey)) + '" r="3" class="dg-edge ' + ec + '"/>';
      /* inside the roof corner: the boom is always on the other side of the edge */
      s += text(X(near) + 5, Y(T) + 13, 'Edge ' + L.boomClrText, 'dg-t-strong ' + ec, 'start', 9.5);
    }
    if (!face.real && T > 0.05) s += text(X((near + far) / 2), Y(T) - 4, 'building edge not given', 'dg-t-mute', 'middle', 8);
    /* status and scale */
    s += text(10, 14, 'Crane ' + (L.utilization == null ? '--' : f(L.utilization, 1) + ' %') + ' of chart', 'dg-t-strong ' + L.utilCls, 'start', 10.5);
    var step = [1, 2, 5, 10, 20, 50].filter(function (v) { return v * k >= 28; })[0] || 50;
    s += line(W - 12 - step * k, 12, W - 12, 12, 'dg-scale') + line(W - 12 - step * k, 9, W - 12 - step * k, 15, 'dg-scale') + line(W - 12, 9, W - 12, 15, 'dg-scale');
    s += text(W - 12 - step * k / 2, 24, step + ' m', 'dg-t-mute', 'middle', 8.5);
    svg.innerHTML = s;
    head(svg, 'Side elevation to scale: boom ' + f(bl, 1) + ' m at ' + f(L.boomAngle, 0) + ' degrees, radius ' + f(R, 1) +
      ' m, load landing on a ' + f(T, 1) + ' m roof, tip ' + f(tip, 1) + ' m above ground');
  }

  var DRAW = { dgGround: drawGround, dgSling: drawSling, dgWind: drawWind, dgHeadroom: drawHeadroom, dgOverview: drawOverview };
  function drawAll(L) {
    if (!L) return;
    Object.keys(DRAW).forEach(function (id) {
      var svg = document.getElementById(id);
      if (!svg) return;
      try { DRAW[id](svg, L); } catch (e) { /* one drawing failing must not take the others down */ if (window.console) console.warn('diagram ' + id + ':', e); }
    });
  }

  window.addEventListener('cranelift', function (e) { drawAll(e.detail); });
  function init() { drawAll(window.craneLift); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
