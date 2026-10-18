/* WIDE LAYOUT HINT for visuals: show.html loads every visual as
   <folder>/?embed=1&screen=stage|side. 'stage' = the 3000x720 (25:6) big LED, 'side' = 16:10 side LEDs.
   Read it as window.VR_SCREEN (set below), or just test W / H > 2.5 as a fallback, and use a wide layout
   (tile or repeat across the width, size things by height). Leave the 16:10 layout as it is. */
/* Vibe Raas: embed bridge. When a visual runs inside show.html it reuses the
   parent's running AudioContext + mic stream, skips its start screen and HUD,
   and exposes window.__vrCmd / window.__vrStatus for the show window. */
(function () {
  'use strict';
  var Q = new URLSearchParams(window.__VRQS || location.search); // __VRQS: query string injected by the offline single-file build (srcdoc has no search)
  window.VR_SCREEN = Q.get('screen') === 'stage' ? 'stage' : 'side';
  var VR = null;
  try { if (window.parent !== window && window.parent.__vr) VR = window.parent.__vr; } catch (e) {}
  if (!VR && Q.get('embed') !== '1') return;
  document.documentElement.classList.add('vr-embed');
  // the visual never goes fullscreen itself (the show page does); avoids permissions-policy console errors
  try { Element.prototype.requestFullscreen = function () { return Promise.reject(new DOMException('show page owns fullscreen', 'NotAllowedError')); }; } catch (e) {}
  var st = document.createElement('style');
  st.textContent = 'html.vr-embed #start{display:none!important}html.vr-embed body{cursor:none}html.vr-embed #logo{display:none!important}'; // the show draws the centre logo
  document.head.appendChild(st);
  if (VR && VR.ctx) {
    var Fake = function () { return window.parent.__vr.ctx; };
    window.AudioContext = Fake; window.webkitAudioContext = Fake;
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = function () {
        var s = window.parent.__vr && window.parent.__vr.stream;
        return s ? Promise.resolve(s) : Promise.reject(new DOMException('no parent stream', 'NotFoundError'));
      };
    }
  }
  function key(k) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
  addEventListener('DOMContentLoaded', function () {
    try { hudOn = false; } catch (e) {}
    try { if (typeof auto !== 'undefined') auto = false; } catch (e) {}
    try { begin(); } catch (e) {}
    try { var s = document.getElementById('start'); if (s) s.classList.add('gone'); } catch (e) {}
    try { if (window.parent.__vrPal) setPalName(window.parent.__vrPal); } catch (e) {}
    try { if (window.parent.__vrK) setK(window.parent.__vrK); } catch (e) {}
  });
  function setPalName(n) { for (var i = 0; i < 6; i++) { if (P().name === n) return; key('p'); } }
  function kObj() { try { if (typeof T !== 'undefined' && T && T.K !== undefined) return T; } catch (e) {} try { return S; } catch (e) {} return null; }
  function setK(v) { var o = kObj(); if (o) o.K = Math.max(0.3, Math.min(1.8, +v)); }
  window.__vrCmd = function (c) {
    if (c.type === 'pal') setPalName(c.name);
    else if (c.type === 'k') setK(c.value);
    else if (c.type === 'tap') key('t');
    else if (c.type === 'hud') key('h');
    else if (c.type === 'key') key(c.key);
  };
  window.__vrStatus = function () {
    var o = kObj();
    return { bpm: B.bpm, beats: B.count, energy: (typeof LV !== 'undefined' ? LV.energy : 0), pal: P().name, K: o ? o.K : 1 };
  };
  // Show keys act on the show page even when the iframe has focus, and the visual never sees them:
  // 1-8 visual, C/P colour, L logo, F fullscreen, Q pairing, Up/Down intensity, T/Space tap.
  // Capture phase on window runs before the visual's own keydown handler (so stripes/shiv 1/2 never fire).
  // Synthetic (untrusted) keys from __vrCmd (palette 'p', tap 't', raas mode digits) still reach the visual.
  // The iframe itself is not allowed fullscreen, else it would cover the show's centre logo.
  var SHOWKEY = /^([1-8cCpPlLfFqQtT ]|ArrowUp|ArrowDown)$/;
  addEventListener('dblclick', function () { try { window.parent.__vrKey && window.parent.__vrKey('f'); } catch (x) {} });
  addEventListener('keydown', function (e) {
    if (!e.isTrusted || e.metaKey || e.ctrlKey || e.altKey || !SHOWKEY.test(e.key)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.repeat && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    try { window.parent.__vrKey && window.parent.__vrKey(e.key); } catch (x) {}
  }, true);
  addEventListener('pagehide', function () {
    try { if (srcNode) srcNode.disconnect(); } catch (e) {}
    try { if (analyser) analyser.disconnect(); } catch (e) {}
  });
})();
