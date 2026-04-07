class j {
  /**
   * @param {RTCPeerConnection} pc
   * @param {object} opts
   * @param {number} [opts.channelCount=4]
   * @param {boolean} [opts.ordered=false]
   * @param {string} [opts.protocol='fastrtc']
   */
  constructor(e, { channelCount: t = 4, ordered: s = !1, protocol: n = "fastrtc" } = {}) {
    this.pc = e, this.channelCount = t, this.ordered = s, this.protocol = n, this.channels = [], this.openChannels = /* @__PURE__ */ new Set(), this._rrIndex = 0, this._onMessage = null, this._onOpen = null, this._onClose = null;
  }
  // ── Event setters ──
  onMessage(e) {
    this._onMessage = e;
  }
  onOpen(e) {
    this._onOpen = e;
  }
  onClose(e) {
    this._onClose = e;
  }
  // ── Channel creation (offerer side) ──
  /**
   * Create N data channels. Call this on the offering peer.
   */
  createChannels() {
    for (let e = 0; e < this.channelCount; e++) {
      const t = `fastrtc-${e}`, s = this.pc.createDataChannel(t, {
        ordered: this.ordered,
        protocol: this.protocol,
        id: e,
        negotiated: !0
        // both sides create with same id
      });
      s.binaryType = "arraybuffer", this._bindEvents(s, e), this.channels.push(s);
    }
  }
  /**
   * Setup negotiated channels on the answering peer side.
   * Since we use negotiated: true, both sides call createChannels().
   */
  createNegotiatedChannels() {
    this.createChannels();
  }
  // ── Sending ──
  /**
   * Send an ArrayBuffer on the next available channel (round-robin with backpressure).
   * @param {ArrayBuffer} data
   * @returns {Promise<number>} channel index used
   */
  async send(e) {
    const t = await this._pickChannel();
    return this.channels[t].send(e), t;
  }
  /**
   * Send on a specific channel index.
   */
  async sendOnChannel(e, t) {
    await this._waitForBuffer(e), this.channels[e].send(t);
  }
  /**
   * Check if any channel is available for sending.
   */
  hasAvailableChannel() {
    for (const e of this.openChannels)
      if (this.channels[e].bufferedAmount < 1048576)
        return !0;
    return !1;
  }
  /**
   * Get the number of open channels.
   */
  getOpenCount() {
    return this.openChannels.size;
  }
  /**
   * Clean up all channels.
   */
  close() {
    for (const e of this.channels)
      try {
        e.close();
      } catch {
      }
    this.channels = [], this.openChannels.clear();
  }
  // ── Internal ──
  _bindEvents(e, t) {
    e.onopen = () => {
      this.openChannels.add(t), this._onOpen && this._onOpen(t);
    }, e.onclose = () => {
      this.openChannels.delete(t), this._onClose && this._onClose(t);
    }, e.onmessage = (s) => {
      this._onMessage && this._onMessage(t, s.data);
    }, e.bufferedAmountLowThreshold = 262144;
  }
  async _pickChannel() {
    const e = [...this.openChannels];
    if (e.length === 0)
      return await new Promise((s) => {
        const n = this._onOpen;
        this._onOpen = (i) => {
          this._onOpen = n, n && n(i), s();
        };
      }), this._pickChannel();
    for (let s = 0; s < e.length; s++) {
      const n = e[this._rrIndex % e.length];
      if (this._rrIndex = (this._rrIndex + 1) % e.length, this.channels[n].bufferedAmount < 1048576)
        return n;
    }
    const t = e[0];
    return await this._waitForBuffer(t), t;
  }
  _waitForBuffer(e) {
    return new Promise((t) => {
      const s = this.channels[e];
      if (!s || s.bufferedAmount < 1048576) {
        t();
        return;
      }
      const n = () => {
        s.removeEventListener("bufferedamountlow", n), t();
      };
      s.addEventListener("bufferedamountlow", n), setTimeout(() => {
        s.removeEventListener("bufferedamountlow", n), t();
      }, 5e3);
    });
  }
}
class R {
  constructor(e, t) {
    this.roomCode = e, this.isOfferer = t;
    const s = Array.from("FRTC" + e).map((n) => n.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    this.infoHash = s.padEnd(40, "0"), this.peerId = Array.from(crypto.getRandomValues(new Uint8Array(20))).map((n) => n.toString(16).padStart(2, "0")).join(""), this.urls = [
      "wss://tracker.openwebtorrent.com",
      "wss://tracker.webtorrent.dev",
      "wss://tracker.files.fm:7073/announce",
      "wss://tracker.btorrent.xyz",
      "wss://tracker.novage.com.ua",
      "wss://tracker.sloppyta.co:443/announce",
      "wss://tracker.fastcast.nz",
      "wss://tracker.magnet-api.net",
      "wss://peertube2.cpy.re:443/tracker/socket",
      "wss://tube.network.europa.eu:443/tracker/socket",
      "wss://tracker.webtorrent.io",
      "wss://wstracker.libtorrent.org",
      "wss://tracker.doko.moe",
      "wss://tracker.lunik.xyz",
      "wss://dht.webtorrent.dev",
      "wss://tracker.nanoha.org",
      "wss://tracker.gvid.tv",
      "wss://api.novage.com.ua/bt",
      "wss://video.blender.org:443/tracker/socket",
      "wss://tracker.beeimg.com:443/announce"
    ], this.sockets = [], this.remotePeerId = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this._announceInterval = null;
  }
  connect() {
    let e = !1;
    for (const t of this.urls)
      try {
        const s = new WebSocket(t);
        this.sockets.push(s), s.onopen = () => {
          e || (e = !0, this.onOpen && this.onOpen(0), this._startAnnouncing());
        }, s.onmessage = (n) => this._handleMessage(n.data, s), s.onclose = () => {
          this.sockets = this.sockets.filter((n) => n !== s), this.sockets.length === 0 && (this._stopAnnouncing(), this.onClose && this.onClose(0));
        };
      } catch {
      }
  }
  close() {
    this._stopAnnouncing();
    for (const e of this.sockets)
      e.onclose = null, e.close();
    this.sockets = [];
  }
  send(e) {
    if (this.sockets.length === 0) return;
    const t = JSON.stringify(e), s = {
      action: "announce",
      info_hash: this.infoHash,
      peer_id: this.peerId
    };
    this.remotePeerId ? (s.to_peer_id = this.remotePeerId, s.answer = { type: "answer", sdp: t }, s.offer_id = "fastrtc-relay") : this.isOfferer && (s.numwant = 1, s.offers = [{
      offer_id: "fastrtc-relay",
      offer: { type: "offer", sdp: t }
    }]);
    const n = JSON.stringify(s);
    for (const i of this.sockets)
      i.readyState === WebSocket.OPEN && i.send(n);
  }
  _startAnnouncing() {
    if (this.isOfferer) {
      const e = () => {
        const t = JSON.stringify({
          action: "announce",
          info_hash: this.infoHash,
          peer_id: this.peerId,
          numwant: 1
        });
        for (const s of this.sockets)
          s.readyState === WebSocket.OPEN && s.send(t);
      };
      e(), this._announceInterval = setInterval(e, 2e3);
    } else {
      const e = JSON.stringify({
        action: "announce",
        info_hash: this.infoHash,
        peer_id: this.peerId,
        numwant: 1
      });
      for (const t of this.sockets)
        t.readyState === WebSocket.OPEN && t.send(e);
    }
  }
  _stopAnnouncing() {
    this._announceInterval && (clearInterval(this._announceInterval), this._announceInterval = null);
  }
  _handleMessage(e, t) {
    let s;
    try {
      s = JSON.parse(e);
    } catch {
      return;
    }
    if (s.answer && s.answer.sdp && (this._stopAnnouncing(), this.remotePeerId = s.peer_id, this.onMessage))
      try {
        const n = JSON.parse(s.answer.sdp);
        this.onMessage(n);
      } catch {
      }
    if (s.offer && s.offer.sdp) {
      if (this._stopAnnouncing(), this.remotePeerId = s.peer_id, this.onMessage)
        try {
          const n = JSON.parse(s.offer.sdp);
          this.onMessage(n);
        } catch {
        }
      t.send(JSON.stringify({
        action: "announce",
        info_hash: this.infoHash,
        peer_id: this.peerId,
        to_peer_id: this.remotePeerId,
        offer_id: s.offer_id,
        answer: { type: "answer", sdp: JSON.stringify({ type: "peer-joined" }) }
      }));
    }
    s.action === "announce" && s.peer_id && s.peer_id !== this.peerId && this.isOfferer && !this.remotePeerId && (this.remotePeerId = s.peer_id, this._stopAnnouncing(), this.onMessage && this.onMessage({ type: "peer-joined" }));
  }
}
class B {
  /**
   * @param {object} opts
   * @param {number} [opts.probeIntervalMs=2000] — how often to probe
   * @param {number} [opts.emaAlpha=0.3] — smoothing factor for EMA (higher = more responsive)
   */
  constructor({ probeIntervalMs: e = 2e3, emaAlpha: t = 0.3 } = {}) {
    this.probeIntervalMs = e, this.emaAlpha = t, this.links = /* @__PURE__ */ new Map(), this._probeTimer = null, this._onQualityUpdate = null;
  }
  /**
   * Register a link for monitoring.
   * @param {string} linkId — unique identifier (e.g. "wss-0", "dc-2")
   */
  addLink(e) {
    this.links.set(e, {
      id: e,
      latency: 0,
      // ms, EMA
      throughput: 0,
      // bytes/sec, EMA
      packetLoss: 0,
      // 0..1, EMA
      score: 1,
      // composite quality 0..1
      lastProbeTime: 0,
      probesSent: 0,
      probesReceived: 0,
      bytesSent: 0,
      bytesInWindow: 0,
      windowStart: performance.now()
    });
  }
  /**
   * Remove a link from monitoring.
   */
  removeLink(e) {
    this.links.delete(e);
  }
  /**
   * Record that we sent a probe on a link.
   */
  recordProbeSent(e) {
    const t = this.links.get(e);
    t && (t.probesSent++, t.lastProbeTime = performance.now());
  }
  /**
   * Record a probe response (the RTT).
   */
  recordProbeResponse(e, t) {
    const s = this.links.get(e);
    s && (s.probesReceived++, s.latency = this._ema(s.latency, t), this._recalcScore(s));
  }
  /**
   * Record bytes sent on a link (for throughput calculation).
   */
  recordBytesSent(e, t) {
    const s = this.links.get(e);
    s && (s.bytesSent += t, s.bytesInWindow += t);
  }
  /**
   * Calculate throughput for all links (call periodically).
   */
  updateThroughput() {
    const e = performance.now();
    for (const t of this.links.values()) {
      const s = (e - t.windowStart) / 1e3;
      if (s > 0.1) {
        const n = t.bytesInWindow / s;
        t.throughput = this._ema(t.throughput, n), t.bytesInWindow = 0, t.windowStart = e, this._recalcScore(t);
      }
    }
  }
  /**
   * Calculate packet loss for all links.
   */
  updatePacketLoss() {
    for (const e of this.links.values())
      if (e.probesSent > 0) {
        const t = 1 - e.probesReceived / e.probesSent;
        e.packetLoss = this._ema(e.packetLoss, Math.max(0, t)), this._recalcScore(e);
      }
  }
  /**
   * Get the quality scores for all links.
   * @returns {Map<string, LinkStats>}
   */
  getScores() {
    return new Map(this.links);
  }
  /**
   * Get sorted link IDs by quality (best first).
   * @returns {string[]}
   */
  getRankedLinks() {
    return [...this.links.values()].sort((e, t) => t.score - e.score).map((e) => e.id);
  }
  /**
   * Get the weight (0..1) for a link, normalized across all links.
   * Higher score → higher weight.
   * @returns {Map<string, number>}
   */
  getWeights() {
    const e = /* @__PURE__ */ new Map();
    let t = 0;
    for (const s of this.links.values())
      t += s.score;
    if (t === 0) {
      const s = 1 / Math.max(1, this.links.size);
      for (const n of this.links.values())
        e.set(n.id, s);
    } else
      for (const s of this.links.values())
        e.set(s.id, s.score / t);
    return e;
  }
  /**
   * Set a callback for quality updates.
   */
  onQualityUpdate(e) {
    this._onQualityUpdate = e;
  }
  /**
   * Start periodic measurement cycle.
   */
  start() {
    this._probeTimer = setInterval(() => {
      this.updateThroughput(), this.updatePacketLoss(), this._onQualityUpdate && this._onQualityUpdate(this.getScores());
    }, this.probeIntervalMs);
  }
  /**
   * Stop monitoring.
   */
  stop() {
    this._probeTimer && (clearInterval(this._probeTimer), this._probeTimer = null);
  }
  // ── Internal ──
  _ema(e, t) {
    return e === 0 ? t : this.emaAlpha * t + (1 - this.emaAlpha) * e;
  }
  _recalcScore(e) {
    const t = 1 / (1 + e.latency / 100), s = 1 - e.packetLoss, n = Math.min(1, Math.log10(1 + e.throughput / 1e4) / 4);
    e.score = Math.max(0.01, t * 0.4 + s * 0.35 + n * 0.25);
  }
}
class W {
  /**
   * @param {object} opts
   * @param {function[]} opts.senders — array of async send functions: (data: ArrayBuffer) => Promise<void>
   * @param {string[]} opts.linkIds — matching array of link IDs for the monitor
   * @param {ConnectionMonitor} [opts.monitor] — optional external monitor
   */
  constructor({ senders: e = [], linkIds: t = [], monitor: s = null } = {}) {
    this.senders = e, this.linkIds = t, this.monitor = s || new B();
    for (const n of this.linkIds)
      this.monitor.links.has(n) || this.monitor.addLink(n);
    this._wrr = {
      weights: /* @__PURE__ */ new Map(),
      counters: /* @__PURE__ */ new Map()
    }, this._reassembly = /* @__PURE__ */ new Map(), this._onComplete = null, this._onChunkReceived = null, this._onProgress = null;
  }
  // ── Event setters ──
  onComplete(e) {
    this._onComplete = e;
  }
  onChunkReceived(e) {
    this._onChunkReceived = e;
  }
  onProgress(e) {
    this._onProgress = e;
  }
  // ── Sending ──
  /**
   * Update senders and link IDs dynamically (e.g., when new channels open).
   */
  updatePaths(e, t) {
    this.senders = e, this.linkIds = t;
    for (const s of t)
      this.monitor.links.has(s) || this.monitor.addLink(s);
  }
  /**
   * Stripe an array of encoded chunk buffers across all available paths.
   * @param {ArrayBuffer[]} chunks — encoded chunk buffers from ChunkProtocol
   * @returns {Promise<void>}
   */
  async sendChunks(e) {
    if (this.senders.length === 0)
      throw new Error("BondingEngine: no senders available");
    this._refreshWeights();
    const t = this._buildSendPlan(e.length), s = [];
    for (let n = 0; n < e.length; n++) {
      const i = t[n], r = e[n], c = this.linkIds[i];
      s.push(
        this.senders[i](r).then(() => {
          this.monitor.recordBytesSent(c, r.byteLength);
        })
      );
    }
    await Promise.all(s);
  }
  /**
   * Send a single chunk on the best available path.
   */
  async sendSingle(e) {
    this._refreshWeights();
    const t = this._pickBestSender();
    await this.senders[t](e), this.monitor.recordBytesSent(this.linkIds[t], e.byteLength);
  }
  // ── Receiving / Reassembly ──
  /**
   * Feed a received chunk into the reassembly buffer.
   * @param {object} decoded — decoded chunk from ChunkProtocol.decodeChunk()
   */
  receiveChunk(e) {
    const { transferId: t, chunkIndex: s, totalChunks: n, payload: i } = e;
    this._onChunkReceived && this._onChunkReceived(e), this._reassembly.has(t) || this._reassembly.set(t, {
      totalChunks: n,
      received: /* @__PURE__ */ new Map()
    });
    const r = this._reassembly.get(t);
    if (r.received.set(s, i), this._onProgress && this._onProgress({
      transferId: t,
      received: r.received.size,
      total: r.totalChunks,
      percent: r.received.size / r.totalChunks * 100
    }), r.received.size === r.totalChunks) {
      const c = this._assemble(r);
      this._reassembly.delete(t), this._onComplete && this._onComplete({ transferId: t, data: c });
    }
  }
  // ── Internal ──
  _refreshWeights() {
    this._wrr.weights = this.monitor.getWeights();
    for (const e of this.linkIds)
      this._wrr.counters.has(e) || this._wrr.counters.set(e, 0);
  }
  /**
   * Build a send plan: for each chunk, decide which sender index to use.
   * Uses weighted distribution.
   */
  _buildSendPlan(e) {
    const t = new Array(e), s = this._wrr.weights, n = /* @__PURE__ */ new Map();
    let i = 0;
    for (let o = 0; o < this.linkIds.length; o++) {
      const h = this.linkIds[o], d = s.get(h) || 1 / this.linkIds.length, u = Math.round(d * e);
      n.set(o, u), i += u;
    }
    if (i < e) {
      const o = this._pickBestSender();
      n.set(o, (n.get(o) || 0) + (e - i));
    } else if (i > e)
      for (let o = this.linkIds.length - 1; o >= 0 && i > e; o--) {
        const h = n.get(o) || 0, d = Math.min(h, i - e);
        n.set(o, h - d), i -= d;
      }
    let r = 0;
    const c = new Map(n);
    for (; r < e; )
      for (let o = 0; o < this.linkIds.length && r < e; o++) {
        const h = c.get(o) || 0;
        h > 0 && (t[r++] = o, c.set(o, h - 1));
      }
    return t;
  }
  _pickBestSender() {
    const e = this.monitor.getRankedLinks();
    for (const t of e) {
      const s = this.linkIds.indexOf(t);
      if (s >= 0) return s;
    }
    return 0;
  }
  /**
   * Assemble all received chunks into a single ArrayBuffer.
   */
  _assemble(e) {
    let t = 0;
    for (let i = 0; i < e.totalChunks; i++) {
      const r = e.received.get(i);
      r && (t += r.byteLength);
    }
    const s = new Uint8Array(t);
    let n = 0;
    for (let i = 0; i < e.totalChunks; i++) {
      const r = e.received.get(i);
      r && (s.set(r, n), n += r.byteLength);
    }
    return s.buffer;
  }
}
const b = 13, L = 64 * 1024, m = {
  DATA: 1,
  ACK: 2,
  FIN: 4,
  PROBE: 8,
  META: 16
};
function E({ transferId: a, chunkIndex: e, totalChunks: t, flags: s, payload: n }) {
  const i = n ? n instanceof Uint8Array ? n : new Uint8Array(n) : new Uint8Array(0), r = new ArrayBuffer(b + i.byteLength), c = new DataView(r);
  return c.setUint32(0, a, !0), c.setUint32(4, e, !0), c.setUint32(8, t, !0), c.setUint8(12, s), i.byteLength > 0 && new Uint8Array(r, b).set(i), r;
}
function J(a) {
  const e = new DataView(a);
  return {
    transferId: e.getUint32(0, !0),
    chunkIndex: e.getUint32(4, !0),
    totalChunks: e.getUint32(8, !0),
    flags: e.getUint8(12),
    payload: a.byteLength > b ? new Uint8Array(a, b) : null
  };
}
function U(a, e, t = L) {
  const s = new Uint8Array(a), n = Math.ceil(s.byteLength / t), i = [];
  for (let r = 0; r < n; r++) {
    const c = r * t, o = Math.min(c + t, s.byteLength), h = s.slice(c, o);
    i.push(
      E({
        transferId: e,
        chunkIndex: r,
        totalChunks: n,
        flags: m.DATA,
        payload: h
      })
    );
  }
  return i;
}
function q(a, e) {
  const t = JSON.stringify(e), n = new TextEncoder().encode(t);
  return E({
    transferId: a,
    chunkIndex: 0,
    totalChunks: 0,
    flags: m.META,
    payload: n
  });
}
function z(a) {
  const e = new TextDecoder();
  return JSON.parse(e.decode(a));
}
function K(a) {
  const e = new Uint8Array(8);
  return new DataView(e.buffer).setFloat64(0, a, !0), E({
    transferId: 0,
    chunkIndex: 0,
    totalChunks: 0,
    flags: m.PROBE,
    payload: e
  });
}
function V(a) {
  return new DataView(a.buffer, a.byteOffset, a.byteLength).getFloat64(0, !0);
}
const O = 1, T = 2, G = new TextEncoder(), $ = new TextDecoder();
class Q {
  /**
   * @param {function} sendFn — async (data: ArrayBuffer) => void
   */
  constructor(e) {
    this._send = e, this._listeners = {};
  }
  /**
   * Register event listener.
   * Events: 'text', 'binary'
   */
  on(e, t) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(t);
  }
  off(e, t) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((s) => s !== t));
  }
  _emit(e, ...t) {
    if (this._listeners[e])
      for (const s of this._listeners[e])
        try {
          s(...t);
        } catch (n) {
          console.error("Messenger error:", n);
        }
  }
  /**
   * Send a text message.
   * @param {string} text
   */
  async send(e) {
    const t = G.encode(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = O, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  /**
   * Send binary data.
   * @param {ArrayBuffer|Uint8Array} data
   */
  async sendBinary(e) {
    const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = T, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  /**
   * Handle incoming message frame (called by FastRTC internals).
   * @param {ArrayBuffer} buffer
   */
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === O) {
      const n = $.decode(t.slice(1));
      this._emit("text", n);
    } else s === T && this._emit("binary", e.slice(1));
  }
}
const f = {
  REQUEST: 1,
  RESPONSE: 2,
  BODY: 3,
  END: 4,
  ERROR: 5
}, y = new TextEncoder(), w = new TextDecoder();
function Y(a, e, t, s = {}, n = null) {
  const i = y.encode(e), r = y.encode(t), c = y.encode(JSON.stringify(s)), o = n ? new Uint8Array(n) : new Uint8Array(0), h = 6 + i.length + 2 + r.length + 4 + c.length + o.length, d = new ArrayBuffer(h), u = new DataView(d), _ = new Uint8Array(d);
  let l = 0;
  return u.setUint8(l, f.REQUEST), l += 1, u.setUint32(l, a, !0), l += 4, u.setUint8(l, i.length), l += 1, _.set(i, l), l += i.length, u.setUint16(l, r.length, !0), l += 2, _.set(r, l), l += r.length, u.setUint32(l, c.length, !0), l += 4, _.set(c, l), l += c.length, o.length > 0 && _.set(o, l), d;
}
function X(a, e, t = {}) {
  const s = y.encode(JSON.stringify(t)), n = 11 + s.length, i = new ArrayBuffer(n), r = new DataView(i), c = new Uint8Array(i);
  let o = 0;
  return r.setUint8(o, f.RESPONSE), o += 1, r.setUint32(o, a, !0), o += 4, r.setUint16(o, e, !0), o += 2, r.setUint32(o, s.length, !0), o += 4, c.set(s, o), i;
}
function Z(a, e) {
  const t = new Uint8Array(e), s = new ArrayBuffer(5 + t.length), n = new DataView(s);
  return new Uint8Array(s).set(t, 5), n.setUint8(0, f.BODY), n.setUint32(1, a, !0), s;
}
function ee(a) {
  const e = new ArrayBuffer(5), t = new DataView(e);
  return t.setUint8(0, f.END), t.setUint32(1, a, !0), e;
}
function S(a, e) {
  const t = y.encode(e), s = new ArrayBuffer(5 + t.length), n = new DataView(s);
  return new Uint8Array(s).set(t, 5), n.setUint8(0, f.ERROR), n.setUint32(1, a, !0), s;
}
function D(a) {
  const e = new DataView(a), t = new Uint8Array(a), s = e.getUint8(0), n = e.getUint32(1, !0);
  switch (s) {
    case f.REQUEST: {
      let i = 5;
      const r = e.getUint8(i);
      i += 1;
      const c = w.decode(t.slice(i, i + r));
      i += r;
      const o = e.getUint16(i, !0);
      i += 2;
      const h = w.decode(t.slice(i, i + o));
      i += o;
      const d = e.getUint32(i, !0);
      i += 4;
      const u = JSON.parse(w.decode(t.slice(i, i + d)));
      i += d;
      const _ = i < a.byteLength ? a.slice(i) : null;
      return { type: s, requestId: n, method: c, url: h, headers: u, body: _ };
    }
    case f.RESPONSE: {
      let i = 5;
      const r = e.getUint16(i, !0);
      i += 2;
      const c = e.getUint32(i, !0);
      i += 4;
      const o = JSON.parse(w.decode(t.slice(i, i + c)));
      return { type: s, requestId: n, status: r, headers: o };
    }
    case f.BODY:
      return { type: s, requestId: n, data: a.slice(5) };
    case f.END:
      return { type: s, requestId: n };
    case f.ERROR:
      return { type: s, requestId: n, message: w.decode(t.slice(5)) };
    default:
      return { type: s, requestId: n };
  }
}
let te = 1;
class se {
  /**
   * @param {function} sendFn — async (data: ArrayBuffer) => void — sends through bonded channels
   */
  constructor(e) {
    this._send = e, this._pending = /* @__PURE__ */ new Map();
  }
  /**
   * Fetch a URL through the P2P tunnel.
   * Returns a Response-like object matching the standard fetch API.
   *
   * @param {string} url
   * @param {object} [options]
   * @param {string} [options.method='GET']
   * @param {Object<string,string>} [options.headers={}]
   * @param {string|ArrayBuffer|null} [options.body=null]
   * @returns {Promise<ProxyResponse>}
   */
  async fetch(e, t = {}) {
    const s = te++, n = (t.method || "GET").toUpperCase(), i = t.headers || {};
    let r = null;
    t.body && (typeof t.body == "string" ? r = new TextEncoder().encode(t.body).buffer : t.body instanceof ArrayBuffer ? r = t.body : t.body instanceof Uint8Array && (r = t.body.buffer));
    const c = Y(s, n, e, i, r);
    return new Promise((o, h) => {
      const d = setTimeout(() => {
        this._pending.delete(s), h(new Error(`Proxy request timed out: ${n} ${e}`));
      }, 3e4);
      this._pending.set(s, {
        resolve: o,
        reject: h,
        timeout: d,
        status: 0,
        headers: {},
        bodyChunks: []
      }), this._send(c).catch(h);
    });
  }
  /**
   * Handle incoming proxy frame (called by FastRTC internals).
   * @param {ArrayBuffer} buffer
   */
  handleIncoming(e) {
    const t = D(e), s = this._pending.get(t.requestId);
    if (s)
      switch (t.type) {
        case f.RESPONSE:
          s.status = t.status, s.headers = t.headers;
          break;
        case f.BODY:
          s.bodyChunks.push(new Uint8Array(t.data));
          break;
        case f.END: {
          clearTimeout(s.timeout), this._pending.delete(t.requestId);
          const n = s.bodyChunks.reduce((c, o) => c + o.length, 0), i = new Uint8Array(n);
          let r = 0;
          for (const c of s.bodyChunks)
            i.set(c, r), r += c.length;
          s.resolve(new ne(s.status, s.headers, i.buffer));
          break;
        }
        case f.ERROR:
          clearTimeout(s.timeout), this._pending.delete(t.requestId), s.reject(new Error(t.message || "Proxy error"));
          break;
      }
  }
}
class ne {
  constructor(e, t, s) {
    this.status = e, this.ok = e >= 200 && e < 300, this.headers = t, this._body = s;
  }
  async text() {
    return new TextDecoder().decode(this._body);
  }
  async json() {
    return JSON.parse(await this.text());
  }
  async arrayBuffer() {
    return this._body;
  }
  async blob() {
    return new Blob([this._body]);
  }
}
const M = 48 * 1024;
class ie {
  /**
   * @param {function} sendFn — async (data: ArrayBuffer) => void
   * @param {object} [opts]
   * @param {string[]} [opts.allowList] — glob patterns for allowed domains (empty = allow all)
   * @param {string[]} [opts.blockList] — glob patterns for blocked domains
   */
  constructor(e, t = {}) {
    this._send = e, this._allowList = t.allowList || [], this._blockList = t.blockList || [], this._active = !1;
  }
  /**
   * Start serving proxy requests.
   */
  serve() {
    this._active = !0;
  }
  /**
   * Stop serving proxy requests.
   */
  stop() {
    this._active = !1;
  }
  /**
   * Handle incoming proxy request frame (called by FastRTC internals).
   * @param {ArrayBuffer} buffer
   */
  async handleIncoming(e) {
    const t = D(e);
    if (t.type !== f.REQUEST) return;
    if (!this._active) {
      await this._send(S(t.requestId, "Proxy server not active"));
      return;
    }
    const { requestId: s, method: n, url: i, headers: r, body: c } = t;
    if (!this._isDomainAllowed(i)) {
      await this._send(S(s, "Domain not allowed"));
      return;
    }
    try {
      const o = { method: n, headers: r };
      c && n !== "GET" && n !== "HEAD" && (o.body = c);
      const h = await fetch(i, o), d = {};
      if (h.headers.forEach((u, _) => {
        d[_] = u;
      }), await this._send(X(s, h.status, d)), h.body) {
        const u = h.body.getReader();
        for (; ; ) {
          const { done: _, value: l } = await u.read();
          if (_) break;
          const I = l;
          for (let k = 0; k < I.length; k += M) {
            const H = I.slice(k, k + M);
            await this._send(Z(s, H));
          }
        }
      }
      await this._send(ee(s));
    } catch (o) {
      await this._send(S(s, o.message || "Proxy fetch failed"));
    }
  }
  _isDomainAllowed(e) {
    try {
      const t = new URL(e).hostname;
      if (this._blockList.length > 0) {
        for (const s of this._blockList)
          if (this._matchGlob(t, s)) return !1;
      }
      if (this._allowList.length === 0) return !0;
      for (const s of this._allowList)
        if (this._matchGlob(t, s)) return !0;
      return !1;
    } catch {
      return !1;
    }
  }
  _matchGlob(e, t) {
    return new RegExp(
      "^" + t.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
      "i"
    ).test(e);
  }
}
class re {
  /**
   * @param {RTCPeerConnection} pc
   * @param {function} renegotiateFn — async () => void — triggers SDP renegotiation
   */
  constructor(e, t) {
    this.pc = e, this._renegotiate = t, this.localStream = null, this.remoteStream = null, this._senders = [], this._listeners = {}, this.pc.ontrack = (s) => {
      this.remoteStream || (this.remoteStream = new MediaStream()), this.remoteStream.addTrack(s.track), this._emit("remoteStream", this.remoteStream), this._emit("track", s.track, s.streams);
    };
  }
  // ── Events ──
  on(e, t) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(t);
  }
  off(e, t) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((s) => s !== t));
  }
  _emit(e, ...t) {
    if (this._listeners[e])
      for (const s of this._listeners[e])
        try {
          s(...t);
        } catch (n) {
          console.error("MediaManager error:", n);
        }
  }
  // ── Camera / Mic ──
  /**
   * Start camera and/or microphone.
   * @param {MediaStreamConstraints} [constraints] — standard getUserMedia constraints
   * @returns {Promise<MediaStream>}
   */
  async startCamera(e = { video: !0, audio: !0 }) {
    return this.localStream = await navigator.mediaDevices.getUserMedia(e), this._addTracks(this.localStream), this._emit("localStream", this.localStream), this.localStream;
  }
  // ── Screen Share ──
  /**
   * Start screen sharing.
   * @param {DisplayMediaStreamOptions} [constraints]
   * @returns {Promise<MediaStream>}
   */
  async startScreenShare(e = { video: !0 }) {
    var t;
    return this.localStream = await navigator.mediaDevices.getDisplayMedia(e), this._addTracks(this.localStream), this._emit("localStream", this.localStream), (t = this.localStream.getVideoTracks()[0]) == null || t.addEventListener("ended", () => {
      this.stop(), this._emit("screenShareEnded");
    }), this.localStream;
  }
  // ── Replace Track (e.g. switch camera) ──
  /**
   * Replace a track type (video/audio) without renegotiation.
   * @param {MediaStreamTrack} newTrack
   */
  async replaceTrack(e) {
    const t = this._senders.find((s) => {
      var n;
      return ((n = s.track) == null ? void 0 : n.kind) === e.kind;
    });
    t && await t.replaceTrack(e);
  }
  // ── Stop ──
  /**
   * Stop all local media tracks and remove from peer connection.
   */
  stop() {
    if (this.localStream) {
      for (const e of this.localStream.getTracks())
        e.stop();
      this.localStream = null;
    }
    for (const e of this._senders)
      try {
        this.pc.removeTrack(e);
      } catch {
      }
    this._senders = [], this._emit("stopped");
  }
  // ── Internal ──
  _addTracks(e) {
    for (const t of e.getTracks()) {
      const s = this.pc.addTrack(t, e);
      this._senders.push(s);
    }
    this._renegotiate();
  }
}
const x = 1, N = 2, F = 3, A = new TextEncoder(), C = new TextDecoder();
class oe {
  /**
   * @param {function} sendFn — async (data: ArrayBuffer) => void
   */
  constructor(e) {
    this._send = e, this._streams = /* @__PURE__ */ new Map(), this._listeners = {};
  }
  // ── Events ──
  on(e, t) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(t);
  }
  off(e, t) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((s) => s !== t));
  }
  _emit(e, ...t) {
    if (this._listeners[e])
      for (const s of this._listeners[e])
        try {
          s(...t);
        } catch (n) {
          console.error("StreamManager error:", n);
        }
  }
  /**
   * Create a named outbound stream.
   * @param {string} name
   * @returns {Stream}
   */
  create(e) {
    const t = new P(e, this._send);
    this._streams.set(e, t);
    const s = A.encode(e), n = new ArrayBuffer(2 + s.length), i = new Uint8Array(n);
    return i[0] = x, i[1] = s.length, i.set(s, 2), this._send(n), t;
  }
  /**
   * Get an existing stream by name.
   * @param {string} name
   * @returns {Stream|undefined}
   */
  get(e) {
    return this._streams.get(e);
  }
  /**
   * Handle incoming stream frame (called by FastRTC internals).
   * @param {ArrayBuffer} buffer
   */
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === x) {
      const n = t[1], i = C.decode(t.slice(2, 2 + n)), r = new P(i, this._send);
      this._streams.set(i, r), this._emit("incoming", r);
      return;
    }
    if (s === N) {
      const n = t[1], i = C.decode(t.slice(2, 2 + n)), r = e.slice(2 + n), c = this._streams.get(i);
      c && c._handleData(r);
      return;
    }
    if (s === F) {
      const n = t[1], i = C.decode(t.slice(2, 2 + n)), r = this._streams.get(i);
      r && (r._handleClose(), this._streams.delete(i));
    }
  }
}
class P {
  constructor(e, t) {
    this.name = e, this._send = t, this._listeners = {}, this._closed = !1;
  }
  on(e, t) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(t);
  }
  off(e, t) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((s) => s !== t));
  }
  _emit(e, ...t) {
    if (this._listeners[e])
      for (const s of this._listeners[e])
        try {
          s(...t);
        } catch {
        }
  }
  /**
   * Write data to the stream.
   * @param {ArrayBuffer|Uint8Array} data
   */
  async write(e) {
    if (this._closed) throw new Error("Stream closed");
    const t = new Uint8Array(e), s = A.encode(this.name), n = new ArrayBuffer(2 + s.length + t.length), i = new Uint8Array(n);
    i[0] = N, i[1] = s.length, i.set(s, 2), i.set(t, 2 + s.length), await this._send(n);
  }
  /**
   * Close the stream.
   */
  async close() {
    if (this._closed) return;
    this._closed = !0;
    const e = A.encode(this.name), t = new ArrayBuffer(2 + e.length), s = new Uint8Array(t);
    s[0] = F, s[1] = e.length, s.set(e, 2), await this._send(t), this._emit("close");
  }
  /** @internal */
  _handleData(e) {
    this._emit("data", e);
  }
  /** @internal */
  _handleClose() {
    this._closed = !0, this._emit("close");
  }
}
const p = {
  CHUNK: 240,
  // File transfer / bonding chunks (ChunkProtocol)
  MESSAGE: 241,
  // Messenger
  PROXY: 242,
  // Proxy (client + server)
  STREAM: 243
  // StreamChannel
}, ae = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turns:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];
let v = 1;
function g(a, e) {
  const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length), n = new Uint8Array(s);
  return n[0] = a, n.set(t, 1), s;
}
class ce {
  /**
   * @param {object} opts
   * @param {RTCIceServer[]} [opts.iceServers] — override STUN/TURN servers
   * @param {number} [opts.dataChannels=32] — number of parallel P2P data channels
   * @param {number} [opts.chunkSize=65536] — chunk size in bytes
   * @param {object} [opts.proxy] — proxy server options (allowList, blockList)
   * @param {boolean} [opts.isHost=false] — advertise this peer as a proxy/service host
   * @param {boolean} [opts.requireRoomCode=false] — use private 6-digit secure room codes instead of the public network
   */
  constructor({
    iceServers: e = ae,
    dataChannels: t = 32,
    chunkSize: s = L,
    proxy: n = {},
    isHost: i = !1,
    requireRoomCode: r = !1
  } = {}) {
    this.iceServers = e, this.dataChannelCount = t, this.chunkSize = s, this.isHost = i, this.requireRoomCode = r, this.remoteIsHost = !1, this.pc = null, this.signaling = null, this.pool = null, this.bonding = null, this.monitor = new B(), this.roomCode = null, this.isOfferer = !1, this._listeners = {}, this._pendingMeta = /* @__PURE__ */ new Map(), this._probeTimers = /* @__PURE__ */ new Map(), this._negotiationState = "idle", this._pcCreated = !1, this._proxyOpts = n, this.message = null, this._proxyClient = null, this._proxyServer = null, this.proxy = null, this.media = null, this.stream = null;
  }
  // ── Event system ──
  getVersion() {
    return "0.0.2";
  }
  on(e, t) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(t);
  }
  off(e, t) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((s) => s !== t));
  }
  _emit(e, ...t) {
    if (this._listeners[e])
      for (const s of this._listeners[e])
        try {
          s(...t);
        } catch (n) {
          console.error("FastRTC event error:", n);
        }
  }
  // ── Room management ──
  async createRoom(e = null) {
    return this.isOfferer = !0, e ? this.roomCode = e : this.requireRoomCode ? this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase() : this.roomCode = "FASTRTC-PUBLIC-SWARM", new Promise((t, s) => {
      this.signaling = new R(this.roomCode, !0), this.signaling.onOpen = () => {
        this._emit("wss-open", 0), this._emit("room-created", this.roomCode), t(this.roomCode);
      }, this.signaling.onMessage = (n) => {
        this._onSignalingMessage(n);
      }, this.signaling.onClose = () => {
        this._emit("wss-close", 0);
      }, this.signaling.connect();
    });
  }
  async joinRoom(e = null) {
    if (this.isOfferer = !1, e)
      this.roomCode = e;
    else {
      if (this.requireRoomCode)
        return Promise.reject(new Error("FastRTC is configured with requireRoomCode=true, but no code was provided to joinRoom()."));
      this.roomCode = "FASTRTC-PUBLIC-SWARM";
    }
    return new Promise((t, s) => {
      this._joinResolver = t, this.signaling = new R(this.roomCode, !1), this.signaling.onOpen = () => {
        this._emit("wss-open", 0);
      }, this.signaling.onMessage = (n) => {
        this._onSignalingMessage(n);
      }, this.signaling.onClose = () => {
        this._emit("wss-close", 0);
      }, this.signaling.connect();
    });
  }
  // ── Data transfer (file) ──
  async send(e) {
    if (!this.bonding) throw new Error("Not connected");
    const t = v++, n = U(e, t, this.chunkSize).map((i) => g(p.CHUNK, i));
    await this.bonding.sendChunks(n);
  }
  async sendFile(e) {
    if (!this.bonding) throw new Error("Not connected");
    const t = v++, s = await e.arrayBuffer(), n = { name: e.name, size: e.size, type: e.type }, i = g(p.CHUNK, q(t, n));
    for (const o of this.bonding.senders)
      try {
        await o(i);
      } catch {
      }
    await new Promise((o) => setTimeout(o, 50));
    const r = U(s, t, this.chunkSize), c = r.map((o) => g(p.CHUNK, o));
    this._emit("send-start", { transferId: t, name: e.name, totalChunks: r.length }), await this.bonding.sendChunks(c), this._emit("send-complete", { transferId: t, name: e.name });
  }
  getStats() {
    return {
      links: Object.fromEntries(this.monitor.getScores()),
      weights: Object.fromEntries(this.monitor.getWeights()),
      signalingConnected: this.ws && this.ws.readyState === WebSocket.OPEN,
      openChannels: this.pool ? this.pool.getOpenCount() : 0,
      totalChannels: this.dataChannelCount
    };
  }
  disconnect() {
    this.monitor.stop();
    for (const e of this._probeTimers.values()) clearInterval(e);
    this._probeTimers.clear(), this.media && this.media.stop(), this.pool && this.pool.close(), this.pc && this.pc.close(), this.signaling && this.signaling.close(), this.pc = null, this.pool = null, this.bonding = null, this.signaling = null, this.message = null, this.proxy = null, this.media = null, this.stream = null;
  }
  // ── Internal: Signaling ──
  _onSignalingMessage(e) {
    if (e)
      switch (e.isHost === !0 && (this.remoteIsHost = !0), e.type) {
        case "peer-joined":
          this.isOfferer && this._negotiationState === "idle" ? (this._negotiationState = "offering", this._emit("peer-joined"), this._createPeerConnection(), this._startOffer()) : !this.isOfferer && !this._pcCreated && this._emit("peer-joined");
          break;
        case "offer":
          !this.isOfferer && this._negotiationState !== "answering" && this._negotiationState !== "connected" && (this._negotiationState = "answering", this._pcCreated || this._createPeerConnection(), this._handleOffer(e.sdp));
          break;
        case "answer":
          this.isOfferer && this._negotiationState === "offering" && (this._negotiationState = "connected", this._handleAnswer(e.sdp));
          break;
        case "ice-candidate":
          this._handleIceCandidate(e.candidate);
          break;
      }
  }
  // ── Internal: WebRTC P2P Connection ──
  _createPeerConnection() {
    this._pcCreated || (this._pcCreated = !0, this.pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10
    }), this.pc.onicecandidate = (e) => {
      e.candidate && this.signaling && this.signaling.ws && this.signaling.ws.readyState === WebSocket.OPEN && this.signaling.send({
        type: "ice-candidate",
        candidate: e.candidate,
        roomCode: this.roomCode
      });
    }, this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const e = this.pc.connectionState;
      this._emit("connection-state", e), e === "connected" ? this._onPeerConnected() : (e === "disconnected" || e === "failed") && this._emit("disconnected");
    }, this.pc.oniceconnectionstatechange = () => {
      this.pc && this._emit("ice-state", this.pc.iceConnectionState);
    }, this.pool = new j(this.pc, {
      channelCount: this.dataChannelCount,
      ordered: !1
    }), this.pool.onOpen((e) => {
      this._emit("channel-open", e), this._updateBondingPaths();
    }), this.pool.onClose((e) => {
      this._emit("channel-close", e);
    }), this.pool.onMessage((e, t) => {
      this._routeIncoming(t, `dc-${e}`);
    }), this.pool.createChannels(), this.media = new re(this.pc, () => this._renegotiate()));
  }
  async _startOffer() {
    const e = await this.pc.createOffer();
    await this.pc.setLocalDescription(e), this.signaling.send({
      type: "offer",
      sdp: this.pc.localDescription,
      roomCode: this.roomCode,
      isHost: this.isHost
    });
  }
  async _handleOffer(e) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(e));
    const t = await this.pc.createAnswer();
    await this.pc.setLocalDescription(t), this.signaling.send({
      type: "answer",
      sdp: this.pc.localDescription,
      roomCode: this.roomCode,
      isHost: this.isHost
    }), this._joinResolver && (this._joinResolver(), this._joinResolver = null);
  }
  async _handleAnswer(e) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(e));
  }
  async _handleIceCandidate(e) {
    if (this.pc && e)
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(e));
      } catch {
      }
  }
  /**
   * Trigger SDP renegotiation (e.g., after adding media tracks).
   */
  async _renegotiate() {
    if (!this.pc || !this.signaling || !this.signaling.ws || this.signaling.ws.readyState !== WebSocket.OPEN) return;
    const e = await this.pc.createOffer();
    await this.pc.setLocalDescription(e), this.signaling.send({
      type: "offer",
      sdp: this.pc.localDescription,
      roomCode: this.roomCode
    });
  }
  // ── Internal: Bonding + Module Init ──
  _onPeerConnected() {
    this._updateBondingPaths(), this._initSubModules(), this.monitor.start(), this._startProbing(), this._emit("connected", { remoteIsHost: this.remoteIsHost });
  }
  _initSubModules() {
    const e = async (t) => {
      this.bonding && this.bonding.senders.length > 0 && await this.bonding.sendSingle(t);
    };
    this.message = new Q(async (t) => {
      await e(g(p.MESSAGE, t));
    }), this._proxyClient = new se(async (t) => {
      await e(g(p.PROXY, t));
    }), this._proxyServer = new ie(async (t) => {
      await e(g(p.PROXY, t));
    }, this._proxyOpts), this.proxy = {
      /** Fetch a URL through the P2P tunnel. */
      fetch: (t, s) => this._proxyClient.fetch(t, s),
      /** Start serving as an exit node for proxy requests. */
      serve: (t) => {
        t && (this._proxyServer._allowList = t.allowList || [], this._proxyServer._blockList = t.blockList || []), this._proxyServer.serve();
      },
      /** Stop serving proxy requests. */
      stop: () => this._proxyServer.stop()
    }, this.stream = new oe(async (t) => {
      await e(g(p.STREAM, t));
    });
  }
  _updateBondingPaths() {
    const e = [], t = [];
    for (const s of this.pool.openChannels) {
      const n = `dc-${s}`;
      t.push(n), e.push(async (i) => {
        await this.pool.sendOnChannel(s, i);
      });
    }
    this.bonding ? this.bonding.updatePaths(e, t) : (this.bonding = new W({
      senders: e,
      linkIds: t,
      monitor: this.monitor
    }), this.bonding.onProgress((s) => {
      this._emit("progress", s);
    }), this.bonding.onComplete(({ transferId: s, data: n }) => {
      const i = this._pendingMeta.get(s);
      i ? (this._pendingMeta.delete(s), this._emit("file", { ...i, data: n, transferId: s })) : this._emit("data", { data: n, transferId: s });
    }));
  }
  // ── Internal: Message routing ──
  /**
   * Route incoming binary data to the correct subsystem based on channel type prefix.
   */
  _routeIncoming(e, t) {
    const s = new Uint8Array(e);
    if (s.length < 1) return;
    const n = s[0], i = e.slice(1);
    switch (n) {
      case p.CHUNK:
        this._handleChunkData(i, t);
        break;
      case p.MESSAGE:
        this.message && this.message.handleIncoming(i);
        break;
      case p.PROXY:
        this._handleProxyData(i);
        break;
      case p.STREAM:
        this.stream && this.stream.handleIncoming(i);
        break;
      default:
        this._handleChunkData(e, t);
        break;
    }
  }
  _handleChunkData(e, t) {
    const s = J(e);
    if (s.flags & m.PROBE) {
      this._handleProbe(s, t);
      return;
    }
    if (s.flags & m.META) {
      const n = z(s.payload);
      this._pendingMeta.set(s.transferId, n), this._emit("file-incoming", { transferId: s.transferId, ...n });
      return;
    }
    s.flags & m.DATA && this.bonding && this.bonding.receiveChunk(s);
  }
  _handleProxyData(e) {
    new DataView(e).getUint8(0) === f.REQUEST ? this._proxyServer && this._proxyServer.handleIncoming(e) : this._proxyClient && this._proxyClient.handleIncoming(e);
  }
  // ── Internal: Probing ──
  _startProbing() {
    for (const e of this.pool.openChannels) {
      const t = `dc-${e}`;
      this.monitor.addLink(t);
      const s = setInterval(async () => {
        const n = K(performance.now());
        try {
          await this.pool.sendOnChannel(e, g(p.CHUNK, n)), this.monitor.recordProbeSent(t);
        } catch {
        }
      }, 3e3);
      this._probeTimers.set(t, s);
    }
  }
  _handleProbe(e, t) {
    if (e.payload) {
      const s = V(e.payload), n = performance.now() - s;
      n > 0 && n < 3e4 && this.monitor.recordProbeResponse(t, n);
    }
  }
}
export {
  W as BondingEngine,
  B as ConnectionMonitor,
  L as DEFAULT_CHUNK_SIZE,
  j as DataChannelPool,
  ce as FastRTC,
  m as Flags,
  b as HEADER_SIZE,
  re as MediaManager,
  Q as Messenger,
  se as ProxyClient,
  f as ProxyFrameType,
  ie as ProxyServer,
  P as Stream,
  oe as StreamManager,
  J as decodeChunk,
  z as decodeMetaPayload,
  V as decodeProbeTimestamp,
  D as decodeProxyFrame,
  E as encodeChunk,
  q as encodeMetaChunk,
  K as encodeProbe,
  Y as encodeRequest,
  U as splitIntoChunks
};
