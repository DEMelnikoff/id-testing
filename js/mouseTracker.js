/*
 *  mouseTracker.js
 *
 *  Drop-in mouse tracking for jsPsych experiments.
 *
 *  Usage:
 *    1. Include this script before your experiment script.
 *    2. In your initJsPsych() config, add:
 *         on_trial_start: mouseTracker.startTracking,
 *         on_trial_finish: mouseTracker.finishTracking,
 *
 *  Columns added to each trial's data:
 *    mouse_movements   - total number of mousemove events
 *    mouse_distance     - total pixels traveled
 *    mouse_speed_sd     - SD of instantaneous speeds (px/ms)
 *    mouse_angle_sd     - SD of direction changes (radians)
 *    mouse_pauses       - number of pauses (500ms+ with no movement)
 *    mouse_jitter       - mean magnitude of micro-movements (<5px)
 */

const mouseTracker = (function () {
  'use strict';

  const PAUSE_THRESHOLD = 500;  // ms of no movement to count as a pause
  const JITTER_THRESHOLD = 5;   // px; movements smaller than this are "jitter"

  let events = [];
  let listener = null;
  let pauseCount = 0;
  let pauseTimer = null;

  function onMouseMove(e) {
    events.push({ x: e.clientX, y: e.clientY, t: performance.now() });

    // pause detection: reset timer on every move
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => { pauseCount++; }, PAUSE_THRESHOLD);
  }

  function startTracking() {
    events = [];
    pauseCount = 0;
    clearTimeout(pauseTimer);
    listener = onMouseMove;
    document.addEventListener('mousemove', listener);
  }

  function finishTracking(data) {
    document.removeEventListener('mousemove', listener);
    clearTimeout(pauseTimer);

    const n = events.length;
    data.mouse_movements = n;

    if (n < 2) {
      data.mouse_distance = 0;
      data.mouse_speed_sd = 0;
      data.mouse_angle_sd = 0;
      data.mouse_pauses = pauseCount;
      data.mouse_jitter = 0;
      return;
    }

    // compute per-step metrics
    const speeds = [];
    const angles = [];
    const jitterMags = [];
    let totalDist = 0;
    let prevAngle = null;

    for (let i = 1; i < n; i++) {
      const dx = events[i].x - events[i - 1].x;
      const dy = events[i].y - events[i - 1].y;
      const dt = events[i].t - events[i - 1].t;
      const dist = Math.sqrt(dx * dx + dy * dy);

      totalDist += dist;

      if (dt > 0) {
        speeds.push(dist / dt);
      }

      if (dist > 0) {
        const angle = Math.atan2(dy, dx);
        if (prevAngle !== null) {
          let dAngle = angle - prevAngle;
          // normalize to [-pi, pi]
          dAngle = Math.atan2(Math.sin(dAngle), Math.cos(dAngle));
          angles.push(dAngle);
        }
        prevAngle = angle;
      }

      if (dist > 0 && dist < JITTER_THRESHOLD) {
        jitterMags.push(dist);
      }
    }

    data.mouse_distance = Math.round(totalDist);
    data.mouse_speed_sd = sd(speeds);
    data.mouse_angle_sd = sd(angles);
    data.mouse_pauses = pauseCount;
    data.mouse_jitter = jitterMags.length > 0 ? round3(mean(jitterMags)) : 0;
  }

  // helpers
  function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function sd(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((sum, x) => sum + (x - m) * (x - m), 0) / (arr.length - 1);
    return round3(Math.sqrt(variance));
  }

  function round3(x) {
    return Math.round(x * 1000) / 1000;
  }

  return { startTracking, finishTracking };
})();
