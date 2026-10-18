/* Vibe Raas relay: BroadcastChannel (same machine) + MQTT over WSS (cross device).
   No backend of our own. Every message carries a random id, so a message that
   arrives on both paths is applied once. Needs mqtt.min.js loaded first. */
(function () {
  'use strict';
  var BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt']; // hivemq primary, emqx backup
  var ALPHA = 'ACDEFHJKLMNPRTUVWXY'; // no B/G/I/O/Q/S/Z/0/1 lookalikes
  function rid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function newCode() { var s = ''; for (var i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  function clean(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }

  /* opts: room, role ('show'|'control'), onMsg(msg, via) */
  function VRRelay(opts) {
    var room = clean(opts.room), role = opts.role;
    var inTopic = 'vibe-raas/' + room + '/' + (role === 'show' ? 'cmd' : 'status');
    var outCmd = 'vibe-raas/' + room + '/cmd', outStatus = 'vibe-raas/' + room + '/status';
    var seen = new Map(), connected = false, broker = '';
    var api = { room: room, mqttUp: function () { return connected; }, broker: function () { return broker; }, onConn: null };

    function deliver(m, via) {
      if (!m || typeof m !== 'object' || !m.id) return;
      if (m.room && m.room !== room) return;
      if (seen.has(m.id)) return;
      seen.set(m.id, 1);
      if (seen.size > 600) { var it = seen.keys(); for (var i = 0; i < 200; i++) seen.delete(it.next().value); }
      // only take messages meant for us
      var isStatus = m.type === 'status';
      if (role === 'show' && isStatus) return;
      if (role === 'control' && !isStatus) return;
      try { opts.onMsg(m, via); } catch (e) { console.error(e); }
    }

    var bc = null;
    try { bc = new BroadcastChannel('vibe-raas'); bc.onmessage = function (ev) { deliver(ev.data, 'bc'); }; } catch (e) {}

    // Both brokers at once: if the show landed on one and the phone on the other they would
    // never meet, so we publish to every connected broker and subscribe on all (ids dedupe).
    var clients = BROKERS.map(function (url) { return { url: url, c: null, up: false }; });
    function upd() { connected = clients.some(function (x) { return x.up; }); broker = clients.filter(function (x) { return x.up; }).map(function (x) { return x.url.split('/')[2]; }).join(' + '); if (api.onConn) api.onConn(connected); }
    // Offline: stay quiet (no reconnect storm), pick up again when the laptop is back online.
    function whenOnline(slot) { if (slot.wait) return; slot.wait = true; addEventListener('online', function f() { removeEventListener('online', f); slot.wait = false; connect(slot); }); }
    function connect(slot) {
      if (window.VR_OFFLINE_BUILD) return; // single-file offline build: no phone control
      if (navigator.onLine === false) { whenOnline(slot); return; }
      if (typeof mqtt === 'undefined') { setTimeout(function () { connect(slot); }, 3000); return; }
      var c;
      try {
        c = mqtt.connect(slot.url, { clientId: 'vr_' + role + '_' + rid(), connectTimeout: 4000, reconnectPeriod: 2500, keepalive: 20, clean: true });
      } catch (e) { setTimeout(function () { connect(slot); }, 3000); return; }
      slot.c = c;
      c.on('connect', function () { slot.up = true; c.subscribe(inTopic, { qos: 0 }); upd(); });
      c.on('message', function (t, buf) { try { deliver(JSON.parse(buf.toString()), 'mqtt'); } catch (e) {} });
      c.on('offline', function () { slot.up = false; upd(); if (navigator.onLine === false) { try { c.end(true); } catch (e) {} whenOnline(slot); } });
      c.on('close', function () { slot.up = false; upd(); });
      c.on('error', function () {});
    }
    clients.forEach(function (x, i) { setTimeout(function () { connect(x); }, i * 300); });

    api.send = function (m, viaMqtt) {
      m.id = rid(); m.room = room;
      if (bc) try { bc.postMessage(m); } catch (e) {}
      if (viaMqtt !== false && connected) {
        var t = m.type === 'status' ? outStatus : outCmd, body = JSON.stringify(m);
        clients.forEach(function (x) { if (x.up) try { x.c.publish(t, body, { qos: 0 }); } catch (e) {} });
      }
    };
    return api;
  }
  window.VRRelay = VRRelay; VRRelay.newCode = newCode; VRRelay.clean = clean;
})();
