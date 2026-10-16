// Animated visual shown above the publication list for the selected area.
//
// Listens for the `pubs:area` event that assets/pubs.js fires whenever the
// area filter changes. Each entry in VISUALS draws one area onto a canvas.
// "all" shows a grid of small live tiles, one per main area, which pick that
// area when clicked. Areas in CAPTIONS show only their caption; any other
// area hides the stage.
//
// The stage is a dark "space window" in both page themes; every colour is in
// the palette P, so a light palette can be swapped in later.
//
// NOTE: with prefers-reduced-motion set, each visual renders one still frame
// (its `still` time) and never animates.

(function () {
  var stage = document.getElementById('area-stage');
  if (!stage) return;
  var canvas = stage.querySelector('canvas');
  var caption = stage.querySelector('.area-caption');
  var ctx = canvas.getContext('2d');
  // True while drawing a tile in the "All" grid: no text, larger marks.
  var mini = false;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // RGB triples, combined with an alpha by col().
  var P = {
    sky: ['#04060d', '#0a1022'],
    star: [225, 232, 255], starAlpha: [0.25, 0.55],
    limbGlow: [110, 140, 255], limb: ['#13234a', '#070b18'],
    globe: ['#16294f', '#060b18'], grid: [120, 150, 230],
    accent: [145, 167, 255], panel: [145, 167, 255], panelRule: [200, 212, 255],
    warn: [255, 184, 107], plume: [255, 230, 190],
    ink: [225, 232, 255], debris: [201, 206, 216],
    ice: [214, 232, 255], saturn: [216, 196, 154]
  };
  function col(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a == null ? 1 : a) + ')'; }
  function ink(a) { return col(P.ink, a); }

  var MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  var TAU = Math.PI * 2;

  // ---------- shared helpers ----------

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Deterministic pseudo-random sequence, so every loop draws the same scene.
  function seeded(seed) {
    return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  }

  // Common sizing for a frame: scale factor, narrow-screen flag, fade in/out.
  function frameInfo(w, h, t, period) {
    return {
      s: mini ? clamp(w / 330, 0.5, 0.85) : Math.min(w / 760, 1.15) + 0.15,
      narrow: !mini && w < 520,
      fade: smooth(0, 0.6, t) * (1 - smooth(period - 0.8, period, t))
    };
  }

  var stars = (function () {
    var out = [], rnd = seeded(7);
    for (var i = 0; i < 160; i++) {
      out.push({ x: rnd(), y: rnd(), r: rnd() * 1.1 + 0.25, p: rnd() * TAU, s: 0.6 + rnd() * 1.6 });
    }
    return out;
  })();

  function drawStars(w, h, t) {
    stars.forEach(function (s) {
      var a = P.starAlpha[0] + (P.starAlpha[1] - P.starAlpha[0]) * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = col(P.star, a.toFixed(3));
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, TAU);
      ctx.fill();
    });
  }

  // Earth limb along the bottom edge with a soft atmospheric glow.
  function drawLimb(w, h, topFrac) {
    var r = w * 1.6, cx = w * 0.5, cy = h * topFrac + r;
    var g = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.035);
    g.addColorStop(0, col(P.limbGlow, 0));
    g.addColorStop(0.55, col(P.limbGlow, 0.30));
    g.addColorStop(1, col(P.limbGlow, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.035, 0, TAU); ctx.fill();
    var body = ctx.createLinearGradient(0, h * topFrac, 0, h);
    body.addColorStop(0, P.limb[0]);
    body.addColorStop(1, P.limb[1]);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  }

  function drawSat(x, y, angle, scale, rgb) {
    rgb = rgb || P.accent;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.shadowColor = col(rgb);
    ctx.shadowBlur = 12;
    ctx.fillStyle = col(rgb);
    ctx.fillRect(-5, -3.5, 10, 7);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = col(rgb);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-9, 0); ctx.moveTo(5, 0); ctx.lineTo(9, 0); ctx.stroke();
    ctx.fillStyle = col(rgb, 0.6);
    ctx.fillRect(-21, -4.5, 12, 9);
    ctx.fillRect(9, -4.5, 12, 9);
    ctx.strokeStyle = col(P.panelRule, 0.55);
    ctx.lineWidth = 0.6;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-21 + i * 4 + 4, -4.5); ctx.lineTo(-21 + i * 4 + 4, 4.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9 + i * 4 + 4, -4.5); ctx.lineTo(9 + i * 4 + 4, 4.5); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDebris(x, y, angle, scale) {
    var pts = [[-6, -2], [-2, -6], [4, -4], [7, 1], [3, 5], [-3, 4], [-7, 2]];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = col(P.debris);
    ctx.shadowColor = col(P.debris, 0.8);
    ctx.shadowBlur = 6;
    ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Uncertainty ellipse, long axis along the direction of motion.
  function drawEllipse(x, y, rx, ry, angle, rgb) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fillStyle = col(rgb, 0.12);
    ctx.fill();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = col(rgb, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function glowDot(x, y, r, rgb, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col(rgb, a));
    g.addColorStop(1, col(rgb, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  // Readout in the top-left corner. Each line is [text, colour]; the first
  // line is a heading that is dropped on narrow screens. Returns the y just
  // below the last line, for a bar or sparkline underneath, or null in a
  // grid tile, which draws no readout.
  function hud(lines, narrow) {
    if (mini) return null;
    if (narrow) lines = lines.slice(1);
    var size = narrow ? 9 : 11, x = 14, y = 12;
    ctx.font = size + 'px ' + MONO;
    ctx.textBaseline = 'top';
    lines.forEach(function (l, i) {
      ctx.fillStyle = l[1];
      ctx.fillText(l[0], x, y + i * size * 1.55);
    });
    return y + lines.length * size * 1.55 + 2;
  }

  // ---------- globe ----------
  //
  // World frame: y up, equator in the x-z plane, +z toward the viewer before
  // the view tilt. Unit radius is the planet's surface.

  function globeView(cx, cy, R, tilt) {
    var ct = Math.cos(tilt), st = Math.sin(tilt);
    return {
      cx: cx, cy: cy, R: R,
      // Project a world point; z > 0 faces the viewer.
      p: function (x, y, z) {
        var y2 = y * ct - z * st, z2 = y * st + z * ct;
        return { x: cx + R * x, y: cy - R * y2, z: z2 };
      },
      // Hidden if behind the planet's disk.
      hidden: function (q) {
        var dx = q.x - cx, dy = q.y - cy;
        return q.z < 0 && dx * dx + dy * dy < R * R;
      }
    };
  }

  function surface(latDeg, lonDeg, rot) {
    var f = latDeg * Math.PI / 180, l = lonDeg * Math.PI / 180 + rot;
    return [Math.cos(f) * Math.sin(l), Math.sin(f), Math.cos(f) * Math.cos(l)];
  }

  // Point on a circular orbit of radius r: inclination inc, node raan, and
  // argument of latitude u (all radians).
  function orbitPoint(r, inc, raan, u) {
    var x = Math.cos(u), y = -Math.sin(u) * Math.sin(inc), z = Math.sin(u) * Math.cos(inc);
    return [r * (x * Math.cos(raan) + z * Math.sin(raan)), r * y, r * (-x * Math.sin(raan) + z * Math.cos(raan))];
  }

  function drawGlobe(v, rot) {
    var cx = v.cx, cy = v.cy, R = v.R;
    var glow = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.12);
    glow.addColorStop(0, col(P.limbGlow, 0.35));
    glow.addColorStop(1, col(P.limbGlow, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.fill();
    var body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    body.addColorStop(0, P.globe[0]);
    body.addColorStop(1, P.globe[1]);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // Graticule, front hemisphere only.
    ctx.strokeStyle = col(P.grid, 0.22);
    ctx.lineWidth = 0.7;
    function poly(pts) {
      var on = false;
      ctx.beginPath();
      pts.forEach(function (w) {
        var q = v.p(w[0], w[1], w[2]);
        if (q.z > 0) { if (on) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); on = true; } else on = false;
      });
      ctx.stroke();
    }
    var lat, lon, pts;
    for (lon = 0; lon < 360; lon += 30) {
      pts = [];
      for (lat = -90; lat <= 90; lat += 6) pts.push(surface(lat, lon, rot));
      poly(pts);
    }
    for (lat = -60; lat <= 60; lat += 30) {
      pts = [];
      for (lon = 0; lon <= 360; lon += 6) pts.push(surface(lat, lon, rot));
      poly(pts);
    }
  }

  // Orbit ring: the far side behind the planet is skipped.
  function drawOrbitRing(v, r, inc, raan, rgb, a) {
    ctx.strokeStyle = col(rgb, a);
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    var on = false;
    for (var k = 0; k <= 96; k++) {
      var w = orbitPoint(r, inc, raan, k / 96 * TAU), q = v.p(w[0], w[1], w[2]);
      if (!v.hidden(q)) { if (on) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); on = true; } else on = false;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---------- visuals ----------

  var VISUALS = {};

  // Spacecraft collision avoidance: a spacecraft and a debris object close
  // on the same point; collision probability climbs as the uncertainty
  // ellipses shrink, crosses the threshold, and a burn lifts the spacecraft
  // off its nominal path.
  VISUALS.conjunction = {
    caption: 'Developing uncertainty-aware planning and decision-making algorithms to enable autonomous spacecraft collision avoidance in increasingly congested orbital environments.',
    period: 11,
    still: 5.6,
    draw: function (w, h, t) {
      var T_TCA = 6.2, T_BURN = 4.4, s = mini ? clamp(w / 330, 0.5, 0.85) : Math.min(w / 760, 1.15) + 0.15;
      // Narrow screens: a smaller readout and a lower, flatter path keep the
      // spacecraft clear of the readout in the top-left corner.
      var narrow = !mini && w < 520;
      var baseY = narrow ? 0.72 : 0.62, arcH = narrow ? 0.16 : 0.22, liftH = narrow ? 0.13 : 0.17;
      var fade = smooth(0, 0.6, t) * (1 - smooth(10.2, 11, t));

      // Nominal spacecraft arc: rises gently across the frame.
      function nominal(tt) {
        var p = tt / 9.5;
        return { x: w * (-0.06 + 1.12 * p), y: h * (baseY - arcH * Math.sin(Math.PI * p)) };
      }
      var tca = nominal(T_TCA);
      var vD = { x: -w * 0.085, y: h * 0.055 };      // debris velocity per second
      function debris(tt) { return { x: tca.x + vD.x * (tt - T_TCA), y: tca.y + vD.y * (tt - T_TCA) }; }
      function lift(tt) { return h * liftH * smooth(T_BURN, T_TCA + 0.4, tt); }
      function actual(tt) { var n = nominal(tt); return { x: n.x, y: n.y - lift(tt) }; }

      ctx.globalAlpha = fade;

      // Ghost of the nominal path once the burn has started.
      var ghost = smooth(T_BURN, T_BURN + 0.8, t);
      ctx.setLineDash([2, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink((0.14 + 0.2 * ghost).toFixed(3));
      ctx.beginPath();
      for (var k = 0; k <= 60; k++) { var q = nominal(k / 60 * 9.5); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
      ctx.stroke();
      // Debris track, in the warning colour so it reads as the threat.
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = col(P.warn, 0.42);
      ctx.beginPath();
      var d0 = debris(0), d1 = debris(16);
      ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // TCA marker at the predicted crossing.
      var tcaVis = 1 - smooth(T_TCA + 0.3, T_TCA + 1.2, t);
      ctx.globalAlpha = fade * tcaVis;
      ctx.strokeStyle = col(P.warn);
      ctx.lineWidth = 1;
      var m = 7 * s;
      ctx.beginPath();
      ctx.moveTo(tca.x - m, tca.y); ctx.lineTo(tca.x - m / 2.5, tca.y);
      ctx.moveTo(tca.x + m / 2.5, tca.y); ctx.lineTo(tca.x + m, tca.y);
      ctx.moveTo(tca.x, tca.y - m); ctx.lineTo(tca.x, tca.y - m / 2.5);
      ctx.moveTo(tca.x, tca.y + m / 2.5); ctx.lineTo(tca.x, tca.y + m);
      ctx.stroke();
      ctx.font = Math.round(10 * s) + 'px ' + MONO;
      ctx.fillStyle = col(P.warn);
      ctx.textBaseline = 'middle';
      if (!mini) ctx.fillText('TCA', tca.x + m + 5, tca.y + m + 2);
      ctx.globalAlpha = fade;

      // Spacecraft trail.
      ctx.lineWidth = 2;
      for (var j = 0; j < 24; j++) {
        var ta = t - j * 0.06, tb = t - (j + 1) * 0.06;
        if (tb < 0) break;
        var a1 = actual(ta), b1 = actual(tb);
        ctx.strokeStyle = col(P.accent, (0.5 * (1 - j / 24)).toFixed(3));
        ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
      }

      var sc = actual(t), dp = debris(t);
      var nxt = actual(t + 0.05);
      var heading = Math.atan2(nxt.y - sc.y, nxt.x - sc.x);
      var dHeading = Math.atan2(vD.y, vD.x);

      // Uncertainty ellipses shrink as tracking accumulates.
      var shrink = 1 - 0.62 * smooth(0, T_TCA, t);
      drawEllipse(sc.x, sc.y, 34 * s * shrink, 12 * s * shrink, heading, P.accent);
      drawEllipse(dp.x, dp.y, 40 * s * shrink, 13 * s * shrink, dHeading, P.warn);

      // Burn plume, opposite the lift direction (radially downward).
      if (t > T_BURN && t < T_BURN + 1.1) {
        var b = Math.sin(Math.PI * (t - T_BURN) / 1.1);
        var flick = 0.75 + 0.25 * Math.sin(t * 80);
        var len = 26 * s * b * flick;
        var grad = ctx.createLinearGradient(sc.x, sc.y, sc.x, sc.y + len);
        grad.addColorStop(0, col(P.plume, 0.95));
        grad.addColorStop(0.4, col(P.warn, 0.6));
        grad.addColorStop(1, col(P.warn, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(sc.x - 3 * s, sc.y + 4 * s);
        ctx.lineTo(sc.x + 3 * s, sc.y + 4 * s);
        ctx.lineTo(sc.x, sc.y + 4 * s + len);
        ctx.closePath();
        ctx.fill();
      }

      drawDebris(dp.x, dp.y, t * 2.3, s);
      drawSat(sc.x, sc.y, heading, s);

      // Scripted readout: probability rises, crosses 1e-4, burn, collapses.
      var logPc = t < T_BURN ? lerp(-6.4, -3.6, smooth(0, T_BURN, t))
                             : lerp(-3.6, -8.2, smooth(T_BURN + 0.2, T_TCA + 0.6, t));
      var pc = Math.pow(10, logPc);
      var over = logPc > -4;
      var miss = t < T_BURN ? 0.08 + 0.02 * Math.sin(t * 3)
                            : lerp(0.08, 2.4, smooth(T_BURN, T_TCA + 0.4, t));
      var status = t < T_BURN - 0.6 ? ['TRACKING', ink(0.5)]
                 : t < T_BURN + 1.1 ? ['MANEUVER', col(P.warn)]
                 : ['CLEAR', col(P.accent)];
      var by = hud([
        ['CONJUNCTION ASSESSMENT', ink(0.38)],
        ['Pc      ' + pc.toExponential(1), over ? col(P.warn) : ink(0.9)],
        ['miss    ' + miss.toFixed(2) + ' km', ink(0.9)],
        ['status  ' + status[0], status[1]]
      ], narrow);
      // Threshold bar under the readout.
      if (by != null) {
        var barW = Math.min(150, w * 0.28), bx = 14;
        ctx.fillStyle = ink(0.15);
        ctx.fillRect(bx, by, barW, 3);
        var frac = clamp((logPc + 9) / 6, 0, 1);
        ctx.fillStyle = over ? col(P.warn) : col(P.accent);
        ctx.fillRect(bx, by, barW * frac, 3);
        ctx.fillStyle = ink(0.9);
        ctx.fillRect(bx + barW * ((-4 + 9) / 6), by - 3, 1, 9);
      }

      ctx.globalAlpha = 1;
    }
  };


  // Spacecraft autonomy: an onboard planner grows a search tree of candidate
  // actions from the spacecraft, rollouts stream along its branches, and the
  // best plan lights up and is flown.
  VISUALS.autonomy = (function () {
    // Tree built once: depth 4, three options at the root and two per node after.
    var rnd = seeded(41), nodes = [], DEPTH = 4;
    (function grow(parent, depth, y, spread) {
      var n = depth === 0 ? 1 : depth === 1 ? 3 : 2;
      for (var i = 0; i < n; i++) {
        var node = {
          parent: parent, depth: depth,
          y: depth === 0 ? y : y + (i - (n - 1) / 2) * spread + (rnd() - 0.5) * spread * 0.25,
          value: rnd(), kids: [], appear: 0
        };
        node.appear = depth * 0.85 + (parent ? parent.kids.length * 0.12 : 0) + rnd() * 0.15;
        nodes.push(node);
        if (parent) parent.kids.push(node);
        if (depth < DEPTH) grow(node, depth + 1, node.y, spread * (depth === 0 ? 1 : 0.5));
      }
    })(null, 0, 0, 0.30);
    // Best path: highest leaf value, traced back to the root.
    var leaves = nodes.filter(function (n) { return n.depth === DEPTH; });
    var best = leaves.reduce(function (a, b) { return b.value > a.value ? b : a; });
    var bestPath = [];
    for (var n = best; n; n = n.parent) { n.best = true; bestPath.unshift(n); }
    // Rollout paths: random root-to-leaf walks.
    var rollouts = [];
    for (var r = 0; r < 26; r++) {
      var path = [nodes[0]], cur = nodes[0];
      while (cur.kids.length) { cur = cur.kids[Math.floor(rnd() * cur.kids.length)]; path.push(cur); }
      rollouts.push({ path: path, start: 0.6 + rnd() * 3.6 });
    }

    return {
      caption: 'Enabling safe and autonomous spacecraft operations through intelligent planning and decision-making under uncertainty.',
      period: 12,
      still: 6.4,
      draw: function (w, h, t) {
        var f = frameInfo(w, h, t, 12), s = f.s;
        var x0 = w * (f.narrow ? 0.12 : 0.16), x1 = w * 0.9;
        var yMid = h * (f.narrow ? 0.62 : 0.52), ySpan = h * (f.narrow ? 0.62 : 0.85);
        function pos(node) {
          return { x: lerp(x0, x1, node.depth / DEPTH), y: clamp(yMid + node.y * ySpan, h * (f.narrow ? 0.32 : 0.1), h * 0.76) };
        }
        var choose = smooth(5.0, 5.8, t);            // best plan highlighted
        var fly = smooth(6.2, 10.2, t);              // plan executed
        ctx.globalAlpha = f.fade;

        // Edges grow out from each parent as the node appears.
        nodes.forEach(function (node) {
          if (!node.parent) return;
          var a = pos(node.parent), b = pos(node), g = smooth(node.appear, node.appear + 0.5, t);
          if (g <= 0) return;
          var ex = lerp(a.x, b.x, g), ey = lerp(a.y, b.y, g);
          var dim = node.best ? 1 : 1 - 0.75 * choose;
          ctx.strokeStyle = node.best && choose > 0 ? col(P.accent, 0.35 + 0.6 * choose) : ink(0.22 * dim);
          ctx.lineWidth = node.best ? 1 + 1.4 * choose : 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.bezierCurveTo(lerp(a.x, ex, 0.5), a.y, lerp(a.x, ex, 0.5), ey, ex, ey);
          ctx.stroke();
        });

        // Rollouts: bright dots running root-to-leaf while the tree grows.
        if (t < 5.6) {
          rollouts.forEach(function (ro) {
            var u = (t - ro.start) / 1.1;
            if (u < 0 || u > 1) return;
            var seg = u * (ro.path.length - 1), i = Math.floor(seg), k = seg - i;
            if (i >= ro.path.length - 1) return;
            var a = pos(ro.path[i]), b = pos(ro.path[i + 1]);
            if (t < ro.path[i + 1].appear) return;
            glowDot(lerp(a.x, b.x, k), lerp(a.y, b.y, k), 5 * s, P.accent, 0.9 * (1 - choose));
          });
        }

        // Nodes; the winning leaf shows its value once the plan is chosen.
        ctx.font = Math.round(9 * s) + 'px ' + MONO;
        ctx.textBaseline = 'middle';
        nodes.forEach(function (node) {
          if (!node.parent) return;
          var g = smooth(node.appear + 0.4, node.appear + 0.6, t);
          if (g <= 0) return;
          var p = pos(node), on = node.best && choose > 0;
          ctx.fillStyle = on ? col(P.accent) : ink((0.55 * (node.best ? 1 : 1 - 0.7 * choose)) * g);
          ctx.beginPath(); ctx.arc(p.x, p.y, (on ? 3.2 : 2.3) * s, 0, TAU); ctx.fill();
          if (node.depth === DEPTH && on && !mini) {
            ctx.fillStyle = col(P.accent, choose);
            ctx.fillText('value ' + node.value.toFixed(2), p.x - 62 * s, p.y - 11 * s);
          }
        });

        // Executing the plan: a marker travels the chosen branch.
        if (fly > 0 && fly < 1) {
          var seg = fly * (bestPath.length - 1), i = Math.floor(seg), k = seg - i;
          var a = pos(bestPath[i]), b = pos(bestPath[Math.min(i + 1, bestPath.length - 1)]);
          glowDot(lerp(a.x, b.x, k), lerp(a.y, b.y, k), 10 * s, P.accent, 0.9);
        }

        var root = pos(nodes[0]);
        var aim = pos(bestPath[1]);
        var angle = choose * Math.atan2(aim.y - root.y, aim.x - root.x) * 0.5;
        drawSat(root.x, root.y, angle, s);

        var rolls = Math.floor(clamp(t / 5, 0, 1) * 1284);
        hud([
          ['ONBOARD PLANNER', ink(0.38)],
          ['rollouts  ' + rolls.toLocaleString('en-US'), ink(0.9)],
          ['horizon   ' + DEPTH + ' steps', ink(0.9)],
          ['action    ' + (choose > 0.5 ? 'SLEW + IMAGE' : 'searching'), choose > 0.5 ? col(P.accent) : ink(0.5)]
        ], f.narrow);
        ctx.globalAlpha = 1;
      }
    };
  })();

  // Deep space missions: an orbiter circles Enceladus, dips through the
  // south-polar plumes to sample them, then downlinks toward Earth.
  VISUALS['deep-space'] = (function () {
    var rnd = seeded(97), jets = [];
    for (var i = 0; i < 320; i++) {
      jets.push({ a: (rnd() - 0.5) * 0.9, off: (rnd() - 0.5) * 0.7, life: 1.6 + rnd() * 1.4, phase: rnd() * 3, sp: 0.7 + rnd() * 0.6, r: 0.6 + rnd() * 1.2 });
    }
    var PERIOD = 14, T_PASS = 7.0;     // seconds; T_PASS = time at orbit bottom

    return {
      caption: 'Advancing autonomous planning and navigation capabilities for deep space exploration, where uncertainty, limited communication, and operational constraints demand robust onboard decision-making.',
      period: PERIOD,
      still: 7.0,
      sky: 'deep',
      draw: function (w, h, t) {
        var f = frameInfo(w, h, t, PERIOD), s = f.s;
        var cx = w * 0.5, cy = h * (f.narrow ? 0.5 : 0.44), R = h * (f.narrow ? 0.17 : 0.2);
        var rx = Math.min(w * 0.36, R * 3.4), ry = R * 1.75;
        ctx.globalAlpha = f.fade;

        // Saturn, far off in the top-right.
        var sx = w * 0.86, sy = h * 0.2, sr = h * 0.085;
        function ring(front) {
          ctx.strokeStyle = col(P.saturn, 0.55);
          ctx.lineWidth = 2.2 * s;
          ctx.beginPath();
          ctx.ellipse(sx, sy, sr * 2.1, sr * 0.55, -0.35, front ? 0 : Math.PI, front ? Math.PI : TAU);
          ctx.stroke();
        }
        ring(false);
        var sg = ctx.createRadialGradient(sx - sr * 0.4, sy - sr * 0.4, sr * 0.1, sx, sy, sr);
        sg.addColorStop(0, col(P.saturn, 0.95));
        sg.addColorStop(1, col([120, 100, 70], 0.9));
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
        ring(true);

        // Probe on its orbit; angle pi/2 is the bottom of the ellipse.
        var th = Math.PI / 2 + TAU * (t - T_PASS) / PERIOD;
        function probe(a) { return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; }
        function orbitHalf(front) {
          ctx.strokeStyle = ink(front ? 0.3 : 0.14);
          ctx.setLineDash([2, 5]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        var pr = probe(th), front = Math.sin(th) > 0;
        var heading = Math.atan2(Math.cos(th) * ry, -Math.sin(th) * rx);

        orbitHalf(false);
        if (!front) drawSat(pr.x, pr.y, heading, s * 0.75);

        // Plumes: icy particles fountaining from the south pole, pulsing.
        var activity = 0.7 + 0.3 * Math.sin(t * 0.9);
        jets.forEach(function (j) {
          var age = ((t * j.sp + j.phase) % j.life) / j.life;
          var dist = age * R * 2.6;
          var ang = Math.PI / 2 + j.a;
          var px = cx + j.off * R * 0.6 + Math.cos(ang) * dist;
          var py = cy + R * 0.92 + Math.sin(ang) * dist;
          var a = (1 - age) * 0.9 * activity;
          ctx.fillStyle = col(P.ice, a.toFixed(3));
          ctx.beginPath(); ctx.arc(px, py, j.r * s * (0.6 + age), 0, TAU); ctx.fill();
        });

        // Enceladus: bright ice with terminator shading.
        var mg = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.45, R * 0.1, cx, cy, R * 1.05);
        mg.addColorStop(0, '#f4f8ff');
        mg.addColorStop(0.6, '#b9c6dc');
        mg.addColorStop(1, '#3c4760');
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

        orbitHalf(true);

        // Sampling when the probe crosses the plume column.
        var inPlume = front && Math.abs(Math.cos(th)) < 0.28;
        if (front) {
          if (inPlume) glowDot(pr.x, pr.y, 16 * s, P.ice, 0.5);
          drawSat(pr.x, pr.y, heading, s * 0.75);
        }

        // Downlink after the pass: packets streaming toward Earth (off-frame).
        var down = t > T_PASS + 1.2 && t < T_PASS + 4.8;
        if (down) {
          var ex = w * 0.04, ey = h * 0.04;
          ctx.strokeStyle = col(P.accent, 0.25);
          ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.setLineDash([]);
          for (var q = 0; q < 4; q++) {
            var u = ((t * 0.6 + q / 4) % 1);
            glowDot(lerp(pr.x, ex, u), lerp(pr.y, ey, u), 4 * s, P.accent, 0.9);
          }
        }

        var samples = Math.floor(14 * smooth(T_PASS - 0.9, T_PASS + 0.9, t)) + 23;
        var mode = inPlume ? ['SAMPLING', col(P.ice)] : down ? ['DOWNLINK', col(P.accent)] : ['CRUISE', ink(0.5)];
        hud([
          ['ENCELADUS ORBITER', ink(0.38)],
          ['plume    ' + (activity > 0.75 ? 'ACTIVE' : 'quiet'), activity > 0.75 ? col(P.ice) : ink(0.6)],
          ['samples  ' + samples, ink(0.9)],
          ['mode     ' + mode[0], mode[1]]
        ], f.narrow);
        ctx.globalAlpha = 1;
      }
    };
  })();

  // Ground station networks: a constellation over a rotating Earth, with
  // contact links opening and closing as satellites pass over stations.
  VISUALS['ground-stations'] = (function () {
    var STATIONS = [[64.8, -147.7], [37.4, -122.2], [40.4, -4.2], [-35.4, 149], [78.2, 15.4],
                    [1.3, 103.8], [-25.9, 27.7], [19.8, -155.5], [-33.4, -70.6], [35.6, 139.7],
                    [52.2, 0.1], [-12.0, -77.0]];
    var PLANES = [[53, 0], [53, 120], [53, 240], [97, 60]];   // inclination, node (deg)
    var PER_PLANE = 4, ALT = 1.3, PERIOD = 12;
    var DEG = Math.PI / 180;

    return {
      caption: 'Strategic placement and optimization of ground station networks for reliable and efficient spacecraft communication.',
      period: PERIOD,
      still: 4,
      sky: 'deep',
      draw: function (w, h, t) {
        var f = frameInfo(w, h, t, PERIOD), s = f.s;
        var R = f.narrow ? h * 0.26 : Math.min(h * 0.33, w * 0.24);
        var v = globeView(f.narrow ? w * 0.5 : w * 0.58, f.narrow ? h * 0.6 : h * 0.54, R, 0.42);
        var rot = t * 0.18;
        ctx.globalAlpha = f.fade;

        var sats = [];
        PLANES.forEach(function (pl, pi) {
          for (var k = 0; k < PER_PLANE; k++) {
            var u = k / PER_PLANE * TAU + pi * 0.7 + t * 0.42;
            var wp = orbitPoint(ALT, pl[0] * DEG, pl[1] * DEG, u);
            sats.push({ w: wp, q: v.p(wp[0], wp[1], wp[2]), u: u, pl: pl });
          }
        });
        var sts = STATIONS.map(function (st) {
          var wp = surface(st[0], st[1], rot);
          return { w: wp, q: v.p(wp[0], wp[1], wp[2]), linked: false };
        });

        // Satellites and rings behind the planet first.
        PLANES.forEach(function (pl) { drawOrbitRing(v, ALT, pl[0] * DEG, pl[1] * DEG, P.ink, 0.13); });
        sats.forEach(function (sa) { if (v.hidden(sa.q)) drawSat(sa.q.x, sa.q.y, 0, s * 0.42, [90, 110, 170]); });

        drawGlobe(v, rot);

        // Links: line of sight above ~10 deg elevation.
        var links = 0;
        sats.forEach(function (sa) {
          if (v.hidden(sa.q)) return;
          var n = Math.hypot(sa.w[0], sa.w[1], sa.w[2]);
          sts.forEach(function (st) {
            if (st.q.z <= 0) return;
            var dot = (sa.w[0] * st.w[0] + sa.w[1] * st.w[1] + sa.w[2] * st.w[2]) / n;
            if (dot < 0.86) return;
            st.linked = true;
            links++;
            var strength = smooth(0.86, 0.93, dot);
            ctx.strokeStyle = col(P.accent, 0.25 + 0.55 * strength);
            ctx.lineWidth = 1.1;
            ctx.setLineDash([3, 3]);
            ctx.lineDashOffset = -t * 30;
            ctx.beginPath(); ctx.moveTo(st.q.x, st.q.y); ctx.lineTo(sa.q.x, sa.q.y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
          });
        });

        // Stations: rings pulse while in contact.
        sts.forEach(function (st) {
          if (st.q.z <= 0) return;
          var edge = smooth(0, 0.25, st.q.z);
          if (st.linked) {
            var pulse = (t * 1.6) % 1;
            ctx.strokeStyle = col(P.accent, (1 - pulse) * 0.7 * edge);
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(st.q.x, st.q.y, (3 + pulse * 9) * s, 0, TAU); ctx.stroke();
          }
          ctx.fillStyle = st.linked ? col(P.accent, edge) : ink(0.55 * edge);
          ctx.beginPath(); ctx.arc(st.q.x, st.q.y, 2.4 * s, 0, TAU); ctx.fill();
        });

        sats.forEach(function (sa) {
          if (v.hidden(sa.q)) return;
          var ahead = orbitPoint(ALT, sa.pl[0] * DEG, sa.pl[1] * DEG, sa.u + 0.05);
          var qa = v.p(ahead[0], ahead[1], ahead[2]);
          drawSat(sa.q.x, sa.q.y, Math.atan2(qa.y - sa.q.y, qa.x - sa.q.x), s * 0.5);
        });

        var gb = (18.4 + t * 0.9 * (1 + links * 0.15)).toFixed(1);
        hud([
          ['CONTACT SCHEDULE', ink(0.38)],
          ['stations  ' + STATIONS.length, ink(0.9)],
          ['links     ' + links, links ? col(P.accent) : ink(0.6)],
          ['downlink  ' + gb + ' GB', ink(0.9)]
        ], f.narrow);
        ctx.globalAlpha = 1;
      }
    };
  })();

  // Federated learning in space: satellites drift across the sky training
  // locally, send model updates (not raw data) down to a ground station that
  // merges them into the global model, and receive it back; one client drops
  // out for a round as its link closes.
  VISUALS.fl = (function () {
    var N = 7, ROUND = 6, PERIOD = 12;
    var ACC = [71.4, 78.9, 84.6];               // global accuracy per round, %

    return {
      caption: 'Federated learning across satellite constellations: training models in orbit and sharing updates instead of raw data, under intermittent links and tight onboard compute.',
      period: PERIOD,
      still: 3.0,
      draw: function (w, h, t) {
        var f = frameInfo(w, h, t, PERIOD), s = f.s;
        var round = Math.min(Math.floor(t / ROUND), 1), rt = t - round * ROUND;
        ctx.globalAlpha = f.fade;

        // Ground station on top of the limb (same circle as drawLimb).
        var limbR = w * 1.6, lcx = w * 0.5, lcy = h * 0.86 + limbR;
        var gs = { x: w * 0.5, y: h * 0.86 };
        // Orbit: an arc concentric with the limb; satellites drift along it.
        var orbitR = limbR + h * 0.42;
        var clients = [];
        for (var i = 0; i < N; i++) {
          var p = ((i + 0.5) / N + t * 0.012) % 1;               // 0..1 across the frame
          var x = w * (-0.04 + 1.08 * p);
          var y = lcy - Math.sqrt(orbitR * orbitR - (x - lcx) * (x - lcx));
          var edge = smooth(0, 0.06, p) * (1 - smooth(0.94, 1, p));
          clients.push({ x: x, y: y, edge: edge, off: round === 1 && i === 4 });
        }

        var train = smooth(0.2, 2.4, rt);
        var up = clamp((rt - 2.5) / 1.1, 0, 1);
        var merge = smooth(3.6, 3.9, rt) * (1 - smooth(4.1, 4.6, rt));
        var down = clamp((rt - 4.3) / 1.1, 0, 1);

        // Links to the ground station; an offline client's link is broken.
        clients.forEach(function (c) {
          ctx.setLineDash(c.off ? [2, 6] : [3, 4]);
          ctx.strokeStyle = c.off ? col(P.warn, 0.35 * c.edge) : ink(0.12 * c.edge);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(gs.x, gs.y); ctx.stroke();
        });
        ctx.setLineDash([]);

        // Packets: model updates down, merged global model back up.
        clients.forEach(function (c, i) {
          if (c.off) return;
          var lag = i * 0.04;
          var u1 = clamp(up * 1.25 - lag, 0, 1), u2 = clamp(down * 1.25 - lag, 0, 1);
          if (u1 > 0 && u1 < 1) glowDot(lerp(c.x, gs.x, u1), lerp(c.y, gs.y, u1), 5 * s, P.accent, 0.95 * c.edge);
          if (u2 > 0 && u2 < 1) glowDot(lerp(gs.x, c.x, u2), lerp(gs.y, c.y, u2), 5 * s, P.ink, 0.85 * c.edge);
        });

        // Ground station: a dish that flares when the updates are merged.
        if (merge > 0) {
          ctx.strokeStyle = col(P.accent, 0.8 * merge);
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(gs.x, gs.y - 8 * s, (10 + 26 * (1 - merge)) * s, 0, TAU); ctx.stroke();
          glowDot(gs.x, gs.y - 8 * s, 30 * s, P.accent, 0.5 * merge);
        }
        ctx.save();
        ctx.translate(gs.x, gs.y);
        ctx.scale(s, s);
        ctx.strokeStyle = col(P.accent);
        ctx.fillStyle = col(P.accent);
        ctx.shadowColor = col(P.accent); ctx.shadowBlur = 10;
        ctx.lineWidth = 1.6;
        ctx.fillRect(-6, -2, 12, 2);                                                // base
        ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -9); ctx.stroke();        // mast
        ctx.translate(0, -11);
        ctx.rotate(-0.55);                                                          // tilt toward the sky
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI); ctx.closePath(); ctx.fill(); // bowl
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -9); ctx.stroke();         // feed arm
        ctx.beginPath(); ctx.arc(0, -10, 1.8, 0, TAU); ctx.fill();                  // feed horn
        ctx.restore();
        if (!mini) {
          ctx.font = Math.round(9 * s) + 'px ' + MONO;
          ctx.fillStyle = ink(0.5);
          ctx.textBaseline = 'middle';
          ctx.fillText('global model', gs.x + 16 * s, gs.y - 10 * s);
        }

        // Clients: local-training progress ring around each satellite.
        clients.forEach(function (c) {
          ctx.globalAlpha = f.fade * c.edge;
          if (!c.off) {
            ctx.strokeStyle = col(P.accent, 0.8);
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(c.x, c.y, 15 * s, -Math.PI / 2, -Math.PI / 2 + TAU * train); ctx.stroke();
          }
          drawSat(c.x, c.y, 0, s * 0.55, c.off ? [110, 118, 140] : P.accent);
        });
        ctx.globalAlpha = f.fade;

        var acc = down > 0.5 ? ACC[round + 1] : ACC[round];
        var online = N - (round === 1 ? 1 : 0);
        hud([
          ['FEDERATED TRAINING', ink(0.38)],
          ['round     ' + (round + 5), ink(0.9)],
          ['clients   ' + online + '/' + N, online < N ? col(P.warn) : ink(0.9)],
          ['global    ' + acc.toFixed(1) + '%', col(P.accent)]
        ], f.narrow);
        ctx.globalAlpha = 1;
      }
    };
  })();

  // Space policy: an orbital shell crowds with objects, a collision throws
  // off a fragment cloud, then a deorbit rule clears it out over time.
  VISUALS.policy = (function () {
    var rnd = seeded(23), objs = [], PERIOD = 13, T_HIT = 3.0, T_RULE = 6.0;
    for (var i = 0; i < 110; i++) {
      objs.push({ r: 1.18 + rnd() * 0.42, inc: rnd() * Math.PI, raan: rnd() * TAU, u0: rnd() * TAU,
                  sp: 0.25 + rnd() * 0.25, frag: false, decay: 0.3 + rnd() * 0.65 });
    }
    var hit = { r: 1.38, inc: 1.0, raan: 0.6, u: 0.9 };
    for (var k = 0; k < 70; k++) {
      objs.push({ r: hit.r + (rnd() - 0.5) * 0.12, inc: hit.inc + (rnd() - 0.5) * 0.5, raan: hit.raan + (rnd() - 0.5) * 0.4,
                  u0: hit.u + (rnd() - 0.5) * 0.08, spread: (rnd() - 0.5) * 1.8, sp: 0.32, frag: true, decay: 0.05 + rnd() * 0.5 });
    }
    var DEG = Math.PI / 180;

    return {
      caption: 'Technical and legal frameworks for collision prevention, liability, and debris remediation as autonomous space operations scale.',
      period: PERIOD,
      still: 4.6,
      sky: 'deep',
      draw: function (w, h, t) {
        var f = frameInfo(w, h, t, PERIOD), s = f.s;
        var R = f.narrow ? h * 0.22 : Math.min(h * 0.27, w * 0.2);
        var v = globeView(f.narrow ? w * 0.5 : w * 0.6, f.narrow ? h * 0.62 : h * 0.54, R, 0.35);
        var rot = t * 0.1;
        ctx.globalAlpha = f.fade;

        var rule = smooth(T_RULE, T_RULE + 0.6, t);
        var count = 0, behind = [], front = [];
        objs.forEach(function (o) {
          var born = o.frag ? smooth(T_HIT, T_HIT + 0.3, t) : 1;
          if (born <= 0) return;
          // After the rule, objects decay in turn: radius falls to the surface.
          var dt = Math.max(0, t - (T_RULE + 0.4 + o.decay * 4.5));
          var gone = clamp(dt / 1.2, 0, 1);
          if (gone >= 1) return;
          count++;
          var spreadU = o.frag ? o.spread * smooth(T_HIT, T_HIT + 3, t) : 0;
          var u = o.u0 + spreadU + (o.frag ? (t - T_HIT) * o.sp : t * o.sp);
          var r = lerp(o.r, 1.0, gone * gone);
          var wp = orbitPoint(r, o.inc, o.raan, u), q = v.p(wp[0], wp[1], wp[2]);
          var item = { q: q, o: o, gone: gone, born: born };
          (v.hidden(q) ? behind : front).push(item);
        });

        function dot(it, dim) {
          var c = it.o.frag ? P.warn : P.debris;
          var a = (it.gone > 0 ? 1 - it.gone : 1) * it.born * (dim ? 0.3 : 0.85);
          if (it.gone > 0 && !dim) glowDot(it.q.x, it.q.y, 6 * s, P.plume, 0.6 * (1 - it.gone));   // re-entry glow
          ctx.fillStyle = col(c, a.toFixed(3));
          ctx.beginPath(); ctx.arc(it.q.x, it.q.y, (it.o.frag ? 1.3 : 1.7) * s, 0, TAU); ctx.fill();
        }
        behind.forEach(function (it) { dot(it, true); });
        drawGlobe(v, rot);
        front.forEach(function (it) { dot(it, false); });

        // Collision flash.
        var flash = smooth(T_HIT - 0.05, T_HIT + 0.05, t) * (1 - smooth(T_HIT + 0.1, T_HIT + 1.0, t));
        if (flash > 0) {
          var hp = orbitPoint(hit.r, hit.inc, hit.raan, hit.u + T_HIT * 0.32), hq = v.p(hp[0], hp[1], hp[2]);
          glowDot(hq.x, hq.y, 40 * s * flash + 4, P.plume, 0.95 * flash);
        }

        var tracked = 27800 + count * 37;
        var trend = t < T_RULE + 1 ? ['rising', col(P.warn)] : ['falling', col(P.accent)];
        hud([
          ['ORBITAL COMMONS', ink(0.38)],
          ['objects  ' + tracked.toLocaleString('en-US'), t > T_HIT && t < T_RULE + 1 ? col(P.warn) : ink(0.9)],
          ['rule     ' + (rule > 0.5 ? '5-yr deorbit' : 'none'), rule > 0.5 ? col(P.accent) : ink(0.5)],
          ['trend    ' + trend[0], trend[1]]
        ], f.narrow);
        ctx.globalAlpha = 1;
      }
    };
  })();

  // Areas with a caption but no visual: the caption shows on its own.
  var CAPTIONS = {
    pomdp: 'Developing planning and decision-making methods under partial observability, enabling autonomous agents to reason about uncertainty, manage risk, and act with incomplete information.',
    ai: 'Studying the evaluation, reliability, and governance of artificial intelligence systems to better understand their capabilities, limitations, and implications for real-world deployment.',
    robotics: 'Developing hardware and control methods that enable robotic systems to make robust decisions and operate autonomously in complex, uncertain environments.'
  };

  // ---------- stage ----------
  //
  // Two modes: one area's visual full width on the main canvas, or, for
  // "all", a grid of small live tiles (one per area in GRID) that each pick
  // that area when clicked.

  var GRID = ['autonomy', 'conjunction', 'deep-space', 'ground-stations', 'fl', 'policy'];
  var grid = stage.querySelector('.area-grid');
  var mainCtx = ctx, tiles = [];
  var mode = null, current = null, t0 = 0, raf = 0, visible = true;
  var w = 0, h = 0;

  function fit(cv, c) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = cv.clientWidth, ch = cv.clientHeight;
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: cw, h: ch };
  }

  function resize() {
    if (mode === 'one') { var d = fit(canvas, mainCtx); w = d.w; h = d.h; }
    if (mode === 'grid') tiles.forEach(function (tl) { var d = fit(tl.canvas, tl.ctx); tl.w = d.w; tl.h = d.h; });
    if (reduceMotion) render();
  }

  // `sky: 'deep'` is open space; the default adds Earth's limb along the bottom.
  function background(v, t) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.sky[0]);
    g.addColorStop(1, P.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    drawStars(w, h, t);
    if (v.sky !== 'deep') drawLimb(w, h, 0.86);
  }

  function paint(v, elapsed) {
    ctx.clearRect(0, 0, w, h);
    background(v, elapsed);
    v.draw(w, h, reduceMotion ? v.still : elapsed % v.period);
  }

  function render() {
    var elapsed = (performance.now() - t0) / 1000;
    if (mode === 'one') {
      ctx = mainCtx;
      paint(VISUALS[current], reduceMotion ? VISUALS[current].still : elapsed);
    } else if (mode === 'grid') {
      mini = true;
      tiles.forEach(function (tl) {
        ctx = tl.ctx; w = tl.w; h = tl.h;
        paint(VISUALS[tl.key], reduceMotion ? VISUALS[tl.key].still : elapsed);
      });
      mini = false;
      ctx = mainCtx;
    }
  }

  function loop() {
    if (!mode) return;
    render();
    if (!reduceMotion && visible) raf = requestAnimationFrame(loop);
  }

  function start(newMode) {
    cancelAnimationFrame(raf);
    mode = newMode;
    stage.hidden = false;
    canvas.hidden = mode !== 'one';
    grid.hidden = mode !== 'grid';
    stage.classList.remove('is-in');
    void stage.offsetWidth;               // restart the fade-in
    stage.classList.add('is-in');
    resize();
    t0 = performance.now();
    if (reduceMotion) render(); else raf = requestAnimationFrame(loop);
  }

  // Tiles are built once; labels come from the area tags in the list.
  function buildTiles() {
    if (tiles.length) return;
    GRID.filter(function (k) { return VISUALS[k]; }).forEach(function (key) {
      var tag = document.querySelector('.pub-list .tag[data-area="' + key + '"]');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'area-tile';
      b.dataset.area = key;
      var cv = document.createElement('canvas');
      cv.setAttribute('aria-hidden', 'true');
      var label = document.createElement('span');
      label.className = 'area-tile-label';
      label.textContent = tag ? tag.textContent.trim() : key;
      b.appendChild(cv);
      b.appendChild(label);
      grid.appendChild(b);
      tiles.push({ key: key, canvas: cv, ctx: cv.getContext('2d'), w: 0, h: 0 });
    });
  }

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.area-tile');
    if (b) document.dispatchEvent(new CustomEvent('pubs:pick', { detail: { area: b.dataset.area } }));
  });

  document.addEventListener('pubs:area', function (e) {
    var area = e.detail.area;
    if (area === 'all') {
      buildTiles();
      caption.textContent = '';
      start('grid');
    } else if (VISUALS[area]) {
      current = area;
      caption.textContent = VISUALS[area].caption;
      start('one');
    } else {
      cancelAnimationFrame(raf);
      mode = null;
      stage.hidden = !CAPTIONS[area];
      if (CAPTIONS[area]) {
        caption.textContent = CAPTIONS[area];
        canvas.hidden = grid.hidden = true;
        stage.classList.remove('is-in');
        void stage.offsetWidth;
        stage.classList.add('is-in');
      }
    }
  });

  window.addEventListener('resize', function () { if (mode) resize(); });

  // Pause while scrolled out of view.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && mode && !reduceMotion) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    }).observe(stage);
  }
})();
