/* ajmalps.com - Crane Lift Calculator.
   Calculation rules that must not be quietly reversed:
   - No more than 2 sling legs are assumed to carry, whatever number is fitted (BS 7121).
   - The hook block hangs above the slings, so it is excluded from sling tension and from
     the wind mass. It stays inside Total Lift Weight and crane utilisation.
   - Wind: v = vChart * sqrt(1.2 * m / (A * cw)). The 1.2 is the chart's sail-area-per-tonne
     constant (m^2/T), NOT air density. Result is capped at vChart.
   - Boom length uses the full rigging stack, not the target height.
   - A blank or impossible input must never render green. Show "--" and flag it. */
(function () {
  'use strict';

  var CHART_REF_RATIO = 1.2;

  function el(id) { return document.getElementById(id); }
  function num(id) { var e = el(id); return e ? (parseFloat(e.value) || 0) : 0; }
  function txt(id, s) { var e = el(id); if (e) e.textContent = s; }

  /* state is one of: '', 'ok', 'bad', 'warn', 'dim' */
  function state(id, s) {
    var e = el(id);
    if (!e) return;
    e.classList.remove('ok', 'bad', 'warn');
    if (s) e.classList.add(s);
  }

  function svgText(id, s, cls) {
    var e = el(id);
    if (!e) return;
    e.textContent = s;
    if (cls) {
      e.classList.remove('ok', 'bad', 'warn');
      e.classList.add(cls);
    }
  }

  function useSuggestedPad() {
    el('padDimension').value = el('resSuggestedPad').textContent;
    calc();
  }
  function useSuggestedSail() {
    el('sailArea').value = el('resSuggestedSail').textContent;
    calc();
  }

  function calc() {
    /* ---------- 1. Lift data ---------- */
    var loadWeight = num('loadWeight');
    var gearWeight = num('gearWeight');
    var hookBlockWeight = num('hookBlockWeight');
    var chartCapacity = num('chartCapacity');

    var totalLiftWeight = loadWeight + gearWeight + hookBlockWeight;
    /* what actually hangs below the hook block */
    var suspendedWeight = loadWeight + gearWeight;

    var capacityKnown = chartCapacity > 0;
    var utilization = capacityKnown ? (totalLiftWeight / chartCapacity) * 100 : 0;

    txt('resTotalLift', totalLiftWeight.toFixed(2));
    if (!capacityKnown) {
      txt('resUtilization', '--');
      state('utilizationBadge', 'warn');
    } else {
      txt('resUtilization', utilization.toFixed(1) + ' %');
      state('utilizationBadge', utilization > 90 ? 'bad' : (utilization > 75 ? 'warn' : 'ok'));
    }

    /* ---------- 2. Ground pressure ---------- */
    var craneWeight = num('craneWeight');
    var counterWeight = num('counterWeight');
    var outriggerFactor = num('outriggerFactor');
    var gbp = num('gbp');
    var padDimension = num('padDimension');

    var outriggerForce = ((craneWeight + counterWeight) * outriggerFactor) + totalLiftWeight;
    var requiredArea = gbp > 0 ? outriggerForce / gbp : 0;
    var minPadDimension = Math.sqrt(requiredArea);
    var suggestedPad = Math.ceil(minPadDimension * 10) / 10;
    var actualPadArea = padDimension * padDimension;
    var actualPressure = actualPadArea > 0 ? outriggerForce / actualPadArea : 0;

    txt('resOutriggerForce', outriggerForce.toFixed(2));
    txt('resRequiredArea', requiredArea.toFixed(2));
    txt('resMinPad', minPadDimension.toFixed(3));
    txt('resSuggestedPad', suggestedPad.toFixed(2));
    txt('resActualArea', actualPadArea.toFixed(2));
    txt('resActualPressure', actualPressure.toFixed(2));

    /* one source of truth: a missing GBP is unknown, never a pass */
    var gbpKnown = gbp > 0;
    var gpPass = gbpKnown && actualPressure <= gbp;
    var gpCls = !gbpKnown ? 'warn' : (gpPass ? 'ok' : 'bad');
    state('pressureBadge', gpCls);

    txt('gpForceLabel', 'Force: ' + outriggerForce.toFixed(2) + ' T');
    txt('gpPadLabel', padDimension.toFixed(2) + ' x ' + padDimension.toFixed(2) + ' m');
    var gpPad = el('gpPad');
    if (gpPad) {
      gpPad.classList.remove('ok', 'bad', 'warn');
      gpPad.classList.add(gpCls);
    }
    svgText('gpStatusLabel', !gbpKnown
      ? 'ENTER GBP LIMIT'
      : (gpPass ? 'PASS — ' : 'FAIL — ') + actualPressure.toFixed(1) + ' / ' + gbp + ' T/m²',
      gpCls);
    ['outriggerPadLeft', 'outriggerPadRight'].forEach(function (id) {
      var e = el(id);
      if (e) { e.classList.remove('ok', 'bad', 'warn'); e.classList.add(gpCls); }
    });

    /* ---------- 3. Wind ---------- */
    var refInput = el('densityFactor');
    if (refInput && parseFloat(refInput.value) !== CHART_REF_RATIO) refInput.value = CHART_REF_RATIO;

    var vChart = num('vChart');
    var sailArea = num('sailArea');
    var dragCoeff = num('dragCoeff');
    var loadMass = suspendedWeight;

    var numerator = CHART_REF_RATIO * loadMass;
    var denominator = sailArea * dragCoeff;
    var windRaw = (denominator > 0 && numerator > 0) ? vChart * Math.sqrt(numerator / denominator) : 0;
    /* the chart wind speed is the crane's structural limit */
    var maxWind = Math.min(windRaw, vChart);

    txt('resLoadMassUsed', loadMass.toFixed(2));
    txt('resSailAreaUsed', sailArea.toFixed(2));
    txt('resWindRaw', windRaw.toFixed(2));
    txt('resMaxWind', maxWind.toFixed(2));
    txt('wsSpeedLabel', 'Max: ' + maxWind.toFixed(2) + ' m/s');

    var capNote = el('windCapNote');
    if (capNote) {
      if (denominator <= 0 || numerator <= 0) capNote.textContent = 'Enter load weight, sail area and Cw.';
      else if (windRaw > vChart && vChart > 0) capNote.textContent = 'Capped at V Chart (' + vChart.toFixed(1) + ' m/s). Crane limit governs.';
      else capNote.innerHTML = '&nbsp;';
    }

    var loadLength = num('loadLength');
    var loadWidth = num('loadWidth');
    var loadHeight = num('loadHeight');
    txt('resSuggestedSail', (Math.max(loadLength, loadWidth) * loadHeight).toFixed(2));

    /* ---------- 4. Slings ---------- */
    var slingLegs = parseInt(el('slingLegs').value, 10) || 1;
    var slingWLL = num('slingWLL');

    var hitchSel = el('hitchType');
    var hitchOpt = hitchSel.options[hitchSel.selectedIndex];
    /* factor lives in data-factor: two hitches share 1.0, so option values must stay unique */
    var hitchFactor = (hitchOpt && parseFloat(hitchOpt.dataset.factor)) || 1.0;
    /* a vertical hitch only earns its factor with vertical legs, and one leg can only hang
       vertically, so force 90 and stop the angle credit being claimed twice */
    var forceVertical = (hitchOpt && hitchOpt.dataset.vertical === '1') || slingLegs === 1;

    var angleInput = el('slingAngle');
    if (forceVertical) { angleInput.value = 90; angleInput.readOnly = true; }
    else { angleInput.readOnly = false; }

    var slingAngleRaw = num('slingAngle');
    var slingAngle = Math.min(90, Math.max(0, slingAngleRaw));
    var angleValid = slingAngleRaw > 0 && slingAngleRaw <= 90;

    var effectiveWLL = slingWLL * hitchFactor;
    /* never more than 2, whatever is fitted */
    var legsSharing = Math.min(slingLegs, 2);

    var sinA = Math.sin(slingAngle * Math.PI / 180) || 0.0001;
    var tensionPerLeg = suspendedWeight / (legsSharing * sinA);
    var slingUtil = effectiveWLL > 0 ? (tensionPerLeg / effectiveWLL) * 100 : 0;

    txt('resSlingLoad', suspendedWeight.toFixed(2));
    txt('resTension', tensionPerLeg.toFixed(2));

    txt('legShareNote', slingLegs === 1
      ? 'Single leg, vertical (90° forced).'
      : 'Legs assumed to carry: ' + legsSharing + ' of ' + slingLegs
        + (slingLegs > 2 ? '. Never assume all ' + slingLegs + ' share.' : ''));

    var hitchNote = el('hitchNote');
    if (forceVertical) hitchNote.textContent = 'Angle locked to 90° for this hitch.';
    else hitchNote.innerHTML = '&nbsp;';

    /* utilisation only means something with a WLL and a usable angle */
    var utilMeaningful = effectiveWLL > 0 && angleValid;
    if (!utilMeaningful) {
      txt('resSlingUtil', '--');
      state('slingUtilBadge', 'warn');
    } else {
      txt('resSlingUtil', slingUtil.toFixed(1) + ' %');
      state('slingUtilBadge', slingUtil > 100 ? 'bad' : (slingUtil > 80 ? 'warn' : 'ok'));
    }

    var statusText, statusCls;
    if (effectiveWLL <= 0) { statusText = 'ENTER WLL'; statusCls = 'warn'; }
    else if (!angleValid) { statusText = 'CHECK ANGLE'; statusCls = 'warn'; }
    else if (slingAngle < 30) { statusText = 'FAIL — LOW ANGLE'; statusCls = 'bad'; }
    else if (slingUtil > 100) { statusText = 'FAIL'; statusCls = 'bad'; }
    else { statusText = 'PASS'; statusCls = 'ok'; }
    txt('resSlingStatus', statusText);
    state('slingStatusBadge', statusCls);

    /* ---------- 5. Rigging stack (Boom Geometry needs it) ---------- */
    var targetHeight = num('targetHeight');
    var workingRadius = num('workingRadius');
    var pivotHeight = num('pivotHeight');
    var slingLength = num('slingLength');
    var hookHeight = num('hookHeight');
    var clearanceMargin = num('clearanceMargin');

    var slingVerticalDrop = slingLength * sinA;
    /* clearance kept out of the stack so the on-screen label matches the maths */
    var riggingStack = hookHeight + slingVerticalDrop + loadHeight;
    var heightRequired = targetHeight + clearanceMargin + riggingStack;

    /* ---------- 6. Boom geometry ---------- */
    var riseNeeded = Math.max(heightRequired - pivotHeight, 0);
    var requiredBoomLength = Math.sqrt(workingRadius * workingRadius + riseNeeded * riseNeeded);
    var requiredBoomAngle = Math.atan2(riseNeeded, workingRadius) * 180 / Math.PI;

    txt('resTipHeight', heightRequired.toFixed(2));
    txt('resRise', riseNeeded.toFixed(2));
    txt('resBoomLength', requiredBoomLength.toFixed(2));
    txt('resBoomAngle', requiredBoomAngle.toFixed(2));

    /* ---------- 7. Headroom display ---------- */
    txt('resSlingDrop', slingVerticalDrop.toFixed(2));
    txt('resRiggingStack', riggingStack.toFixed(2));
    txt('resClearanceShown', clearanceMargin.toFixed(2));
    txt('resHeightRequired', heightRequired.toFixed(2));

    drawSling(slingAngle, slingLegs, legsSharing, tensionPerLeg, utilMeaningful, slingUtil, effectiveWLL);
    drawBoom(workingRadius, riseNeeded, requiredBoomLength, requiredBoomAngle, targetHeight, slingAngle);
    drawHeadroom(targetHeight, riggingStack + clearanceMargin, heightRequired);
  }

  /* ---------- Sling diagram ---------- */
  function drawSling(angle, legs, sharing, tension, utilOk, util, wll) {
    var hookX = 150, hookY = 84, legPx = 72;
    var rad = angle * Math.PI / 180;
    var spread = legPx * Math.cos(rad);
    var drop = legPx * Math.sin(rad);
    var topY = hookY + drop;

    var pos = legs === 1 ? [0] : legs === 2 ? [-1, 1] : legs === 3 ? [-1, 0, 1] : [-1, -0.4, 0.4, 1];
    var parts = '';
    pos.forEach(function (p) {
      var x = hookX + p * spread;
      parts += '<line x1="' + hookX + '" y1="' + hookY + '" x2="' + x + '" y2="' + topY + '" class="d-rope" stroke-width="1.8"/>';
      parts += '<rect x="' + (x - 3) + '" y="' + (topY - 3) + '" width="6" height="5" rx="1" fill="var(--d-load-s)"/>';
    });

    var lbl = el('srAngleLabel');
    if (legs >= 2 && spread > 6) {
      var ax = hookX - spread, r = 14;
      parts += '<line x1="' + (ax - 6) + '" y1="' + topY + '" x2="' + (ax + 30) + '" y2="' + topY + '" class="d-line" stroke-width="1.3" stroke-dasharray="5,4"/>';
      parts += '<path d="M ' + (ax + r) + ' ' + topY + ' A ' + r + ' ' + r + ' 0 0 0 ' +
        (ax + r * Math.cos(rad)) + ' ' + (topY - r * Math.sin(rad)) + '" stroke="var(--blue)" stroke-width="2" fill="none"/>';
      lbl.setAttribute('x', ax + r + 7);
      lbl.setAttribute('y', topY - 7);
    } else {
      lbl.setAttribute('x', hookX + 14);
      lbl.setAttribute('y', (hookY + topY) / 2);
    }
    lbl.setAttribute('text-anchor', 'start');
    lbl.textContent = angle.toFixed(0) + '°';
    el('srSlingLegs').innerHTML = parts;

    var box = el('srLoadBox');
    box.setAttribute('x', hookX - 40);
    box.setAttribute('y', topY);
    box.setAttribute('width', 80);
    box.setAttribute('height', 30);

    txt('srTensionLabel', 'Tension: ' + tension.toFixed(2) + ' T/leg (' + sharing + ' of ' + legs + ' sharing)');

    var pass = utilOk && angle >= 30 && util <= 100;
    if (!utilOk) svgText('srStatusLabel', wll > 0 ? 'CHECK ANGLE' : 'ENTER SLING WLL', 'warn');
    else svgText('srStatusLabel', (pass ? 'PASS — ' : 'FAIL — ') + util.toFixed(0) + '% WLL', pass ? 'ok' : 'bad');
  }

  /* ---------- Boom / overview diagram ---------- */
  function drawBoom(radius, rise, len, angle, target, slingAngle) {
    var pivotX = 67, pivotY = 160;
    var scale = 150 / Math.max(radius, rise, 1);
    var tipX = Math.min(pivotX + radius * scale, 330);
    var tipY = Math.max(pivotY - rise * scale, 15);

    var dx = tipX - pivotX, dy = tipY - pivotY;
    var px = Math.sqrt(dx * dx + dy * dy) || 1;

    var g = el('boomGroup');
    g.setAttribute('transform', 'translate(' + pivotX + ' ' + pivotY + ') rotate(' + (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2) + ')');
    var L1 = px * 0.46, L2 = px * 0.30, L3 = px * 0.24;
    var s = '';
    s += '<rect x="-4" y="-5.5" width="' + (L1 + 4) + '" height="11" rx="2.5" class="d-pale" stroke="var(--d-line)" stroke-width="1"/>';
    s += '<rect x="' + L1 + '" y="-4.5" width="' + L2 + '" height="9" rx="2" class="d-steel-d"/>';
    s += '<rect x="' + (L1 + L2) + '" y="-3.5" width="' + L3 + '" height="7" rx="2" class="d-steel-d"/>';
    [L1, L1 + L2 * 0.5, L1 + L2, L1 + L2 + L3 * 0.5].forEach(function (p, i) {
      var h = i < 2 ? 10 : 8;
      s += '<rect x="' + (p - 1.6) + '" y="' + (-h / 2) + '" width="3.2" height="' + h + '" rx="1.2" class="d-steel-l"/>';
    });
    s += '<rect x="' + (px - 3) + '" y="-5" width="7" height="10" rx="2" class="d-steel"/>';
    g.innerHTML = s;

    var c = el('hookCable');
    c.setAttribute('x1', tipX); c.setAttribute('y1', tipY);
    c.setAttribute('x2', tipX); c.setAttribute('y2', tipY + 20);
    el('hookBlock').setAttribute('x', tipX - 5);
    el('hookBlock').setAttribute('y', tipY + 20);
    el('hookSheave').setAttribute('cx', tipX);
    el('hookSheave').setAttribute('cy', tipY + 24.5);
    var hx = tipX, hy = tipY + 29;
    el('hookCurve').setAttribute('d',
      'M ' + hx + ' ' + hy +
      ' C ' + hx + ' ' + (hy + 3.9) + ', ' + (hx - 5.9) + ' ' + (hy + 3.9) + ', ' + (hx - 5.9) + ' ' + (hy + 8.5) +
      ' C ' + (hx - 5.9) + ' ' + (hy + 12.7) + ', ' + (hx - 1.6) + ' ' + (hy + 14.6) + ', ' + (hx + 2) + ' ' + (hy + 13) +
      ' C ' + (hx + 4.2) + ' ' + (hy + 11.9) + ', ' + (hx + 4.9) + ' ' + (hy + 9.4) + ', ' + (hx + 3.8) + ' ' + (hy + 7.5));

    var apexX = tipX - 1, apexY = tipY + 42;
    var sRad = slingAngle * Math.PI / 180;
    var sx = 25 * Math.cos(sRad), sy = 25 * Math.sin(sRad);
    var loadTop = apexY + sy;
    el('slingLegLeft').setAttribute('x1', apexX); el('slingLegLeft').setAttribute('y1', apexY);
    el('slingLegLeft').setAttribute('x2', apexX - sx); el('slingLegLeft').setAttribute('y2', loadTop);
    el('slingLegRight').setAttribute('x1', apexX); el('slingLegRight').setAttribute('y1', apexY);
    el('slingLegRight').setAttribute('x2', apexX + sx); el('slingLegRight').setAttribute('y2', loadTop);
    el('loadBox').setAttribute('x', apexX - 20);
    el('loadBox').setAttribute('y', loadTop);

    el('boomRadiusLine').setAttribute('x1', pivotX);
    el('boomRadiusLine').setAttribute('x2', tipX);
    var rl = el('boomRadiusLabel');
    rl.setAttribute('x', (pivotX + tipX) / 2 + 25);
    rl.textContent = 'R: ' + radius.toFixed(1) + 'm';

    el('boomAngleRefLine').setAttribute('x1', pivotX);
    el('boomAngleRefLine').setAttribute('y1', pivotY);
    el('boomAngleRefLine').setAttribute('x2', pivotX + 80);
    el('boomAngleRefLine').setAttribute('y2', pivotY);

    var ar = 34, fr = angle * Math.PI / 180;
    el('boomAngleArc').setAttribute('d',
      'M ' + (pivotX + ar) + ' ' + pivotY + ' A ' + ar + ' ' + ar + ' 0 0 0 ' +
      (pivotX + ar * Math.cos(fr)) + ' ' + (pivotY - ar * Math.sin(fr)));

    var hr = (angle / 2) * Math.PI / 180;
    var al = el('boomAngleLabel');
    al.setAttribute('x', pivotX + 48 * Math.cos(hr));
    al.setAttribute('y', pivotY - 48 * Math.sin(hr) + 4);
    al.textContent = angle.toFixed(0) + '°';

    var mx = (pivotX + tipX) / 2, my = (pivotY + tipY) / 2;
    var perpX = -dy / px * 4, perpY = dx / px * 4;
    var lx = mx - perpX * 3.5, ly = my - perpY * 3.5;
    var bl = el('boomLengthLabel');
    bl.setAttribute('x', lx); bl.setAttribute('y', ly);
    bl.setAttribute('transform', 'rotate(' + (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1) + ' ' + lx + ' ' + ly + ')');
    bl.textContent = len.toFixed(1) + 'm';

    var hl = el('boomHeightLabel');
    hl.setAttribute('x', apexX);
    hl.setAttribute('y', loadTop + 36);
    hl.textContent = 'H: ' + target.toFixed(1) + 'm';
  }

  /* ---------- Headroom diagram ---------- */
  function drawHeadroom(target, stackTotal, total) {
    var groundY = 200;
    var scale = 140 / Math.max(total, 1);
    var targetPx = target * scale, stackPx = stackTotal * scale;
    var topY = groundY - targetPx - stackPx;
    var bTop = groundY - targetPx;
    var bx = 78, bw = 84, bcx = bx + bw / 2;

    var s = '';
    s += '<rect x="' + bx + '" y="' + bTop + '" width="' + bw + '" height="' + Math.max(targetPx, 2) + '" class="d-pale" stroke="var(--d-line)" stroke-width="1" rx="2"/>';
    s += '<rect x="' + (bx - 3) + '" y="' + (bTop - 3) + '" width="' + (bw + 6) + '" height="4" rx="1.5" class="d-steel-l"/>';
    for (var wy = bTop + 10; wy < groundY - 14; wy += 20) {
      for (var wc = 0; wc < 3; wc++) {
        s += '<rect x="' + (bx + 12 + wc * 24) + '" y="' + wy + '" width="12" height="12" class="d-glass" rx="1"/>';
      }
    }
    if (stackPx > 10) {
      var gap = Math.min(9, stackPx * 0.15);
      var lh = Math.min(18, stackPx * 0.35);
      var lb = bTop - gap, lt = lb - lh;
      s += '<line x1="' + bcx + '" y1="' + (topY - 6) + '" x2="' + bcx + '" y2="' + topY + '" class="d-rope" stroke-width="1.5"/>';
      s += '<rect x="' + (bcx - 6) + '" y="' + topY + '" width="12" height="8" rx="1.5" class="d-steel-d"/>';
      s += '<line x1="' + bcx + '" y1="' + (topY + 8) + '" x2="' + (bcx - 22) + '" y2="' + lt + '" class="d-rope" stroke-width="1.5"/>';
      s += '<line x1="' + bcx + '" y1="' + (topY + 8) + '" x2="' + (bcx + 22) + '" y2="' + lt + '" class="d-rope" stroke-width="1.5"/>';
      s += '<rect x="' + (bcx - 27) + '" y="' + lt + '" width="54" height="' + lh + '" rx="2.5" class="d-load" stroke-width="1.2"/>';
    }
    el('hrScene').innerHTML = s;

    var sl = el('hrStackLabel');
    sl.setAttribute('y', Math.max(topY - 8, 12));
    sl.textContent = 'Rig stack: ' + stackTotal.toFixed(1) + 'm';
    var tl = el('hrTargetLabel');
    tl.setAttribute('y', bTop + Math.min(targetPx / 2, 60) + 4);
    tl.textContent = 'Target: ' + target.toFixed(1) + 'm';

    el('hrTotalLine').setAttribute('y2', topY);
    el('hrExtTop').setAttribute('y1', topY);
    el('hrExtTop').setAttribute('y2', topY);
    el('hrArrTop').setAttribute('d', 'M 207 ' + topY + ' L 203 ' + (topY + 10) + ' L 211 ' + (topY + 10) + ' Z');
    var ly = (groundY + topY) / 2;
    var tot = el('hrTotalLabel');
    tot.setAttribute('x', 203);
    tot.setAttribute('y', ly);
    tot.setAttribute('transform', 'rotate(-90 203 ' + ly + ')');
    tot.textContent = 'Total: ' + total.toFixed(1) + 'm';
  }

  /* ---------- Print ----------
     A printed sheet is a record of the check, so it has to read as one. Left as
     live controls it did not: the boxes printed the way an empty form does, a
     value wider than its box was clipped ("Liebherr LTM 1090-4.2" came out as
     "Liebherr LTM 1090-"), an untouched field printed its grey placeholder, and
     the date printed as 12-08-2026 with the picker glyph beside it. So every
     control is mirrored into a plain span that the print stylesheet shows in its
     place. Rebuilt on each print, because the values change as they are typed. */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function prettyDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return v || '';
    return String(parseInt(m[3], 10)) + ' ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }

  function controlText(ctrl) {
    if (ctrl.tagName === 'SELECT') {
      var o = ctrl.options[ctrl.selectedIndex];
      return o ? o.textContent.trim() : '';
    }
    if (ctrl.type === 'date') return prettyDate(ctrl.value);
    return (ctrl.value || '').trim();
  }

  function preparePrint() {
    var form = document.getElementById('calc');
    if (!form) return;
    var wraps = form.querySelectorAll('.f-in');
    Array.prototype.forEach.call(wraps, function (w) {
      var ctrl = w.querySelector('input,select');
      if (!ctrl) return;
      var pv = w.querySelector('.pv');
      if (!pv) {
        pv = document.createElement('span');
        pv.className = 'pv';
        pv.setAttribute('aria-hidden', 'true');
        w.appendChild(pv);
      }
      var v = controlText(ctrl);
      pv.textContent = v;
      /* blank stays blank, so the sheet can be filled in by hand on site */
      if (v === '') pv.classList.add('empty');
      else pv.classList.remove('empty');
      /* the unit sits in an absolutely positioned span on screen; on paper it
         belongs with the number */
      var unit = w.querySelector('.u');
      if (v !== '' && unit) {
        var u = document.createElement('i');
        u.className = 'pv-u';
        u.textContent = unit.textContent;
        pv.appendChild(u);
      }
    });
    /* only now may the print stylesheet hide the controls themselves */
    form.classList.add('pv-ready');
  }

  function init() {
    var form = document.getElementById('calc');
    if (!form) return;
    form.addEventListener('input', calc);
    form.addEventListener('change', calc);
    var p = document.getElementById('btnPad');
    if (p) p.addEventListener('click', useSuggestedPad);
    var s = document.getElementById('btnSail');
    if (s) s.addEventListener('click', useSuggestedSail);
    var pr = document.getElementById('btnPrint');
    if (pr) pr.addEventListener('click', function () { preparePrint(); window.print(); });

    /* beforeprint covers Chrome, Edge and Firefox, including Ctrl+P. Safari
       only fires the media query, so both are wired. */
    window.addEventListener('beforeprint', preparePrint);
    if (window.matchMedia) {
      var mq = window.matchMedia('print');
      var onMedia = function (e) { if (e.matches) preparePrint(); };
      if (mq.addEventListener) mq.addEventListener('change', onMedia);
      else if (mq.addListener) mq.addListener(onMedia);
    }
    var d = document.getElementById('recDate');
    if (d && !d.value) {
      var n = new Date();
      d.value = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    }
    calc();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
