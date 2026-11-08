/* ajmalps.com - Crane Lift Calculator.
   Calculation rules that must not be quietly reversed:
   - No more than 2 sling legs are assumed to carry, whatever number is fitted (BS 7121).
   - The hook block hangs above the slings, so it is excluded from sling tension and from
     the wind mass. It stays inside Total Lift Weight and crane utilisation.
   - Wind: v = vChart * sqrt(1.2 * m / (A * cw)). The 1.2 is the chart's sail-area-per-tonne
     constant (m^2/T), NOT air density. Result is capped at vChart.
   - Boom length uses the full rigging stack, not the target height.
   - Edge clearance is the boom centreline height at the building edge, from the
     same pivot-at-slew-centre triangle as the boom length, minus the target
     height. Optional: a blank edge is "not checked", never a pass.
   - A blank or impossible input must never render green. Show "--" and flag it. */
(function () {
  'use strict';

  var CHART_REF_RATIO = 1.2;

  function el(id) { return document.getElementById(id); }
  /* Every field declares min="0" (and some a max). A value below it is
     impossible - a negative weight, factor or length - and used to flow
     straight through: a negative outrigger force gave NaN for the pad size and
     a negative pressure that rendered PASS. So below the minimum is read as
     blank, and the field is outlined and says why. Above a max is only flagged
     and still used as typed, so it can never quietly turn a check green. */
  function num(id) {
    var e = el(id);
    if (!e) return 0;
    var v = parseFloat(e.value);
    if (!isFinite(v)) { flagField(e, ''); return 0; }
    var lo = e.min !== '' ? parseFloat(e.min) : null;
    var hi = e.max !== '' ? parseFloat(e.max) : null;
    if (lo != null && v < lo) { flagField(e, 'Must be ' + lo + ' or more. Read as blank.'); return 0; }
    if (hi != null && v > hi) { flagField(e, 'Usually ' + hi + ' at most. Check this value.'); return v; }
    flagField(e, '');
    return v;
  }
  function flagField(e, msg) {
    var f = e.closest ? e.closest('.f') : null;
    if (msg) e.setAttribute('aria-invalid', 'true'); else e.removeAttribute('aria-invalid');
    if (!f) return;
    var note = f.querySelector('.f-bad');
    if (msg && !note) {
      note = document.createElement('p');
      note.className = 'f-bad';
      note.setAttribute('role', 'status');
      f.appendChild(note);
    }
    if (note) { note.textContent = msg; note.hidden = !msg; }
  }
  function txt(id, s) { var e = el(id); if (e) e.textContent = s; }

  /* state is one of: '', 'ok', 'bad', 'warn', 'dim' */
  function state(id, s) {
    var e = el(id);
    if (!e) return;
    e.classList.remove('ok', 'bad', 'warn');
    if (s) e.classList.add(s);
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

    /* ---------- 6b. Boom clearance over the building edge (optional) ---------- */
    var buildingEdge = num('buildingEdge');
    var edgeKnown = buildingEdge > 0;
    var boomAtEdge = null, boomClearance = null, boomClrCls = '', boomClrText = 'not checked';
    if (edgeKnown) {
      if (workingRadius <= 0) { boomClrText = 'ENTER RADIUS'; boomClrCls = 'warn'; }
      else if (buildingEdge >= workingRadius) { boomClrText = 'EDGE BEYOND RADIUS'; boomClrCls = 'warn'; }
      else {
        boomAtEdge = pivotHeight + buildingEdge * riseNeeded / workingRadius;
        boomClearance = boomAtEdge - targetHeight;
        boomClrCls = boomClearance < clearanceMargin ? 'bad' : 'ok';
        boomClrText = boomClearance.toFixed(2) + ' m ' + (boomClearance < 0 ? 'CLASH' : boomClearance < clearanceMargin ? 'FAIL' : 'PASS');
      }
    }
    txt('resBoomAtEdge', boomAtEdge == null ? '--' : boomAtEdge.toFixed(2));
    txt('resBoomClr', boomClrText);
    state('boomClrBadge', boomClrCls);

    /* ---------- 7. Headroom display ---------- */
    txt('resSlingDrop', slingVerticalDrop.toFixed(2));
    txt('resRiggingStack', riggingStack.toFixed(2));
    txt('resClearanceShown', clearanceMargin.toFixed(2));
    txt('resHeightRequired', heightRequired.toFixed(2));

    /* the diagrams (crane-diagrams.js) and the 3D view (crane-3d.js) draw from
       these same numbers, never their own */
    var lift = {
      loadWeight: loadWeight, gearWeight: gearWeight, hookBlockWeight: hookBlockWeight,
      totalLiftWeight: totalLiftWeight, suspendedWeight: suspendedWeight,
      chartCapacity: chartCapacity, utilization: capacityKnown ? utilization : null,
      utilCls: !capacityKnown ? 'warn' : (utilization > 90 ? 'bad' : (utilization > 75 ? 'warn' : 'ok')),
      craneWeight: craneWeight, counterWeight: counterWeight,
      outriggerForce: outriggerForce, gbp: gbp, padDimension: padDimension,
      actualPressure: actualPressure, gpCls: gpCls,
      requiredArea: requiredArea, minPad: minPadDimension, suggestedPad: suggestedPad,
      vChart: vChart, sailArea: sailArea, dragCoeff: dragCoeff, windRaw: windRaw, maxWind: maxWind,
      windOk: denominator > 0 && numerator > 0,
      slingLegs: slingLegs, legsSharing: legsSharing, slingWLL: slingWLL, effectiveWLL: effectiveWLL,
      slingLength: slingLength, slingAngle: slingAngle, forceVertical: forceVertical,
      tensionPerLeg: tensionPerLeg, slingUtil: utilMeaningful ? slingUtil : null,
      slingStatus: statusText, slingCls: statusCls, hitch: hitchOpt ? hitchOpt.textContent : '',
      loadLength: loadLength, loadWidth: loadWidth, loadHeight: loadHeight,
      targetHeight: targetHeight, workingRadius: workingRadius, pivotHeight: pivotHeight,
      hookHeight: hookHeight, clearanceMargin: clearanceMargin,
      slingVerticalDrop: slingVerticalDrop, riggingStack: riggingStack, heightRequired: heightRequired,
      boomLength: requiredBoomLength, boomAngle: requiredBoomAngle,
      buildingEdge: edgeKnown ? buildingEdge : null, boomAtEdge: boomAtEdge,
      boomClearance: boomClearance, boomClrCls: boomClrCls, boomClrText: boomClrText
    };
    window.craneLift = lift;
    try { window.dispatchEvent(new CustomEvent('cranelift', { detail: lift })); } catch (e) { /* very old browser: no 3D anyway */ }
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
