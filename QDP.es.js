var Lt = Object.defineProperty;
var qt = (c, e, t) => e in c ? Lt(c, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : c[e] = t;
var re = (c, e, t) => qt(c, typeof e != "symbol" ? e + "" : e, t);
class Ft {
  constructor(e, { channelCount: t = 4, ordered: s = !1, protocol: n = "speedrtc" } = {}) {
    this.pc = e, this.channelCount = t, this.ordered = s, this.protocol = n, this.channels = [], this.openChannels = /* @__PURE__ */ new Set(), this._rrIndex = 0, this._openArray = [], this._openArrayDirty = !0, this._onMessage = null, this._onOpen = null, this._onClose = null;
  }
  onMessage(e) {
    this._onMessage = e;
  }
  onOpen(e) {
    this._onOpen = e;
  }
  onClose(e) {
    this._onClose = e;
  }
  createChannels() {
    for (let e = 0; e < this.channelCount; e++) {
      const t = `speedrtc-${e}`, s = this.pc.createDataChannel(t, {
        ordered: this.ordered,
        protocol: this.protocol,
        id: e,
        negotiated: !0
      });
      s.binaryType = "arraybuffer", this._bindEvents(s, e), this.channels.push(s);
    }
  }
  createNegotiatedChannels() {
    this.createChannels();
  }
  async send(e) {
    const t = await this._pickChannel();
    return this.channels[t].send(e), t;
  }
  sendImmediate(e) {
    const t = this._getOpenArray();
    if (t.length === 0) return -1;
    for (let s = 0; s < t.length; s++) {
      const n = t[this._rrIndex % t.length];
      this._rrIndex = (this._rrIndex + 1) % t.length;
      const i = this.channels[n];
      if (i.bufferedAmount < 524288)
        return i.send(e), n;
    }
    return -1;
  }
  async sendOnChannel(e, t) {
    await this._waitForBuffer(e), this.channels[e].send(t);
  }
  hasAvailableChannel() {
    for (const e of this.openChannels)
      if (this.channels[e].bufferedAmount < 524288)
        return !0;
    return !1;
  }
  getOpenCount() {
    return this.openChannels.size;
  }
  close() {
    for (const e of this.channels)
      try {
        e.close();
      } catch {
      }
    this.channels = [], this.openChannels.clear();
  }
  _getOpenArray() {
    return this._openArrayDirty && (this._openArray = [...this.openChannels], this._openArrayDirty = !1), this._openArray;
  }
  _bindEvents(e, t) {
    e.onopen = () => {
      this.openChannels.add(t), this._openArrayDirty = !0, this._onOpen && this._onOpen(t);
    }, e.onclose = () => {
      this.openChannels.delete(t), this._openArrayDirty = !0, this._onClose && this._onClose(t);
    }, e.onmessage = (s) => {
      this._onMessage && this._onMessage(t, s.data);
    }, e.bufferedAmountLowThreshold = 131072;
  }
  async _pickChannel() {
    const e = this._getOpenArray();
    if (e.length === 0)
      return await new Promise((s) => {
        const n = this._onOpen;
        this._onOpen = (i) => {
          this._onOpen = n, n && n(i), s();
        };
      }), this._pickChannel();
    for (let s = 0; s < e.length; s++) {
      const n = e[this._rrIndex % e.length];
      if (this._rrIndex = (this._rrIndex + 1) % e.length, this.channels[n].bufferedAmount < 524288)
        return n;
    }
    const t = e[0];
    return await this._waitForBuffer(t), t;
  }
  _waitForBuffer(e) {
    return new Promise((t) => {
      const s = this.channels[e];
      if (!s || s.bufferedAmount < 524288) {
        t();
        return;
      }
      const n = () => {
        s.removeEventListener("bufferedamountlow", n), t();
      };
      s.addEventListener("bufferedamountlow", n), setTimeout(() => {
        s.removeEventListener("bufferedamountlow", n), t();
      }, 1500);
    });
  }
}
const Xe = 0.3, Bt = 2e4, Nt = 8e3, Wt = 5e3, Ht = 4, $t = 1;
class jt {
  constructor(e) {
    this.url = e, this.ws = null, this.connected = !1, this.latency = 0, this.load = 0, this.score = 1, this._lastSentAt = 0, this._awaitingResponse = !1, this._onMessage = null;
  }
  connect() {
    return new Promise((e, t) => {
      const s = setTimeout(() => {
        var n;
        try {
          (n = this.ws) == null || n.close();
        } catch {
        }
        t(new Error(`timeout: ${this.url}`));
      }, Wt);
      try {
        this.ws = new WebSocket(this.url), this.ws.onopen = () => {
          clearTimeout(s), this.connected = !0, e(this);
        }, this.ws.onclose = () => {
          this.connected = !1, this._updateScore();
        }, this.ws.onerror = () => {
          clearTimeout(s), this.connected = !1, t(new Error(`failed: ${this.url}`));
        }, this.ws.onmessage = (n) => this._handleRaw(n.data);
      } catch (n) {
        clearTimeout(s), t(n);
      }
    });
  }
  send(e) {
    var t;
    return ((t = this.ws) == null ? void 0 : t.readyState) === WebSocket.OPEN ? (this._lastSentAt = performance.now(), this._awaitingResponse = !0, this.ws.send(e), !0) : !1;
  }
  close() {
    if (this.connected = !1, this.ws) {
      const e = this.ws;
      if (this.ws = null, e.onmessage = null, e.onerror = null, e.onclose = null, e.readyState === WebSocket.CONNECTING)
        e.onopen = () => {
          try {
            e.close();
          } catch {
          }
        };
      else {
        e.onopen = null;
        try {
          e.close();
        } catch {
        }
      }
    }
  }
  _handleRaw(e) {
    if (this._awaitingResponse && this._lastSentAt > 0) {
      const s = performance.now() - this._lastSentAt;
      this._awaitingResponse = !1, this.latency = this.latency === 0 ? s : Xe * s + (1 - Xe) * this.latency;
    }
    let t;
    try {
      t = JSON.parse(e);
    } catch {
      return;
    }
    (t.complete !== void 0 || t.incomplete !== void 0) && (this.load = (t.complete || 0) + (t.incomplete || 0)), this._updateScore(), this._onMessage && this._onMessage(e, this);
  }
  _updateScore() {
    if (!this.connected) {
      this.score = 1 / 0;
      return;
    }
    const e = this.latency === 0 ? 150 : this.latency, t = Math.min(e / 500, 4), s = Math.min(this.load / 50, 4);
    this.score = t * 0.65 + s * 0.35;
  }
}
class yt {
  constructor(e) {
    this.nodes = e.map((t) => new jt(t)), this._active = [], this._primary = null, this._pingTimer = null, this._rebalanceTimer = null, this._closed = !1, this.onMessage = null, this.onRebalance = null, this.onNodeJoined = null;
  }
  get connected() {
    return this._active.some((e) => e.connected);
  }
  get sockets() {
    return this._active.filter((e) => e.ws).map((e) => e.ws);
  }
  async connect() {
    return new Promise((e, t) => {
      let s = 0, n = !1;
      const i = this.nodes.length, r = () => {
        if (!n && this._active.length >= $t) {
          n = !0, this._primary = this._best(), this._startTimers(), e(this._active.length);
          return;
        }
        s >= i && !n && (this._active.length > 0 ? (n = !0, this._primary = this._best(), this._startTimers(), e(this._active.length)) : t(new Error("SignalManager: all trackers failed to connect")));
      };
      for (const o of this.nodes)
        o._onMessage = (a, h) => this._onRawMessage(a, h), o.connect().then((a) => {
          if (s++, this._closed) {
            a.close(), r();
            return;
          }
          this._active.length < Ht ? (this._active.push(a), n && (this._rebalance(), this.onNodeJoined && this.onNodeJoined(a.url))) : a.close(), r();
        }).catch(() => {
          s++, r();
        });
    });
  }
  send(e) {
    var t, s;
    return (t = this._primary) != null && t.connected || (this._primary = this._best()), ((s = this._primary) == null ? void 0 : s.send(e)) ?? !1;
  }
  sendTo(e, t) {
    const s = this._active.find((n) => n.url === e && n.connected);
    return s ? s.send(t) : !1;
  }
  broadcast(e) {
    for (const t of this._active) t.send(e);
  }
  close() {
    this._stopTimers(), this._closed = !0;
    for (const e of this.nodes) e.close();
    this._active = [], this._primary = null;
  }
  getStats() {
    return this._active.map((e) => ({
      url: e.url,
      connected: e.connected,
      latency: Math.round(e.latency),
      load: e.load,
      score: +e.score.toFixed(3),
      primary: e === this._primary
    }));
  }
  _best() {
    const e = this._active.filter((t) => t.connected);
    return e.length === 0 ? null : e.reduce((t, s) => t.score <= s.score ? t : s);
  }
  _rebalance() {
    const e = this._primary, t = this._best();
    t && t !== e && (this._primary = t, this.onRebalance && this.onRebalance((e == null ? void 0 : e.url) ?? null, t.url));
  }
  _startTimers() {
    this._pingTimer = setInterval(() => {
      for (const e of this._active)
        e.connected && !e._awaitingResponse && (e._lastSentAt = performance.now(), e._awaitingResponse = !0);
    }, Nt), this._rebalanceTimer = setInterval(() => {
      this._rebalance();
    }, Bt);
  }
  _stopTimers() {
    clearInterval(this._pingTimer), clearInterval(this._rebalanceTimer), this._pingTimer = null, this._rebalanceTimer = null;
  }
  _onRawMessage(e, t) {
    this.onMessage && this.onMessage(e, t);
  }
}
const Qe = [
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.novage.com.ua",
  "wss://peertube2.cpy.re:443/tracker/socket",
  "wss://video.blender.org:443/tracker/socket",
  "wss://fediverse.tv:443/tracker/socket",
  "wss://tracker.files.fm:7073/announce",
  "wss://peertube.cpy.re:443/tracker/socket",
  "wss://videos.pair2jeux.tube:443/tracker/socket",
  "wss://videos.npo.city:443/tracker/socket",
  "wss://tube.rebellion.global:443/tracker/socket",
  "wss://peertube.tv:443/tracker/socket",
  "wss://framatube.org:443/tracker/socket",
  "wss://diode.zone:443/tracker/socket",
  "wss://tilvids.com:443/tracker/socket"
];
class fe {
  constructor(e, t, s = null) {
    this.roomCode = e, this.isOfferer = t;
    const n = Array.from("FRTC" + e).map((r) => r.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    this.infoHash = n.padEnd(40, "0"), this.peerId = Array.from(crypto.getRandomValues(new Uint8Array(20))).map((r) => r.toString(16).padStart(2, "0")).join("");
    const i = s != null && s.length ? [...s] : Qe;
    this._manager = new yt(i), this._managerPreConnected = !1, this.remotePeerId = null, this._preferredNodeUrl = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this._announceInterval = null, this._localOfferPayload = null;
  }
  useManager(e) {
    this._manager = e, this._managerPreConnected = !0;
  }
  get sockets() {
    return this._manager.sockets;
  }
  connect() {
    if (this._manager.onMessage = (e, t) => this._handleMessage(e, t), this._manager.onRebalance = () => {
      this.remotePeerId || this._announce(!1);
    }, this._manager.onNodeJoined = () => {
      this.remotePeerId || this._announce();
    }, this._managerPreConnected && this._manager.connected) {
      this.onOpen && this.onOpen(0), this._startAnnouncing();
      return;
    }
    this._manager.connect().then(() => {
      this.onOpen && this.onOpen(0), this._startAnnouncing();
    }).catch(() => {
      this.onClose && this.onClose(0);
    });
  }
  close() {
    this._stopAnnouncing(), this._manager.close();
  }
  send(e) {
    const t = JSON.stringify(e), s = {
      action: "announce",
      info_hash: this.infoHash,
      peer_id: this.peerId
    };
    if (this.remotePeerId) {
      s.to_peer_id = this.remotePeerId, s.answer = { type: "answer", sdp: t }, s.offer_id = "speedrtc-relay";
      const n = JSON.stringify(s);
      this._preferredNodeUrl ? this._manager.sendTo(this._preferredNodeUrl, n) || this._manager.send(n) : this._manager.send(n);
    } else this.isOfferer && e.type === "offer" && (this._localOfferPayload = t, s.numwant = 1, s.offers = [{
      offer_id: "speedrtc-relay",
      offer: { type: "offer", sdp: t }
    }], this._manager.broadcast(JSON.stringify(s)));
  }
  _announce(e = !0) {
    const t = {
      action: "announce",
      info_hash: this.infoHash,
      peer_id: this.peerId,
      numwant: 1
    };
    this.isOfferer && this._localOfferPayload && (t.offers = [{ offer_id: "speedrtc-relay", offer: { type: "offer", sdp: this._localOfferPayload } }]);
    const s = JSON.stringify(t);
    e ? this._manager.broadcast(s) : this._manager.send(s);
  }
  _startAnnouncing() {
    this._announce(), this._announceInterval = setInterval(() => this._announce(), 2e3);
  }
  _stopAnnouncing() {
    this._announceInterval && (clearInterval(this._announceInterval), this._announceInterval = null);
  }
  _handleMessage(e, t) {
    var n, i;
    let s;
    try {
      s = JSON.parse(e);
    } catch {
      return;
    }
    if ((n = s.answer) != null && n.sdp && (this._stopAnnouncing(), this.remotePeerId = s.peer_id, this._preferredNodeUrl = t.url, this.onMessage))
      try {
        this.onMessage(JSON.parse(s.answer.sdp));
      } catch {
      }
    if ((i = s.offer) != null && i.sdp) {
      if (this._stopAnnouncing(), this.remotePeerId = s.peer_id, this._preferredNodeUrl = t.url, this.onMessage)
        try {
          this.onMessage(JSON.parse(s.offer.sdp));
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
    s.action === "announce" && s.peer_id && s.peer_id !== this.peerId && this.isOfferer && !this.remotePeerId && (this.remotePeerId = s.peer_id, this._preferredNodeUrl = t.url, this.onMessage && this.onMessage({ type: "peer-joined" }));
  }
}
re(fe, "DEFAULT_TRACKER_URLS", Qe);
const ye = "https://oauth2.googleapis.com/token", Ye = "https://www.googleapis.com/auth/spreadsheets", Kt = "https://accounts.google.com/gsi/client";
let Ze = !1, oe = null;
const we = /* @__PURE__ */ new Map();
function et(c) {
  return c ? c.refreshToken ? `refresh:${c.clientId}:${c.refreshToken.slice(-12)}` : c.serviceAccount ? `service:${c.serviceAccount.client_email}` : c.accessToken ? `static:${c.accessToken.slice(-12)}` : null : null;
}
class y {
  constructor(e, t, s = {}) {
    if (this.roomCode = e, this.isOfferer = t, this._driveConfig = s, this.spreadsheetId = s.spreadsheetId, this.pollInterval = s.pollInterval || 500, this.sheetName = s.sheetName || e, !this.spreadsheetId)
      throw new Error("DriveSignal requires a spreadsheetId");
    if (this._authMode = null, this._accessToken = null, this._tokenExpiry = 0, this._apiKey = s.apiKey || null, this._rawToken = null, this._rawOuid = "", this._rawGid = "0", this._rawSid = null, this._rawRev = 1, this._rawReqId = 0, this._myWriteRow = 1, this._lastRawValues = null, this._clientId = s.clientId || null, this._clientSecret = s.clientSecret || null, this._refreshToken = s.refreshToken || null, this._serviceAccount = s.serviceAccount || null, this._signingKey = null, this._gisTokenClient = null, this._gisResolve = null, s.raw && s.raw.token)
      this._authMode = "raw", this._rawToken = s.raw.token, this._rawOuid = s.raw.ouid || "", this._rawGid = String(s.raw.gid ?? 0), this._rawRev = s.raw.rev ?? 1, this._rawSid = Array.from(
        crypto.getRandomValues(new Uint8Array(8)),
        (n) => n.toString(16).padStart(2, "0")
      ).join("");
    else if (s.clientId && !s.clientSecret && !s.refreshToken)
      this._authMode = "client";
    else if (s.refreshToken && s.clientId && s.clientSecret)
      this._authMode = "refresh";
    else if (s.serviceAccount && s.serviceAccount.client_email && s.serviceAccount.private_key)
      this._authMode = "service";
    else if (s.accessToken)
      this._authMode = "static", this._accessToken = s.accessToken, this._tokenExpiry = Date.now() + 3300 * 1e3;
    else if (s.apiKey)
      this._authMode = "apikey";
    else
      throw new Error(
        "DriveSignal requires one of: raw ({ token }), clientId (client-only), accessToken, refreshToken (+ clientId/clientSecret), serviceAccount, or apiKey"
      );
    this.peerId = y._generatePeerId(), this.remotePeerId = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this.connected = !1, this._pollTimer = null, this._myColumn = null, this._remoteColIndex = null, this._readCursor = 1, this._destroyed = !1, this._baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
  }
  _qSheet() {
    return "'" + this.sheetName.replace(/'/g, "''") + "'";
  }
  async warmup() {
    if (this._authMode === "refresh" || this._authMode === "service")
      try {
        await this._ensureToken();
      } catch {
      }
  }
  static async warmupToken(e) {
    const t = et(e);
    if (!t) return;
    const s = we.get(t);
    if (!(s && Date.now() < s.expiry - 5e3))
      try {
        await new y("__warmup__", !1, e)._ensureToken();
      } catch {
      }
  }
  async connect() {
    try {
      if (this._authMode === "raw") {
        if (await this._registerColumn(), this._lastRawValues && this._myColumn) {
          const e = y._colIndex(this._myColumn);
          let t = 0;
          for (let s = 0; s < this._lastRawValues.length; s++)
            this._lastRawValues[s] && this._lastRawValues[s][e] && (t = s + 1);
          this._myWriteRow = t;
        }
      } else
        await this._ensureToken(), await this._setupSheet(), this._myWriteRow = 2;
      this.connected = !0, this.onOpen && this.onOpen(0), this._startPolling();
    } catch (e) {
      console.error("[DriveSignal] connect failed:", e), this.onClose && this.onClose(0);
    }
  }
  close() {
    this._stopPolling(), this.connected = !1, this._destroyed = !0, this.onClose && this.onClose(0);
  }
  send(e) {
    if (!this.connected || !this._myColumn) return;
    const t = JSON.stringify(e);
    this._appendToColumn(this._myColumn, t).catch((s) => {
      console.error("[DriveSignal] send error:", s);
    });
  }
  async cleanup() {
    if (this._myColumn)
      try {
        const e = `${this._qSheet()}!${this._myColumn}2:${this._myColumn}1000`;
        await this._sheetsRequest(
          `/${this.spreadsheetId}/values/${encodeURIComponent(e)}:clear`,
          "POST"
        );
      } catch {
      }
  }
  async _setupSheet() {
    let e = [];
    try {
      const n = await this._sheetsRequest(
        `/${this.spreadsheetId}/values/${encodeURIComponent(`${this._qSheet()}!1:1`)}`,
        "GET"
      );
      e = n.values ? n.values[0] : [];
    } catch (n) {
      if (n.status === 400 || n.status === 404)
        await this._sheetsRequest(
          `/${this.spreadsheetId}:batchUpdate`,
          "POST",
          { requests: [{ addSheet: { properties: { title: this.sheetName } } }] }
        ), e = [];
      else
        throw n;
    }
    const t = e.indexOf(this.peerId);
    if (t >= 0) {
      this._myColumn = y._colLetter(t);
      return;
    }
    const s = e.length;
    this._myColumn = y._colLetter(s), await this._writeCell(`${this._qSheet()}!${this._myColumn}1`, this.peerId);
  }
  async _registerColumn() {
    const e = await this._readHeaders(), t = e.indexOf(this.peerId);
    if (t >= 0) {
      this._myColumn = y._colLetter(t);
      return;
    }
    const s = e.length;
    this._myColumn = y._colLetter(s), await this._writeCell(`${this._qSheet()}!${this._myColumn}1`, this.peerId);
  }
  _startPolling() {
    this._poll(), this._pollTimer = setInterval(() => this._poll(), this.pollInterval);
  }
  _stopPolling() {
    this._pollTimer && (clearInterval(this._pollTimer), this._pollTimer = null);
  }
  async _poll() {
    if (!this._destroyed)
      try {
        let e;
        if (this._authMode === "raw" ? e = await this._rawReadSheet() : e = (await this._sheetsRequest(
          `/${this.spreadsheetId}/values/${encodeURIComponent(this._qSheet())}`,
          "GET"
        )).values, !e || e.length === 0) return;
        const t = e[0];
        for (let s = 0; s < t.length; s++) {
          const n = t[s];
          if (!(!n || n === this.peerId) && (this.remotePeerId || (this.remotePeerId = n, this._remoteColIndex = s, this.onMessage && this.onMessage({ type: "peer-joined" })), n === this.remotePeerId)) {
            for (let i = this._readCursor; i < e.length; i++) {
              const r = e[i] ? e[i][s] : null;
              if (r)
                try {
                  const o = JSON.parse(r);
                  this.onMessage && this.onMessage(o);
                } catch {
                }
            }
            e.length > this._readCursor && (this._readCursor = e.length);
          }
        }
        if (this._authMode === "raw" && this._myColumn) {
          const s = y._colIndex(this._myColumn);
          let n = 0;
          for (let i = 0; i < e.length; i++)
            e[i] && e[i][s] && (n = i + 1);
          n >= this._myWriteRow && (this._myWriteRow = n);
        }
      } catch {
      }
  }
  async _sheetsRequest(e, t, s) {
    await this._ensureToken();
    const n = e.includes("?") ? "&" : "?", i = !this._accessToken && this._apiKey ? `${n}key=${encodeURIComponent(this._apiKey)}` : "", r = `${this._baseUrl}${e}${i}`, o = { "Content-Type": "application/json" };
    this._accessToken && (o.Authorization = `Bearer ${this._accessToken}`);
    const a = { method: t, headers: o };
    s && (a.body = JSON.stringify(s));
    let h = await fetch(r, a);
    if (h.status === 401 && this._authMode !== "static" && this._authMode !== "apikey" && (this._tokenExpiry = 0, await this._ensureToken(), this._accessToken && (a.headers.Authorization = `Bearer ${this._accessToken}`), h = await fetch(r, a)), !h.ok) {
      const d = new Error(`Sheets API ${t} ${e} → ${h.status}`);
      throw d.status = h.status, d;
    }
    const l = await h.text();
    return l ? JSON.parse(l) : {};
  }
  async _ensureToken() {
    if (this._authMode === "apikey" || this._accessToken && Date.now() < this._tokenExpiry - 5e3) return;
    const e = et(this._driveConfig);
    if (e) {
      const t = we.get(e);
      if (t && Date.now() < t.expiry - 5e3) {
        this._accessToken = t.token, this._tokenExpiry = t.expiry;
        return;
      }
    }
    this._authMode === "refresh" ? await this._refreshAccessToken() : this._authMode === "service" ? await this._mintServiceAccountToken() : this._authMode === "client" && await this._requestClientToken(), e && this._accessToken && we.set(e, { token: this._accessToken, expiry: this._tokenExpiry });
  }
  async _refreshAccessToken() {
    const e = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this._clientId,
      client_secret: this._clientSecret,
      refresh_token: this._refreshToken
    }), t = await fetch(ye, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: e.toString()
    });
    if (!t.ok)
      throw new Error(`[DriveSignal] refresh token exchange failed: ${t.status}`);
    const s = await t.json();
    this._accessToken = s.access_token, this._tokenExpiry = Date.now() + (s.expires_in ? s.expires_in * 1e3 - 3e5 : 3300 * 1e3);
  }
  async _mintServiceAccountToken() {
    const e = Math.floor(Date.now() / 1e3), t = {
      iss: this._serviceAccount.client_email,
      scope: Ye,
      aud: ye,
      iat: e,
      exp: e + 3600
    }, s = await y._signJwt(t, this._serviceAccount.private_key, this), n = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: s
    }), i = await fetch(ye, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: n.toString()
    });
    if (!i.ok)
      throw new Error(`[DriveSignal] service account token mint failed: ${i.status}`);
    const r = await i.json();
    this._accessToken = r.access_token, this._tokenExpiry = Date.now() + (r.expires_in ? r.expires_in * 1e3 - 3e5 : 3300 * 1e3);
  }
  async _requestClientToken() {
    return await y._loadGisScript(), this._gisTokenClient || (this._gisTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this._clientId,
      scope: Ye,
      callback: (e) => {
        if (e.error) {
          console.error("[DriveSignal] GIS token error:", e.error), this._gisResolve && this._gisResolve();
          return;
        }
        this._accessToken = e.access_token, this._tokenExpiry = Date.now() + ((e.expires_in || 3600) * 1e3 - 3e5), this._gisResolve && this._gisResolve();
      }
    })), new Promise((e) => {
      this._gisResolve = e, this._accessToken ? this._gisTokenClient.requestAccessToken({ prompt: "" }) : this._gisTokenClient.requestAccessToken({ prompt: "consent" });
    });
  }
  static _loadGisScript() {
    return Ze && typeof google < "u" && google.accounts ? Promise.resolve() : oe || (oe = new Promise((e, t) => {
      const s = document.createElement("script");
      s.src = Kt, s.async = !0, s.onload = () => {
        Ze = !0, e();
      }, s.onerror = () => t(new Error("[DriveSignal] Failed to load Google Identity Services script")), document.head.appendChild(s);
    }), oe);
  }
  async _readHeaders() {
    if (this._authMode === "raw")
      return this._lastRawValues = await this._rawReadSheet(), this._lastRawValues.length > 0 ? this._lastRawValues[0] : [];
    const e = `${this._qSheet()}!1:1`;
    try {
      const t = await this._sheetsRequest(
        `/${this.spreadsheetId}/values/${encodeURIComponent(e)}`,
        "GET"
      );
      return t.values ? t.values[0] : [];
    } catch {
      return [];
    }
  }
  async _writeCell(e, t) {
    if (this._authMode === "raw") {
      const { row: s, col: n } = y._parseRange(e);
      return this._rawWriteCell(s, n, t);
    }
    await this._sheetsRequest(
      `/${this.spreadsheetId}/values/${encodeURIComponent(e)}?valueInputOption=RAW`,
      "PUT",
      { values: [[t]] }
    );
  }
  async _appendToColumn(e, t) {
    if (this._authMode === "raw") {
      const i = y._colIndex(e), r = this._myWriteRow;
      return this._myWriteRow++, this._rawWriteCell(r, i, t);
    }
    const s = this._myWriteRow;
    this._myWriteRow++;
    const n = `${this._qSheet()}!${e}${s}`;
    await this._sheetsRequest(
      `/${this.spreadsheetId}/values/${encodeURIComponent(n)}?valueInputOption=RAW`,
      "PUT",
      { values: [[t]] }
    );
  }
  async _rawWriteCell(e, t, s) {
    this._rawReqId++;
    const n = Math.floor(Math.random() * 2147483647), i = Math.floor(Math.random() * 2147483647), r = JSON.stringify([
      [this._rawGid, e, t, e, t],
      [n, 3, [2, s], null, null, 0],
      [null, [[null, 513, [0], null, null, null, null, null, null, null, null, 0]]]
    ]), o = JSON.stringify([{
      commands: [[i, r]],
      sid: this._rawSid,
      reqId: this._rawReqId
    }]), a = new URLSearchParams({
      id: this.spreadsheetId,
      sid: this._rawSid,
      vc: "1",
      c: "1",
      w: "1",
      flr: "0",
      smv: "2147483647",
      smb: '[2147483647,"APwL"]',
      token: this._rawToken,
      ouid: this._rawOuid,
      includes_info_params: "true",
      usp: "drive_web",
      cros_files: "false",
      nded: "false"
    }), h = `https://docs.google.com/spreadsheets/u/0/d/${this.spreadsheetId}/save?${a}`, l = new FormData();
    l.append("rev", String(this._rawRev)), l.append("bundles", o);
    try {
      await fetch(h, {
        method: "POST",
        body: l,
        credentials: "include",
        mode: "no-cors"
      });
    } catch {
    }
    this._rawRev++;
  }
  async _rawReadSheet() {
    return new Promise((e) => {
      const t = `_ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, s = setTimeout(() => {
        delete window[t], e([]);
      }, 8e3);
      window[t] = (i) => {
        clearTimeout(s), delete window[t], e(y._parseGvizTable(i));
      };
      const n = document.createElement("script");
      n.src = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=responseHandler:${t}&gid=${this._rawGid}&headers=0&tq=${encodeURIComponent("SELECT *")}`, n.onerror = () => {
        clearTimeout(s), delete window[t], e([]);
      }, document.head.appendChild(n), n.addEventListener("load", () => n.remove());
    });
  }
  static _parseGvizTable(e) {
    return !e || e.status !== "ok" || !e.table ? [] : (e.table.rows || []).map((s) => (s.c || []).map((i) => i && i.v != null ? String(i.v) : ""));
  }
  static _colIndex(e) {
    let t = 0;
    for (let s = 0; s < e.length; s++)
      t = t * 26 + (e.charCodeAt(s) - 64);
    return t - 1;
  }
  static _parseRange(e) {
    const s = (e.includes("!") ? e.split("!")[1] : e).match(/^([A-Z]+)(\d+)$/);
    return s ? {
      col: y._colIndex(s[1]),
      row: parseInt(s[2], 10) - 1
    } : { row: 0, col: 0 };
  }
  static _generatePeerId() {
    const e = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", t = crypto.getRandomValues(new Uint8Array(9));
    return Array.from(t, (s) => e[s % e.length]).join("");
  }
  static _colLetter(e) {
    let t = "", s = e;
    for (; s >= 0; )
      t = String.fromCharCode(65 + s % 26) + t, s = Math.floor(s / 26) - 1;
    return t;
  }
  static async _signJwt(e, t, s) {
    s._signingKey || (s._signingKey = await y._importPem(t));
    const n = { alg: "RS256", typ: "JWT" }, i = [
      y._b64url(JSON.stringify(n)),
      y._b64url(JSON.stringify(e))
    ], r = new TextEncoder().encode(i.join(".")), o = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      s._signingKey,
      r
    );
    return i.push(y._b64urlBuf(o)), i.join(".");
  }
  static async _importPem(e) {
    const t = e.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "").replace(/-----END (?:RSA )?PRIVATE KEY-----/, "").replace(/\s/g, ""), s = atob(t), n = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) n[i] = s.charCodeAt(i);
    return crypto.subtle.importKey(
      "pkcs8",
      n.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      !1,
      ["sign"]
    );
  }
  static _b64url(e) {
    return btoa(e).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  static _b64urlBuf(e) {
    const t = new Uint8Array(e);
    let s = "";
    for (let n = 0; n < t.length; n++) s += String.fromCharCode(t[n]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
}
class tt {
  constructor(e, t, s) {
    this.roomCode = e, this.isOfferer = t, this.serverUrl = s, this.ws = null, this.connected = !1, this.remotePeerId = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this._preConnectedWs = null;
  }
  usePreConnectedSocket(e) {
    this._preConnectedWs = e;
  }
  connect() {
    if (this._preConnectedWs && this._preConnectedWs.readyState === WebSocket.OPEN) {
      this.ws = this._preConnectedWs, this._preConnectedWs = null, this.connected = !0, this._setup(), this._joinRoom(), this.onOpen && this.onOpen(0);
      return;
    }
    this.ws = new WebSocket(this.serverUrl), this.ws.onopen = () => {
      this.connected = !0, this._setup(), this._joinRoom(), this.onOpen && this.onOpen(0);
    }, this.ws.onerror = () => {
    }, this.ws.onclose = () => {
      this.connected = !1, this.onClose && this.onClose(0);
    };
  }
  send(e) {
    !this.ws || this.ws.readyState !== WebSocket.OPEN || this.ws.send(JSON.stringify({
      ...e,
      roomCode: this.roomCode
    }));
  }
  close() {
    if (this.connected = !1, this.ws) {
      this.ws.onopen = null, this.ws.onclose = null, this.ws.onerror = null, this.ws.onmessage = null;
      try {
        this.ws.close();
      } catch {
      }
      this.ws = null;
    }
  }
  _setup() {
    this.ws.onmessage = (e) => {
      let t;
      try {
        t = JSON.parse(e.data);
      } catch {
        return;
      }
      (t.type === "peer-joined" || t.type === "offer" || t.type === "answer" || t.type === "ice-candidate") && (this.remotePeerId = "remote"), this.onMessage && this.onMessage(t);
    }, this.ws.onclose = () => {
      this.connected = !1, this.onClose && this.onClose(0);
    };
  }
  _joinRoom() {
    this.ws.send(JSON.stringify({
      type: "join-room",
      roomCode: this.roomCode
    }));
  }
  static preConnect(e) {
    return new Promise((t, s) => {
      const n = new WebSocket(e);
      n.onopen = () => t(n), n.onerror = () => s(new Error("preConnect failed")), setTimeout(() => {
        if (n.readyState !== WebSocket.OPEN) {
          try {
            n.close();
          } catch {
          }
          s(new Error("preConnect timeout"));
        }
      }, 5e3);
    });
  }
}
const T = {
  CONNECT: 1,
  CONNACK: 2,
  PUBLISH: 3,
  PUBACK: 4,
  SUBSCRIBE: 8,
  PINGREQ: 12,
  DISCONNECT: 14
};
function P(c) {
  const e = new TextEncoder().encode(c), t = new Uint8Array(2 + e.length);
  return t[0] = e.length >> 8 & 255, t[1] = e.length & 255, t.set(e, 2), t;
}
function B(c) {
  const e = [];
  do {
    let t = c % 128;
    c = Math.floor(c / 128), c > 0 && (t |= 128), e.push(t);
  } while (c > 0);
  return new Uint8Array(e);
}
function Ue(c, e) {
  let t = 0, s = 1, n = e, i;
  do {
    if (n >= c.length) return null;
    i = c[n++], t += (i & 127) * s, s *= 128;
  } while (i & 128);
  return { value: t, nextOffset: n };
}
function Me(c, e, t, s) {
  const n = P("MQTT"), i = 4;
  let r = 2;
  e && (r |= 128), t && (r |= 64);
  const o = P(c), a = e ? P(e) : new Uint8Array(0), h = t ? P(t) : new Uint8Array(0), l = new Uint8Array([
    ...n,
    i,
    r,
    s >> 8 & 255,
    s & 255
  ]), d = new Uint8Array([...o, ...a, ...h]), f = l.length + d.length, u = B(f), _ = new Uint8Array(1 + u.length + f);
  return _[0] = T.CONNECT << 4, _.set(u, 1), _.set(l, 1 + u.length), _.set(d, 1 + u.length + l.length), _;
}
function Le(c, e, t, s) {
  const n = P(c), i = typeof e == "string" ? new TextEncoder().encode(e) : new Uint8Array(e), r = t > 0, a = n.length + (r ? 2 : 0) + i.length, h = B(a), l = new Uint8Array(1 + h.length + a);
  let d = T.PUBLISH << 4;
  t === 1 ? d |= 2 : t === 2 && (d |= 4), l[0] = d, l.set(h, 1);
  let f = 1 + h.length;
  return l.set(n, f), f += n.length, r && (l[f++] = s >> 8 & 255, l[f++] = s & 255), l.set(i, f), l;
}
function qe(c, e, t) {
  let s = 0;
  const n = e.map((h) => {
    const l = P(h);
    return s += l.length + 1, l;
  }), i = 2 + s, r = B(i), o = new Uint8Array(1 + r.length + i);
  o[0] = T.SUBSCRIBE << 4 | 2, o.set(r, 1);
  let a = 1 + r.length;
  o[a++] = c >> 8 & 255, o[a++] = c & 255;
  for (const h of n)
    o.set(h, a), a += h.length, o[a++] = t;
  return o;
}
function Fe() {
  return new Uint8Array([T.PINGREQ << 4, 0]);
}
function Be() {
  return new Uint8Array([T.DISCONNECT << 4, 0]);
}
function Ne(c) {
  return new Uint8Array([T.PUBACK << 4, 2, c >> 8 & 255, c & 255]);
}
function We(c) {
  if (c.length < 2) return null;
  const e = c[0], t = Ue(c, 1);
  if (!t) return null;
  const s = 1 + (t.nextOffset - 1) + t.value;
  return c.length < s ? null : {
    type: e >> 4 & 15,
    firstByte: e,
    data: c.slice(0, s),
    payloadStart: t.nextOffset,
    remainingLen: t.value,
    totalLen: s
  };
}
function He(c, e, t, s) {
  const n = c >> 1 & 3;
  let i = t;
  const r = e[i] << 8 | e[i + 1];
  i += 2;
  const o = new TextDecoder().decode(e.slice(i, i + r));
  i += r;
  let a = 0;
  n > 0 && (a = e[i] << 8 | e[i + 1], i += 2);
  const h = e.slice(i, t + s);
  return { topic: o, payload: h, qos: n, packetId: a };
}
const j = {
  MESSAGE_EXPIRY: 2,
  SESSION_EXPIRY: 17,
  TOPIC_ALIAS_MAX: 34,
  TOPIC_ALIAS: 35
}, N = {};
[1, 23, 25, 36, 37, 40, 41, 42].forEach((c) => N[c] = "byte");
[33, 34, 35].forEach((c) => N[c] = "uint16");
[2, 17, 19, 24, 39].forEach((c) => N[c] = "uint32");
[11].forEach((c) => N[c] = "varint");
[3, 8, 18, 21, 26, 28, 31].forEach((c) => N[c] = "utf8");
[9, 22].forEach((c) => N[c] = "binary");
[38].forEach((c) => N[c] = "pair");
function $e(c) {
  if (!c || Object.keys(c).length === 0)
    return B(0);
  const e = [];
  for (const [r, o] of Object.entries(c)) {
    const a = Number(r), h = N[a];
    if (h)
      switch (h) {
        case "byte":
          e.push(new Uint8Array([a, o & 255]));
          break;
        case "uint16":
          e.push(new Uint8Array([a, o >> 8 & 255, o & 255]));
          break;
        case "uint32":
          e.push(new Uint8Array([a, o >> 24 & 255, o >> 16 & 255, o >> 8 & 255, o & 255]));
          break;
        case "varint": {
          const l = B(o), d = new Uint8Array(1 + l.length);
          d[0] = a, d.set(l, 1), e.push(d);
          break;
        }
        case "utf8": {
          const l = P(o), d = new Uint8Array(1 + l.length);
          d[0] = a, d.set(l, 1), e.push(d);
          break;
        }
        case "binary": {
          const l = o instanceof Uint8Array ? o : new Uint8Array(o), d = new Uint8Array(3 + l.length);
          d[0] = a, d[1] = l.length >> 8 & 255, d[2] = l.length & 255, d.set(l, 3), e.push(d);
          break;
        }
        case "pair": {
          if (Array.isArray(o))
            for (const [l, d] of o) {
              const f = P(l), u = P(d), _ = new Uint8Array(1 + f.length + u.length);
              _[0] = a, _.set(f, 1), _.set(u, 1 + f.length), e.push(_);
            }
          break;
        }
      }
  }
  let t = 0;
  for (const r of e) t += r.length;
  const s = B(t), n = new Uint8Array(s.length + t);
  n.set(s, 0);
  let i = s.length;
  for (const r of e)
    n.set(r, i), i += r.length;
  return n;
}
function wt(c, e) {
  const t = Ue(c, e);
  if (!t) return { props: {}, nextOffset: e };
  let s = t.nextOffset;
  const n = s + t.value, i = {};
  for (; s < n; ) {
    const r = c[s++], o = N[r];
    if (!o) break;
    switch (o) {
      case "byte":
        i[r] = c[s++];
        break;
      case "uint16":
        i[r] = c[s] << 8 | c[s + 1], s += 2;
        break;
      case "uint32":
        i[r] = (c[s] << 24 | c[s + 1] << 16 | c[s + 2] << 8 | c[s + 3]) >>> 0, s += 4;
        break;
      case "varint": {
        const a = Ue(c, s);
        i[r] = a.value, s = a.nextOffset;
        break;
      }
      case "utf8": {
        const a = c[s] << 8 | c[s + 1];
        s += 2, i[r] = new TextDecoder().decode(c.slice(s, s + a)), s += a;
        break;
      }
      case "binary": {
        const a = c[s] << 8 | c[s + 1];
        s += 2, i[r] = c.slice(s, s + a), s += a;
        break;
      }
      case "pair": {
        const a = c[s] << 8 | c[s + 1];
        s += 2;
        const h = new TextDecoder().decode(c.slice(s, s + a));
        s += a;
        const l = c[s] << 8 | c[s + 1];
        s += 2;
        const d = new TextDecoder().decode(c.slice(s, s + l));
        s += l, i[r] || (i[r] = []), i[r].push([h, d]);
        break;
      }
    }
  }
  return { props: i, nextOffset: n };
}
function bt(c, e, t, s, n = {}) {
  const i = P("MQTT"), r = 5;
  let o = 2;
  e && (o |= 128), t && (o |= 64);
  const a = P(c), h = e ? P(e) : new Uint8Array(0), l = t ? P(t) : new Uint8Array(0), d = $e(n), f = new Uint8Array([
    ...i,
    r,
    o,
    s >> 8 & 255,
    s & 255
  ]), u = new Uint8Array([...a, ...h, ...l]), _ = f.length + d.length + u.length, p = B(_), w = new Uint8Array(1 + p.length + _);
  w[0] = T.CONNECT << 4, w.set(p, 1);
  let g = 1 + p.length;
  return w.set(f, g), g += f.length, w.set(d, g), g += d.length, w.set(u, g), w;
}
function Oe(c, e, t, s, n = {}) {
  const i = P(c), r = typeof e == "string" ? new TextEncoder().encode(e) : new Uint8Array(e), o = $e(n), a = t > 0, l = i.length + (a ? 2 : 0) + o.length + r.length, d = B(l), f = new Uint8Array(1 + d.length + l);
  let u = T.PUBLISH << 4;
  t === 1 ? u |= 2 : t === 2 && (u |= 4), f[0] = u, f.set(d, 1);
  let _ = 1 + d.length;
  return f.set(i, _), _ += i.length, a && (f[_++] = s >> 8 & 255, f[_++] = s & 255), f.set(o, _), _ += o.length, f.set(r, _), f;
}
function Ct(c, e, t, s = {}) {
  const n = $e(s);
  let i = 0;
  const r = e.map((d) => {
    const f = P(d);
    return i += f.length + 1, f;
  }), o = 2 + n.length + i, a = B(o), h = new Uint8Array(1 + a.length + o);
  h[0] = T.SUBSCRIBE << 4 | 2, h.set(a, 1);
  let l = 1 + a.length;
  h[l++] = c >> 8 & 255, h[l++] = c & 255, h.set(n, l), l += n.length;
  for (const d of r)
    h.set(d, l), l += d.length, h[l++] = t;
  return h;
}
function St(c, e, t) {
  const s = c[e] & 1, n = c[e + 1];
  let i = {};
  return t > 2 && (i = wt(c, e + 2).props), { sessionPresent: s, reasonCode: n, props: i };
}
function It(c, e, t, s) {
  const n = c >> 1 & 3;
  let i = t;
  const r = e[i] << 8 | e[i + 1];
  i += 2;
  const o = new TextDecoder().decode(e.slice(i, i + r));
  i += r;
  let a = 0;
  n > 0 && (a = e[i] << 8 | e[i + 1], i += 2);
  const h = wt(e, i);
  i = h.nextOffset;
  const l = e.slice(i, t + s);
  return { topic: o, payload: l, qos: n, packetId: a, props: h.props };
}
class Vt {
  constructor(e, t, s = {}) {
    this.roomCode = e, this.isOfferer = t, this.brokerUrl = s.brokerUrl, this.username = s.username || null, this.password = s.password || null, this.qos = s.qos ?? 1, this.keepalive = s.keepalive ?? 30, this.topicPrefix = s.topicPrefix || "qdp", this.protocolVersion = s.protocolVersion || 4, this.sharedGroup = s.sharedGroup || null, this.peerId = s.clientId || "qdp-" + Array.from(crypto.getRandomValues(new Uint8Array(8))).map((n) => n.toString(16).padStart(2, "0")).join(""), this.remotePeerId = null, this.connected = !1, this.onMessage = null, this.onOpen = null, this.onClose = null, this._ws = null, this._packetId = 0, this._pingInterval = null, this._announceInterval = null, this._localOfferPayload = null, this._closed = !1, this._recvBuf = new Uint8Array(0);
  }
  get sockets() {
    return this._ws ? [this._ws] : [];
  }
  connect() {
    if (!this.brokerUrl) throw new Error("MQTTSignal: brokerUrl is required");
    this._closed = !1;
    const e = ["mqtt"];
    this._ws = new WebSocket(this.brokerUrl, e), this._ws.binaryType = "arraybuffer", this._ws.onopen = () => {
      if (this.protocolVersion === 5) {
        const t = { [j.SESSION_EXPIRY]: 0 };
        this._ws.send(bt(this.peerId, this.username, this.password, this.keepalive, t));
      } else
        this._ws.send(Me(this.peerId, this.username, this.password, this.keepalive));
    }, this._ws.onmessage = (t) => {
      const s = new Uint8Array(t.data), n = new Uint8Array(this._recvBuf.length + s.length);
      n.set(this._recvBuf), n.set(s, this._recvBuf.length), this._recvBuf = n, this._processBuffer();
    }, this._ws.onclose = () => {
      this.connected = !1, this._stopPing(), this._stopAnnouncing(), !this._closed && this.onClose && this.onClose(0);
    }, this._ws.onerror = () => {
    };
  }
  close() {
    if (this._closed = !0, this._stopPing(), this._stopAnnouncing(), this._ws) {
      try {
        this._ws.readyState === WebSocket.OPEN && this._ws.send(Be()), this._ws.close();
      } catch {
      }
      this._ws = null;
    }
    this.connected = !1;
  }
  send(e) {
    if (!(!this._ws || this._ws.readyState !== WebSocket.OPEN)) {
      if (this.remotePeerId) {
        const t = `${this.topicPrefix}/${this.roomCode}/msg/${this.remotePeerId}`, s = JSON.stringify({ from: this.peerId, data: e });
        this._publish(t, s);
      } else if (this.isOfferer && e.type === "offer") {
        this._localOfferPayload = e;
        const t = `${this.topicPrefix}/${this.roomCode}/offer`, s = JSON.stringify({ from: this.peerId, data: e });
        this._publish(t, s);
      }
    }
  }
  _nextPacketId() {
    return this._packetId = this._packetId + 1 & 65535, this._packetId === 0 && (this._packetId = 1), this._packetId;
  }
  _publish(e, t) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const s = this.qos > 0 ? this._nextPacketId() : 0;
    this.protocolVersion === 5 ? this._ws.send(Oe(e, t, this.qos, s, {})) : this._ws.send(Le(e, t, this.qos, s));
  }
  _subscribe(e) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const t = this._nextPacketId();
    this.protocolVersion === 5 ? this._ws.send(Ct(t, e, this.qos, {})) : this._ws.send(qe(t, e, this.qos));
  }
  _processBuffer() {
    for (; this._recvBuf.length >= 2; ) {
      const e = We(this._recvBuf);
      if (!e) break;
      this._recvBuf = this._recvBuf.slice(e.totalLen), this._handlePacket(e.type, e.firstByte, e.data, e.payloadStart, e.remainingLen);
    }
  }
  _handlePacket(e, t, s, n, i) {
    switch (e) {
      case T.CONNACK: {
        const r = this.protocolVersion === 5 ? St(s, n, i).reasonCode : s[n + 1];
        r === 0 ? (this.connected = !0, this._startPing(), this._subscribeRoom(), this._startAnnouncing(), this.onOpen && this.onOpen(0)) : (this.close(), this.onClose && this.onClose(r));
        break;
      }
      case T.PUBLISH: {
        const r = this.protocolVersion === 5 ? It(t, s, n, i) : He(t, s, n, i);
        r.qos === 1 && r.packetId > 0 && this._ws.send(Ne(r.packetId));
        const o = new TextDecoder().decode(r.payload);
        this._handleIncoming(r.topic, o);
        break;
      }
    }
  }
  _subscribeRoom() {
    const e = `${this.topicPrefix}/${this.roomCode}`, t = [
      `${e}/announce`,
      `${e}/offer`,
      `${e}/msg/${this.peerId}`
    ];
    this.sharedGroup ? this._subscribe(t.map((s) => `$share/${this.sharedGroup}/${s}`)) : this._subscribe(t);
  }
  _startPing() {
    this._stopPing(), this._pingInterval = setInterval(() => {
      this._ws && this._ws.readyState === WebSocket.OPEN && this._ws.send(Fe());
    }, this.keepalive * 1e3 * 0.75);
  }
  _stopPing() {
    this._pingInterval && (clearInterval(this._pingInterval), this._pingInterval = null);
  }
  _startAnnouncing() {
    this._announce(), this._announceInterval = setInterval(() => this._announce(), 2e3);
  }
  _stopAnnouncing() {
    this._announceInterval && (clearInterval(this._announceInterval), this._announceInterval = null);
  }
  _announce() {
    if (!this.connected || this.remotePeerId) return;
    const e = `${this.topicPrefix}/${this.roomCode}/announce`, t = JSON.stringify({
      from: this.peerId,
      isOfferer: this.isOfferer
    });
    if (this._publish(e, t), this.isOfferer && this._localOfferPayload) {
      const s = `${this.topicPrefix}/${this.roomCode}/offer`, n = JSON.stringify({ from: this.peerId, data: this._localOfferPayload });
      this._publish(s, n);
    }
  }
  _handleIncoming(e, t) {
    let s;
    try {
      s = JSON.parse(t);
    } catch {
      return;
    }
    if (s.from === this.peerId) return;
    const n = `${this.topicPrefix}/${this.roomCode}`;
    e === `${n}/announce` ? this.remotePeerId || (this.isOfferer && !s.isOfferer ? (this.remotePeerId = s.from, this._stopAnnouncing(), this.onMessage && this.onMessage({ type: "peer-joined" })) : !this.isOfferer && s.isOfferer && (this.remotePeerId = s.from, this._stopAnnouncing())) : e === `${n}/offer` ? !this.isOfferer && s.data && (this.remotePeerId || (this.remotePeerId = s.from, this._stopAnnouncing()), s.from === this.remotePeerId && this.onMessage && this.onMessage(s.data)) : e === `${n}/msg/${this.peerId}` && s.data && this.onMessage && (this.remotePeerId || (this.remotePeerId = s.from), this.onMessage(s.data));
  }
}
class L {
  constructor(e = {}) {
    var t;
    this.url = typeof e.server == "string" ? e.server : (t = e.server) == null ? void 0 : t.url, this.roomCode = e.roomCode || null, this.localPeerId = e.localPeerId || null, this.remotePeerId = e.remotePeerId || null, this.transportType = e.transportType || "generic", this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this._ws = null, this._closed = !1;
  }
  connect() {
    return this._closed = !1, new Promise((e, t) => {
      const s = new URL(this.url);
      this.roomCode && s.searchParams.set("room", this.roomCode), this.localPeerId && s.searchParams.set("peer", this.localPeerId), this.remotePeerId && s.searchParams.set("remote", this.remotePeerId), s.searchParams.set("transport", this.transportType), this._ws = new WebSocket(s.toString()), this._ws.binaryType = "arraybuffer";
      const n = setTimeout(() => {
        this.connected || (this._ws.close(), t(new Error("ServerRelay: connection timeout")));
      }, 1e4);
      this._ws.onopen = () => {
        clearTimeout(n), this.connected = !0, this.onOpen && this.onOpen(), e();
      }, this._ws.onmessage = (i) => {
        this.onData && this.onData(i.data);
      }, this._ws.onclose = () => {
        clearTimeout(n), this.connected = !1, !this._closed && this.onClose && this.onClose();
      }, this._ws.onerror = () => {
        clearTimeout(n), this.connected || t(new Error("ServerRelay: connection failed"));
      };
    });
  }
  async send(e) {
    !this._ws || this._ws.readyState !== WebSocket.OPEN || this._ws.send(e);
  }
  close() {
    if (this._closed = !0, this.connected = !1, this._ws) {
      try {
        this._ws.close();
      } catch {
      }
      this._ws = null;
    }
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
}
const Gt = 128 * 1024;
class vt {
  constructor(e = {}) {
    re(this, "_fragAssembly", /* @__PURE__ */ new Map());
    this.brokerUrl = e.brokerUrl, this.roomCode = e.roomCode, this.localPeerId = e.localPeerId, this.remotePeerId = e.remotePeerId, this.username = e.username || null, this.password = e.password || null, this.qos = e.qos ?? 1, this.keepalive = e.keepalive ?? 30, this.topicPrefix = e.topicPrefix || "qdp", this.maxPayload = e.maxPayload || Gt, this.protocolVersion = e.protocolVersion || 4, this._topicAlias = e.topicAlias || !1, this._messageExpiry = e.messageExpiry || 0, this._e2e = e.e2e || null, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this._ws = null, this._packetId = 0, this._pingInterval = null, this._closed = !1, this._recvBuf = new Uint8Array(0), this._sendQueue = [], this._clientId = "qdp-t-" + Array.from(crypto.getRandomValues(new Uint8Array(6))).map((t) => t.toString(16).padStart(2, "0")).join(""), this._outboundAliasSet = !1, this._inboundAliases = /* @__PURE__ */ new Map(), this._serverTopicAliasMax = 0;
  }
  get _sendTopic() {
    return `${this.topicPrefix}/${this.roomCode}/data/${this.remotePeerId}`;
  }
  get _recvTopic() {
    return `${this.topicPrefix}/${this.roomCode}/data/${this.localPeerId}`;
  }
  connect() {
    if (this._serverConfig) return this._connectServer();
    if (!this.brokerUrl) throw new Error("MQTTTransport: brokerUrl is required");
    if (!this.remotePeerId) throw new Error("MQTTTransport: remotePeerId is required");
    this._closed = !1, this._ws = new WebSocket(this.brokerUrl, ["mqtt"]), this._ws.binaryType = "arraybuffer", this._ws.onopen = () => {
      if (this.protocolVersion === 5) {
        const e = {};
        this._topicAlias && (e[j.TOPIC_ALIAS_MAX] = 10), this._ws.send(bt(this._clientId, this.username, this.password, this.keepalive, e));
      } else
        this._ws.send(Me(this._clientId, this.username, this.password, this.keepalive));
    }, this._ws.onmessage = (e) => {
      const t = new Uint8Array(e.data), s = new Uint8Array(this._recvBuf.length + t.length);
      s.set(this._recvBuf), s.set(t, this._recvBuf.length), this._recvBuf = s, this._processBuffer();
    }, this._ws.onclose = () => {
      this.connected = !1, this._stopPing(), !this._closed && this.onClose && this.onClose();
    }, this._ws.onerror = () => {
    };
  }
  close() {
    if (this._closed = !0, this._stopPing(), this._relay) {
      this._relay.close(), this._relay = null, this.connected = !1;
      return;
    }
    if (this._ws) {
      try {
        this._ws.readyState === WebSocket.OPEN && this._ws.send(Be()), this._ws.close();
      } catch {
      }
      this._ws = null;
    }
    this.connected = !1;
  }
  async send(e) {
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    let t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e);
    if (this._e2e && this._e2e.ready && (t = await this._e2e.encrypt(t)), !this._ws || this._ws.readyState !== WebSocket.OPEN)
      throw new Error("MQTTTransport: not connected");
    if (t.length <= this.maxPayload)
      this._publishBinary(this._sendTopic, t);
    else {
      const s = this.maxPayload - 5, n = Math.ceil(t.length / s);
      for (let i = 0; i < n; i++) {
        const r = i * s, o = t.slice(r, r + s), a = new Uint8Array(5 + o.length);
        a[0] = 255, a[1] = i >> 8 & 255, a[2] = i & 255, a[3] = n >> 8 & 255, a[4] = n & 255, a.set(o, 5), this._publishBinary(this._sendTopic, a);
      }
    }
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
  _nextPacketId() {
    return this._packetId = this._packetId + 1 & 65535, this._packetId === 0 && (this._packetId = 1), this._packetId;
  }
  _publishBinary(e, t) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const s = this.qos > 0 ? this._nextPacketId() : 0;
    if (this.protocolVersion === 5) {
      const n = {};
      if (this._messageExpiry > 0 && (n[j.MESSAGE_EXPIRY] = this._messageExpiry), this._topicAlias && this._serverTopicAliasMax > 0) {
        n[j.TOPIC_ALIAS] = 1;
        const i = this._outboundAliasSet ? "" : e;
        this._outboundAliasSet = !0, this._ws.send(Oe(i, t, this.qos, s, n));
      } else
        this._ws.send(Oe(e, t, this.qos, s, n));
    } else
      this._ws.send(Le(e, t, this.qos, s));
  }
  _subscribe(e) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const t = this._nextPacketId();
    this.protocolVersion === 5 ? this._ws.send(Ct(t, e, this.qos, {})) : this._ws.send(qe(t, e, this.qos));
  }
  _processBuffer() {
    for (; this._recvBuf.length >= 2; ) {
      const e = We(this._recvBuf);
      if (!e) break;
      this._recvBuf = this._recvBuf.slice(e.totalLen), this._handlePacket(e);
    }
  }
  _handlePacket(e) {
    switch (e.type) {
      case T.CONNACK: {
        let t;
        if (this.protocolVersion === 5) {
          const s = St(e.data, e.payloadStart, e.remainingLen);
          t = s.reasonCode, this._serverTopicAliasMax = s.props[j.TOPIC_ALIAS_MAX] || 0;
        } else
          t = e.data[e.payloadStart + 1];
        t === 0 ? (this.connected = !0, this._startPing(), this._subscribe([this._recvTopic]), this._flushQueue(), this.onOpen && this.onOpen()) : (this.close(), this.onClose && this.onClose());
        break;
      }
      case T.PUBLISH: {
        let t;
        if (this.protocolVersion === 5) {
          if (t = It(e.firstByte, e.data, e.payloadStart, e.remainingLen), t.props[j.TOPIC_ALIAS]) {
            const s = t.props[j.TOPIC_ALIAS];
            t.topic ? this._inboundAliases.set(s, t.topic) : t.topic = this._inboundAliases.get(s) || "";
          }
        } else
          t = He(e.firstByte, e.data, e.payloadStart, e.remainingLen);
        t.qos === 1 && t.packetId > 0 && this._ws.send(Ne(t.packetId)), t.topic === this._recvTopic && this._handleData(t.payload);
        break;
      }
    }
  }
  _handleData(e) {
    if (e.length > 5 && e[0] === 255) {
      const t = e[1] << 8 | e[2], s = e[3] << 8 | e[4], n = e.slice(5);
      this._handleFragment(t, s, n);
    } else {
      const t = e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength);
      this._e2e && this._e2e.ready ? this._e2e.decrypt(t).then((s) => {
        this.onData && this.onData(s);
      }).catch(() => {
      }) : this.onData && this.onData(t);
    }
  }
  _handleFragment(e, t, s) {
    const n = t;
    this._fragAssembly.has(n) || this._fragAssembly.set(n, { totalFrags: t, received: /* @__PURE__ */ new Map() });
    const i = this._fragAssembly.get(n);
    if (i.received.set(e, s), i.received.size === i.totalFrags) {
      let r = 0;
      for (let l = 0; l < i.totalFrags; l++) r += i.received.get(l).length;
      const o = new Uint8Array(r);
      let a = 0;
      for (let l = 0; l < i.totalFrags; l++) {
        const d = i.received.get(l);
        o.set(d, a), a += d.length;
      }
      this._fragAssembly.delete(n);
      const h = o.buffer;
      this._e2e && this._e2e.ready ? this._e2e.decrypt(h).then((l) => {
        this.onData && this.onData(l);
      }).catch(() => {
      }) : this.onData && this.onData(h);
    }
  }
  _flushQueue() {
    for (const e of this._sendQueue)
      this.send(e).catch(() => {
      });
    this._sendQueue = [];
  }
  _startPing() {
    this._stopPing(), this._pingInterval = setInterval(() => {
      this._ws && this._ws.readyState === WebSocket.OPEN && this._ws.send(Fe());
    }, this.keepalive * 1e3 * 0.75);
  }
  _stopPing() {
    this._pingInterval && (clearInterval(this._pingInterval), this._pingInterval = null);
  }
  _connectServer() {
    this._closed = !1, this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "mqtt",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, !this._closed && this.onClose && this.onClose();
      }
    }), this._relay.connect().catch(() => {
      this.connected = !1, this.onClose && this.onClose();
    });
  }
}
class Jt {
  constructor(e = []) {
    var t;
    this._backends = e, this._winner = null, this._settled = !1, this._signalingDone = !1, this.onMessage = null, this.onOpen = null, this.onClose = null, this.connected = !1, this.remotePeerId = null, this.peerId = ((t = e[0]) == null ? void 0 : t.peerId) || null, this._stats = e.map((s, n) => ({
      index: n,
      type: s.constructor.name,
      opened: !1,
      won: !1,
      latencyMs: null,
      startTime: 0
    }));
  }
  get sockets() {
    if (this._winner) return this._winner.sockets || [];
    const e = [];
    for (const t of this._backends)
      t.sockets && e.push(...t.sockets);
    return e;
  }
  connect() {
    for (let e = 0; e < this._backends.length; e++) {
      const t = this._backends[e], s = this._stats[e];
      s.startTime = performance.now(), t.onOpen = () => {
        s.opened = !0, s.latencyMs = performance.now() - s.startTime, this._checkOpen();
      }, t.onMessage = (n) => {
        this._onBackendMessage(e, n);
      }, t.onClose = () => {
        this._winner === t && (this.connected = !1, this.onClose && this.onClose());
      }, t.connect();
    }
  }
  close() {
    for (const e of this._backends)
      try {
        e.close();
      } catch {
      }
    this._winner = null, this._settled = !1, this._signalingDone = !1, this.connected = !1;
  }
  send(e) {
    if (this._winner) {
      this._winner.send(e);
      return;
    }
    for (const t of this._backends)
      if (t.connected)
        try {
          t.send(e);
        } catch {
        }
  }
  getSignalStats() {
    return this._stats.map((e) => ({ ...e }));
  }
  _checkOpen() {
    if (!this.connected) {
      for (const e of this._backends)
        if (e.connected) {
          this.connected = !0, this.onOpen && this.onOpen();
          return;
        }
    }
  }
  _onBackendMessage(e, t) {
    if (!(this._signalingDone && this._winner !== this._backends[e])) {
      if (!this._settled && this._isSignalingCompletion(t)) {
        this._settled = !0, this._winner = this._backends[e], this._stats[e].won = !0, this.remotePeerId = this._winner.remotePeerId, this.peerId = this._winner.peerId, this._signalingDone = !0;
        for (let s = 0; s < this._backends.length; s++)
          if (s !== e)
            try {
              this._backends[s].close();
            } catch {
            }
      }
      (!this._signalingDone || this._winner === this._backends[e]) && (this.remotePeerId = this._backends[e].remotePeerId, this.peerId = this._backends[e].peerId, this.onMessage && this.onMessage(t));
    }
  }
  _isSignalingCompletion(e) {
    return e && (e.type === "answer" || e.type === "offer");
  }
}
class st {
  constructor() {
    this._keyPair = null, this._sharedKey = null;
  }
  async init() {
    return this._keyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      !0,
      ["deriveBits"]
    ), this;
  }
  async getPublicKey() {
    const e = await crypto.subtle.exportKey("raw", this._keyPair.publicKey);
    return new Uint8Array(e);
  }
  async deriveSharedKey(e) {
    const t = await crypto.subtle.importKey(
      "raw",
      e,
      { name: "ECDH", namedCurve: "P-256" },
      !1,
      []
    ), s = await crypto.subtle.deriveBits(
      { name: "ECDH", public: t },
      this._keyPair.privateKey,
      256
    );
    this._sharedKey = await crypto.subtle.importKey(
      "raw",
      s,
      { name: "AES-GCM" },
      !1,
      ["encrypt", "decrypt"]
    );
  }
  get ready() {
    return !!this._sharedKey;
  }
  async encrypt(e) {
    if (!this._sharedKey) throw new Error("E2E: shared key not derived");
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e), s = crypto.getRandomValues(new Uint8Array(12)), n = await crypto.subtle.encrypt({ name: "AES-GCM", iv: s }, this._sharedKey, t), i = new Uint8Array(12 + n.byteLength);
    return i.set(s, 0), i.set(new Uint8Array(n), 12), i;
  }
  async decrypt(e) {
    if (!this._sharedKey) throw new Error("E2E: shared key not derived");
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e), s = t.slice(0, 12), n = t.slice(12);
    return await crypto.subtle.decrypt({ name: "AES-GCM", iv: s }, this._sharedKey, n);
  }
}
class zt {
  constructor(e = {}) {
    this.url = e.url, this.roomCode = e.roomCode, this.localPeerId = e.localPeerId, this.remotePeerId = e.remotePeerId, this.reliable = e.reliable ?? !1, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this._transport = null, this._writer = null, this._datagramWriter = null, this._closed = !1, this._stream = null;
  }
  async connect() {
    if (this._serverConfig) return this._connectServer();
    if (!this.url) throw new Error("WebTransportTransport: url is required");
    this._closed = !1;
    const e = new URL(this.url);
    e.searchParams.set("room", this.roomCode), e.searchParams.set("peer", this.localPeerId), e.searchParams.set("remote", this.remotePeerId), this._transport = new WebTransport(e.toString()), this._transport.closed.then(() => {
      this.connected = !1, !this._closed && this.onClose && this.onClose();
    }).catch(() => {
      this.connected = !1, !this._closed && this.onClose && this.onClose();
    }), await this._transport.ready, this.connected = !0, this.reliable ? (this._stream = await this._transport.createBidirectionalStream(), this._writer = this._stream.writable.getWriter(), this._readStream(this._stream.readable)) : (this._datagramWriter = this._transport.datagrams.writable.getWriter(), this._readDatagrams()), this._readIncomingStreams(), this.onOpen && this.onOpen();
  }
  async send(e) {
    if (!this.connected) throw new Error("WebTransportTransport: not connected");
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e);
    if (this.reliable && this._writer) {
      const s = new Uint8Array(4 + t.length);
      new DataView(s.buffer).setUint32(0, t.length), s.set(t, 4), await this._writer.write(s);
    } else this._datagramWriter && await this._datagramWriter.write(t);
  }
  close() {
    if (this._closed = !0, this.connected = !1, this._relay) {
      this._relay.close(), this._relay = null;
      return;
    }
    if (this._writer) {
      try {
        this._writer.close();
      } catch {
      }
      this._writer = null;
    }
    if (this._datagramWriter) {
      try {
        this._datagramWriter.close();
      } catch {
      }
      this._datagramWriter = null;
    }
    if (this._transport) {
      try {
        this._transport.close();
      } catch {
      }
      this._transport = null;
    }
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
  async _readDatagrams() {
    try {
      const e = this._transport.datagrams.readable.getReader();
      for (; ; ) {
        const { value: t, done: s } = await e.read();
        if (s) break;
        this.onData && this.onData(t.buffer);
      }
    } catch {
    }
  }
  async _readStream(e) {
    try {
      const t = e.getReader();
      let s = new Uint8Array(0);
      for (; ; ) {
        const { value: n, done: i } = await t.read();
        if (i) break;
        const r = new Uint8Array(s.length + n.length);
        for (r.set(s), r.set(n, s.length), s = r; s.length >= 4; ) {
          const o = new DataView(s.buffer, s.byteOffset).getUint32(0);
          if (s.length < 4 + o) break;
          const a = s.slice(4, 4 + o);
          s = s.slice(4 + o), this.onData && this.onData(a.buffer);
        }
      }
    } catch {
    }
  }
  async _readIncomingStreams() {
    try {
      const e = this._transport.incomingBidirectionalStreams.getReader();
      for (; ; ) {
        const { value: t, done: s } = await e.read();
        if (s) break;
        this._readStream(t.readable);
      }
    } catch {
    }
  }
  async _connectServer() {
    this._closed = !1, this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "webtransport",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, !this._closed && this.onClose && this.onClose();
      }
    }), await this._relay.connect();
  }
}
class Xt {
  constructor(e, t, s = []) {
    this.roomCode = e, this.isOfferer = t, this.dhtNodes = s, this.peerId = "qdp-dht-" + Array.from(crypto.getRandomValues(new Uint8Array(8))).map((n) => n.toString(16).padStart(2, "0")).join(""), this.remotePeerId = null, this.connected = !1, this.onMessage = null, this.onOpen = null, this.onClose = null, this._sockets = [], this._closed = !1, this._lookupInterval = null, this._keyHash = null, this._localPayload = null;
  }
  get sockets() {
    return this._sockets.filter((e) => e.readyState === WebSocket.OPEN);
  }
  async connect() {
    if (this.dhtNodes.length === 0) throw new Error("DHTSignal: no bootstrap nodes");
    this._closed = !1, this._keyHash = await this._hashKey(this.roomCode);
    let e = 0;
    this.dhtNodes.forEach((t) => {
      const s = new WebSocket(t);
      s.binaryType = "arraybuffer", this._sockets.push(s), s.onopen = () => {
        e++, this._sendDHT(s, {
          action: "join",
          peerId: this.peerId,
          key: this._keyHash
        }), e === 1 && (this.connected = !0, this.onOpen && this.onOpen(), this._startLookup());
      }, s.onmessage = (n) => {
        this._handleMessage(n.data);
      }, s.onclose = () => {
        !this._closed && this._sockets.every((n) => n.readyState === WebSocket.CLOSED) && (this.connected = !1, this.onClose && this.onClose());
      }, s.onerror = () => {
      };
    });
  }
  close() {
    this._closed = !0, this._stopLookup();
    for (const e of this._sockets)
      try {
        e.close();
      } catch {
      }
    this._sockets = [], this.connected = !1;
  }
  send(e) {
    this.isOfferer && e.type === "offer" && (this._localPayload = e, this._broadcast({
      action: "store",
      key: this._keyHash,
      peerId: this.peerId,
      isOfferer: !0,
      data: e
    })), this.remotePeerId && this._broadcast({
      action: "relay",
      key: this._keyHash,
      from: this.peerId,
      to: this.remotePeerId,
      data: e
    });
  }
  _broadcast(e) {
    const t = JSON.stringify(e);
    for (const s of this._sockets)
      s.readyState === WebSocket.OPEN && s.send(t);
  }
  _sendDHT(e, t) {
    e.readyState === WebSocket.OPEN && e.send(JSON.stringify(t));
  }
  _startLookup() {
    this._lookup(), this._lookupInterval = setInterval(() => this._lookup(), 2e3);
  }
  _stopLookup() {
    this._lookupInterval && (clearInterval(this._lookupInterval), this._lookupInterval = null);
  }
  _lookup() {
    if (this.remotePeerId) return;
    const e = {
      action: "find",
      key: this._keyHash,
      peerId: this.peerId,
      isOfferer: this.isOfferer
    };
    this._broadcast(e), this._localPayload && this._broadcast({
      action: "store",
      key: this._keyHash,
      peerId: this.peerId,
      isOfferer: this.isOfferer,
      data: this._localPayload
    });
  }
  _handleMessage(e) {
    let t;
    try {
      t = JSON.parse(typeof e == "string" ? e : new TextDecoder().decode(e));
    } catch {
      return;
    }
    if (t.from !== this.peerId)
      switch (t.action) {
        case "found":
          if (t.peers)
            for (const s of t.peers)
              s.peerId !== this.peerId && (this.remotePeerId || (this.isOfferer && !s.isOfferer || !this.isOfferer && s.isOfferer) && (this.remotePeerId = s.peerId, this._stopLookup(), s.data && this.onMessage && this.onMessage(s.data), this.isOfferer && this.onMessage && this.onMessage({ type: "peer-joined" })));
          break;
        case "relay":
          t.to === this.peerId && t.data && (this.remotePeerId || (this.remotePeerId = t.from), this._stopLookup(), this.onMessage && this.onMessage(t.data));
          break;
        case "peer-announce":
          t.peerId !== this.peerId && !this.remotePeerId && (this.isOfferer && !t.isOfferer || !this.isOfferer && t.isOfferer) && (this.remotePeerId = t.peerId, this._stopLookup(), this.isOfferer && this.onMessage && this.onMessage({ type: "peer-joined" }));
          break;
      }
  }
  async _hashKey(e) {
    const t = new TextEncoder().encode(e), s = await crypto.subtle.digest("SHA-256", t);
    return Array.from(new Uint8Array(s)).map((n) => n.toString(16).padStart(2, "0")).join("");
  }
}
class Qt {
  constructor(e = {}) {
    this._brokerUrls = e.brokerUrls || [], this._roomCode = e.roomCode, this._localPeerId = e.localPeerId, this._remotePeerId = e.remotePeerId, this._username = e.username || null, this._password = e.password || null, this._qos = e.qos ?? 1, this._keepalive = e.keepalive ?? 30, this._topicPrefix = e.topicPrefix || "qdp", this._maxPayload = e.maxPayload, this._protocolVersion = e.protocolVersion, this._topicAlias = e.topicAlias, this._messageExpiry = e.messageExpiry, this._e2e = e.e2e, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this.onBrokerChange = e.onBrokerChange || null, this._transports = [], this._activeBrokerIndex = -1, this._closed = !1, this._receivedSet = /* @__PURE__ */ new Set(), this._dupCleanupTimer = null;
  }
  get activeBrokerUrl() {
    return this._activeBrokerIndex >= 0 ? this._brokerUrls[this._activeBrokerIndex] : null;
  }
  connect() {
    if (this._brokerUrls.length === 0) throw new Error("MQTTPool: no broker URLs");
    this._closed = !1, this._brokerUrls.forEach((e, t) => {
      const s = new vt({
        brokerUrl: e,
        roomCode: this._roomCode,
        localPeerId: this._localPeerId,
        remotePeerId: this._remotePeerId,
        username: this._username,
        password: this._password,
        qos: this._qos,
        keepalive: this._keepalive,
        topicPrefix: this._topicPrefix,
        maxPayload: this._maxPayload,
        protocolVersion: this._protocolVersion,
        topicAlias: this._topicAlias,
        messageExpiry: this._messageExpiry,
        e2e: this._e2e,
        onData: (n) => this._onTransportData(t, n),
        onOpen: () => this._onTransportOpen(t),
        onClose: () => this._onTransportClose(t)
      });
      this._transports.push({ transport: s, index: t, connected: !1 }), s.connect();
    }), this._dupCleanupTimer = setInterval(() => {
      this._receivedSet.size > 2e3 && this._receivedSet.clear();
    }, 3e4);
  }
  async send(e) {
    const t = this._getActiveTransport();
    if (!t) throw new Error("MQTTPool: no connected broker");
    await t.transport.send(e);
  }
  close() {
    this._closed = !0, this._dupCleanupTimer && (clearInterval(this._dupCleanupTimer), this._dupCleanupTimer = null);
    for (const e of this._transports)
      e.transport.close(), e.connected = !1;
    this._transports = [], this.connected = !1;
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
  _onTransportData(e, t) {
    const s = this._quickHash(t);
    this._receivedSet.has(s) || (this._receivedSet.add(s), this.onData && this.onData(t));
  }
  _onTransportOpen(e) {
    var s;
    this._transports[e].connected = !0;
    const t = this.connected;
    if (this.connected = !0, this._activeBrokerIndex < 0 || !((s = this._transports[this._activeBrokerIndex]) != null && s.connected)) {
      const n = this._activeBrokerIndex;
      this._activeBrokerIndex = e, n >= 0 && this.onBrokerChange && this.onBrokerChange({ from: n, to: e });
    }
    !t && this.onOpen && this.onOpen();
  }
  _onTransportClose(e) {
    if (this._transports[e].connected = !1, this._activeBrokerIndex === e) {
      const t = this._transports.findIndex((s) => s.connected);
      t >= 0 ? (this._activeBrokerIndex = t, this.onBrokerChange && this.onBrokerChange({ from: e, to: t })) : (this._activeBrokerIndex = -1, this.connected = !1, !this._closed && this.onClose && this.onClose());
    }
  }
  _getActiveTransport() {
    var t;
    if (this._activeBrokerIndex >= 0 && ((t = this._transports[this._activeBrokerIndex]) != null && t.connected))
      return this._transports[this._activeBrokerIndex];
    const e = this._transports.find((s) => s.connected);
    return e ? (this._activeBrokerIndex = e.index, e) : null;
  }
  _quickHash(e) {
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e);
    let s = 0;
    const n = Math.max(1, Math.floor(t.length / 32));
    for (let i = 0; i < t.length; i += n)
      s = (s << 5) - s + t[i] | 0;
    return s + ":" + t.length;
  }
}
const D = {
  RELAY: "relay",
  NATIVE_BRIDGE: "native-bridge",
  WASI: "wasi",
  PSEUDO_PING: "pseudo-ping"
}, ue = 8, Pt = 8, Yt = 0, nt = 1400;
function Zt(c) {
  let e = 0;
  for (let t = 0; t < c.length - 1; t += 2)
    e += c[t] << 8 | c[t + 1];
  for (c.length % 2 !== 0 && (e += c[c.length - 1] << 8); e > 65535; ) e = (e & 65535) + (e >> 16);
  return ~e & 65535;
}
function be(c, e, t) {
  const s = new Uint8Array(ue + t.length);
  s[0] = Pt, s[1] = 0, s[2] = 0, s[3] = 0, s[4] = c >> 8 & 255, s[5] = c & 255, s[6] = e >> 8 & 255, s[7] = e & 255, s.set(t, ue);
  const n = Zt(s);
  return s[2] = n >> 8 & 255, s[3] = n & 255, s;
}
function es(c) {
  if (c.length < ue) return null;
  const e = c[0];
  if (e !== Yt && e !== Pt) return null;
  const t = c[4] << 8 | c[5], s = c[6] << 8 | c[7], n = c.slice(ue);
  return { type: e, identifier: t, sequence: s, payload: n };
}
class ts {
  constructor(e = {}) {
    re(this, "_fragAssembly", /* @__PURE__ */ new Map());
    this.targetIp = e.targetIp, this.strategy = e.strategy || D.RELAY, this.relayUrl = e.relayUrl || null, this.nativeBridge = e.nativeBridge || null, this.identifier = e.identifier || Math.random() * 65535 | 0, this.roomCode = e.roomCode || null, this.localPeerId = e.localPeerId || null, this.remotePeerId = e.remotePeerId || null, this.pingInterval = e.pingInterval ?? 1e3, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this.onLatency = e.onLatency || null, this._ws = null, this._sequence = 0, this._closed = !1, this._pseudoPingTimer = null, this._pendingProbes = /* @__PURE__ */ new Map(), this._wasiSocket = null;
  }
  async connect() {
    if (this._serverConfig) return this._connectServer();
    switch (this._closed = !1, this.strategy) {
      case D.RELAY:
        await this._connectRelay();
        break;
      case D.NATIVE_BRIDGE:
        this._connectNativeBridge();
        break;
      case D.WASI:
        await this._connectWasi();
        break;
      case D.PSEUDO_PING:
        this._connectPseudoPing();
        break;
      default:
        throw new Error(`ICMPTransport: unknown strategy "${this.strategy}"`);
    }
  }
  async send(e) {
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    if (!this.connected && this.strategy !== D.PSEUDO_PING)
      throw new Error("ICMPTransport: not connected");
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e);
    switch (this.strategy) {
      case D.RELAY:
        this._sendRelay(t);
        break;
      case D.NATIVE_BRIDGE:
        this._sendNativeBridge(t);
        break;
      case D.WASI:
        this._sendWasi(t);
        break;
      case D.PSEUDO_PING:
        break;
    }
  }
  close() {
    if (this._closed = !0, this.connected = !1, this._relay) {
      this._relay.close(), this._relay = null;
      return;
    }
    if (this._pseudoPingTimer && (clearInterval(this._pseudoPingTimer), this._pseudoPingTimer = null), this._ws) {
      try {
        this._ws.close();
      } catch {
      }
      this._ws = null;
    }
    if (this._wasiSocket) {
      try {
        this._wasiSocket.close();
      } catch {
      }
      this._wasiSocket = null;
    }
    this._pendingProbes.clear();
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
  getLatencyStats() {
    return {
      pendingProbes: this._pendingProbes.size,
      strategy: this.strategy,
      connected: this.connected
    };
  }
  _nextSequence() {
    return this._sequence = this._sequence + 1 & 65535, this._sequence;
  }
  async _connectRelay() {
    if (!this.relayUrl) throw new Error("ICMPTransport: relayUrl required for relay strategy");
    const e = new URL(this.relayUrl);
    return this.roomCode && e.searchParams.set("room", this.roomCode), this.localPeerId && e.searchParams.set("peer", this.localPeerId), this.remotePeerId && e.searchParams.set("remote", this.remotePeerId), this.targetIp && e.searchParams.set("target", this.targetIp), new Promise((t, s) => {
      this._ws = new WebSocket(e.toString()), this._ws.binaryType = "arraybuffer";
      const n = setTimeout(() => {
        this.connected || (this._ws.close(), s(new Error("ICMPTransport: relay connection timeout")));
      }, 1e4);
      this._ws.onopen = () => {
        clearTimeout(n), this.connected = !0;
        const i = JSON.stringify({
          type: "icmp-register",
          targetIp: this.targetIp,
          identifier: this.identifier,
          peerId: this.localPeerId,
          roomCode: this.roomCode
        });
        this._ws.send(i), this.onOpen && this.onOpen(), t();
      }, this._ws.onmessage = (i) => {
        if (typeof i.data == "string")
          this._handleRelayControl(i.data);
        else {
          const r = new Uint8Array(i.data);
          this._handleIncomingPacket(r);
        }
      }, this._ws.onclose = () => {
        clearTimeout(n), this.connected = !1, !this._closed && this.onClose && this.onClose();
      }, this._ws.onerror = () => {
        clearTimeout(n), this.connected || s(new Error("ICMPTransport: relay connection failed"));
      };
    });
  }
  _sendRelay(e) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const t = this._fragment(e);
    for (const s of t) {
      const n = this._nextSequence(), i = be(this.identifier, n, s);
      this._ws.send(i), this._pendingProbes.set(n, performance.now());
    }
  }
  _handleRelayControl(e) {
    try {
      JSON.parse(e).type === "icmp-error" && this.onClose && this.onClose();
    } catch {
    }
  }
  _connectNativeBridge() {
    if (!this.nativeBridge) throw new Error("ICMPTransport: nativeBridge required");
    typeof this.nativeBridge.init == "function" && this.nativeBridge.init({
      targetIp: this.targetIp,
      identifier: this.identifier,
      onData: (e) => {
        const t = new Uint8Array(e);
        this._handleIncomingPacket(t);
      },
      onError: () => {
        this.connected = !1, !this._closed && this.onClose && this.onClose();
      }
    }), this.connected = !0, this.onOpen && this.onOpen();
  }
  _sendNativeBridge(e) {
    if (!this.nativeBridge) return;
    const t = this._fragment(e);
    for (const s of t) {
      const n = this._nextSequence(), i = be(this.identifier, n, s);
      if (typeof this.nativeBridge.sendRaw == "function")
        this.nativeBridge.sendRaw(i.buffer, this.targetIp);
      else if (typeof this.nativeBridge.execute == "function") {
        const r = Array.from(s).map((o) => o.toString(16).padStart(2, "0")).join("");
        this.nativeBridge.execute(`ping -c 1 -s ${s.length} -p ${r} ${this.targetIp}`);
      }
      this._pendingProbes.set(n, performance.now());
    }
  }
  async _connectWasi() {
    if (typeof WebAssembly > "u")
      throw new Error("ICMPTransport: WebAssembly not available");
    if (!(typeof globalThis.__wasi_socket_create == "function"))
      throw new Error("ICMPTransport: WASI socket API not available");
    try {
      this._wasiSocket = globalThis.__wasi_socket_create("icmp", this.targetIp), this.connected = !0, this.onOpen && this.onOpen(), this._wasiReadLoop();
    } catch (t) {
      throw new Error("ICMPTransport: WASI socket creation failed: " + t.message);
    }
  }
  _sendWasi(e) {
    if (!this._wasiSocket) return;
    const t = this._fragment(e);
    for (const s of t) {
      const n = this._nextSequence(), i = be(this.identifier, n, s);
      this._wasiSocket.send(i.buffer), this._pendingProbes.set(n, performance.now());
    }
  }
  async _wasiReadLoop() {
    for (; !this._closed && this._wasiSocket; )
      try {
        const e = await this._wasiSocket.recv();
        e && this._handleIncomingPacket(new Uint8Array(e));
      } catch {
        break;
      }
  }
  _connectPseudoPing() {
    this.connected = !0, this.onOpen && this.onOpen(), this._pseudoPingTimer = setInterval(() => {
      this._sendPseudoPing();
    }, this.pingInterval);
  }
  _sendPseudoPing() {
    if (!this.targetIp) return;
    const e = performance.now(), t = new Image(), s = 1 + Math.floor(Math.random() * 65534), n = () => {
      t.onload = null, t.onerror = null;
    };
    t.onload = () => {
      n();
      const i = performance.now() - e;
      this.onLatency && this.onLatency({ target: this.targetIp, latency: i, reachable: !0 });
    }, t.onerror = () => {
      n();
      const i = performance.now() - e;
      this.onLatency && this.onLatency({ target: this.targetIp, latency: i, reachable: i < 1e3 });
    }, t.src = `http://${this.targetIp}:${s}/__qdp_ping?t=${Date.now()}`;
  }
  _handleIncomingPacket(e) {
    const t = es(e);
    if (!t) {
      this.onData && this.onData(e.buffer);
      return;
    }
    if (t.identifier !== this.identifier) return;
    const s = this._pendingProbes.get(t.sequence);
    if (s) {
      const n = performance.now() - s;
      this._pendingProbes.delete(t.sequence), this.onLatency && this.onLatency({ target: this.targetIp, latency: n, reachable: !0 });
    }
    t.payload.length > 0 && (t.payload.length > 5 && t.payload[0] === 254 ? this._handleDataFragment(t.payload) : this.onData && this.onData(t.payload.buffer));
  }
  _fragment(e) {
    if (e.length <= nt)
      return [e];
    const t = nt - 5, s = Math.ceil(e.length / t), n = [];
    for (let i = 0; i < s; i++) {
      const r = i * t, o = e.slice(r, r + t), a = new Uint8Array(5 + o.length);
      a[0] = 254, a[1] = i >> 8 & 255, a[2] = i & 255, a[3] = s >> 8 & 255, a[4] = s & 255, a.set(o, 5), n.push(a);
    }
    return n;
  }
  _handleDataFragment(e) {
    const t = e[1] << 8 | e[2], s = e[3] << 8 | e[4], n = e.slice(5), i = s;
    this._fragAssembly.has(i) || this._fragAssembly.set(i, { totalFrags: s, received: /* @__PURE__ */ new Map() });
    const r = this._fragAssembly.get(i);
    if (r.received.set(t, n), r.received.size === r.totalFrags) {
      let o = 0;
      for (let l = 0; l < r.totalFrags; l++) o += r.received.get(l).length;
      const a = new Uint8Array(o);
      let h = 0;
      for (let l = 0; l < r.totalFrags; l++) {
        const d = r.received.get(l);
        a.set(d, h), h += d.length;
      }
      this._fragAssembly.delete(i), this.onData && this.onData(a.buffer);
    }
  }
  async _connectServer() {
    this._closed = !1, this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "icmp",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, !this._closed && this.onClose && this.onClose();
      }
    }), await this._relay.connect();
  }
}
const V = 4, it = 215, rt = 1200;
class ss {
  constructor(e = {}) {
    this.iceServers = e.iceServers || [{ urls: "stun:stun.l.google.com:19302" }], this.roomCode = e.roomCode || null, this.localPeerId = e.localPeerId || null, this.remotePeerId = e.remotePeerId || null, this.signaling = e.signaling || null, this.sampleRate = e.sampleRate || 48e3, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this.onLatency = e.onLatency || null, this._pc = null, this._sender = null, this._closed = !1, this._sequence = 0, this._audioCtx = null, this._sourceNode = null, this._scriptNode = null, this._sendQueue = [], this._fragAssembly = /* @__PURE__ */ new Map(), this._isOfferer = !1;
  }
  async connect(e = !1) {
    if (this._serverConfig) return this._connectServer();
    this._closed = !1, this._isOfferer = e, this._pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      bundlePolicy: "max-bundle"
    }), this._pc.onicecandidate = (r) => {
      r.candidate && this.signaling && this.signaling.send({
        type: "srtp-ice",
        candidate: r.candidate,
        peerId: this.localPeerId
      });
    }, this._pc.onconnectionstatechange = () => {
      if (!this._pc) return;
      const r = this._pc.connectionState;
      r === "connected" ? (this.connected = !0, this.onOpen && this.onOpen()) : (r === "disconnected" || r === "failed" || r === "closed") && (this.connected = !1, !this._closed && this.onClose && this.onClose());
    }, this._audioCtx = new (globalThis.AudioContext || globalThis.webkitAudioContext)({
      sampleRate: this.sampleRate
    });
    const t = this._audioCtx.createOscillator(), s = this._audioCtx.createGain();
    s.gain.value = 0, t.connect(s);
    const n = this._audioCtx.createMediaStreamDestination();
    s.connect(n), t.start();
    const i = n.stream.getAudioTracks()[0];
    if (this._sender = this._pc.addTrack(i, n.stream), this._pc.ontrack = (r) => {
      this._setupReceiver(r.streams[0] || new MediaStream([r.track]));
    }, this._sender.transform !== void 0 && this._setupEncodedTransform(), e) {
      const r = await this._pc.createOffer();
      await this._pc.setLocalDescription(r), this.signaling && this.signaling.send({
        type: "srtp-offer",
        sdp: this._pc.localDescription,
        peerId: this.localPeerId
      });
    }
  }
  async handleSignalingMessage(e) {
    if (this._pc)
      switch (e.type) {
        case "srtp-offer": {
          await this._pc.setRemoteDescription(new RTCSessionDescription(e.sdp));
          const t = await this._pc.createAnswer();
          await this._pc.setLocalDescription(t), this.signaling && this.signaling.send({
            type: "srtp-answer",
            sdp: this._pc.localDescription,
            peerId: this.localPeerId
          });
          break;
        }
        case "srtp-answer": {
          await this._pc.setRemoteDescription(new RTCSessionDescription(e.sdp));
          break;
        }
        case "srtp-ice": {
          await this._pc.addIceCandidate(new RTCIceCandidate(e.candidate));
          break;
        }
      }
  }
  async send(e) {
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    if (!this.connected) throw new Error("SRTPTransport: not connected");
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e), s = this._fragment(t);
    for (const n of s)
      this._sendQueue.push(n);
  }
  close() {
    if (this._closed = !0, this.connected = !1, this._relay) {
      this._relay.close(), this._relay = null;
      return;
    }
    if (this._sendQueue = [], this._fragAssembly.clear(), this._scriptNode) {
      try {
        this._scriptNode.disconnect();
      } catch {
      }
      this._scriptNode = null;
    }
    if (this._sourceNode) {
      try {
        this._sourceNode.disconnect();
      } catch {
      }
      this._sourceNode = null;
    }
    if (this._audioCtx) {
      try {
        this._audioCtx.close();
      } catch {
      }
      this._audioCtx = null;
    }
    if (this._pc) {
      try {
        this._pc.close();
      } catch {
      }
      this._pc = null;
    }
    this._sender = null;
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
  _nextSequence() {
    return this._sequence = this._sequence + 1 & 65535, this._sequence;
  }
  _setupEncodedTransform() {
    var i, r, o, a, h, l;
    if (!this._sender) return;
    const e = this._sender.readable || ((o = (r = (i = this._sender).createEncodedStreams) == null ? void 0 : r.call(i)) == null ? void 0 : o.readable), t = this._sender.writable || ((l = (h = (a = this._sender).createEncodedStreams) == null ? void 0 : h.call(a)) == null ? void 0 : l.writable);
    if (!e || !t) return;
    const s = this._sendQueue, n = new TransformStream({
      transform(d, f) {
        if (s.length > 0) {
          const u = s.shift(), _ = new ArrayBuffer(V + u.length), p = new DataView(_);
          p.setUint8(0, it), p.setUint8(1, 1), p.setUint16(2, u.length), new Uint8Array(_, V).set(u), d.data = _;
        }
        f.enqueue(d);
      }
    });
    e.pipeThrough(n).pipeTo(t).catch(() => {
    });
  }
  _setupReceiver(e) {
    var n, i, r, o;
    if (!this._audioCtx) return;
    const t = this._pc.getReceivers();
    for (const a of t) {
      if (a.track.kind !== "audio") continue;
      const h = a.readable || ((i = (n = a.createEncodedStreams) == null ? void 0 : n.call(a)) == null ? void 0 : i.readable), l = a.writable || ((o = (r = a.createEncodedStreams) == null ? void 0 : r.call(a)) == null ? void 0 : o.writable);
      if (h && l) {
        const d = this, f = new TransformStream({
          transform(u, _) {
            const p = new Uint8Array(u.data);
            if (p.length >= V && p[0] === it && p[1] === 1) {
              const w = p[2] << 8 | p[3];
              if (p.length >= V + w) {
                const g = p.slice(V, V + w);
                d._handleIncoming(g);
              }
            }
            _.enqueue(u);
          }
        });
        h.pipeThrough(f).pipeTo(l).catch(() => {
        });
        return;
      }
    }
    this._sourceNode = this._audioCtx.createMediaStreamSource(e);
    const s = 2048;
    this._scriptNode = this._audioCtx.createScriptProcessor(s, 1, 1), this._scriptNode.onaudioprocess = (a) => {
      const h = a.inputBuffer.getChannelData(0);
      a.outputBuffer.getChannelData(0).set(h);
    }, this._sourceNode.connect(this._scriptNode), this._scriptNode.connect(this._audioCtx.destination);
  }
  _handleIncoming(e) {
    if (e.length > 5 && e[0] === 253) {
      const t = e[1] << 8 | e[2], s = e[3] << 8 | e[4], n = e.slice(5);
      this._reassemble(t, s, n);
    } else
      this.onData && this.onData(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  }
  _fragment(e) {
    if (e.length <= rt)
      return [e];
    const t = rt - 5, s = Math.ceil(e.length / t), n = [];
    for (let i = 0; i < s; i++) {
      const r = i * t, o = e.slice(r, r + t), a = new Uint8Array(5 + o.length);
      a[0] = 253, a[1] = i >> 8 & 255, a[2] = i & 255, a[3] = s >> 8 & 255, a[4] = s & 255, a.set(o, 5), n.push(a);
    }
    return n;
  }
  _reassemble(e, t, s) {
    const n = t;
    this._fragAssembly.has(n) || this._fragAssembly.set(n, { totalFrags: t, received: /* @__PURE__ */ new Map() });
    const i = this._fragAssembly.get(n);
    if (i.received.set(e, s), i.received.size === i.totalFrags) {
      let r = 0;
      for (let h = 0; h < i.totalFrags; h++) r += i.received.get(h).length;
      const o = new Uint8Array(r);
      let a = 0;
      for (let h = 0; h < i.totalFrags; h++) {
        const l = i.received.get(h);
        o.set(l, a), a += l.length;
      }
      this._fragAssembly.delete(n), this.onData && this.onData(o.buffer);
    }
  }
  async _connectServer() {
    this._closed = !1, this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "srtp",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, !this._closed && this.onClose && this.onClose();
      }
    }), await this._relay.connect();
  }
}
class Tt {
  constructor({ probeIntervalMs: e = 2e3, emaAlpha: t = 0.3 } = {}) {
    this.probeIntervalMs = e, this.emaAlpha = t, this.links = /* @__PURE__ */ new Map(), this._probeTimer = null, this._onQualityUpdate = null;
  }
  addLink(e) {
    this.links.set(e, {
      id: e,
      latency: 0,
      throughput: 0,
      packetLoss: 0,
      score: 1,
      lastProbeTime: 0,
      probesSent: 0,
      probesReceived: 0,
      bytesSent: 0,
      bytesInWindow: 0,
      windowStart: performance.now()
    });
  }
  removeLink(e) {
    this.links.delete(e);
  }
  recordProbeSent(e) {
    const t = this.links.get(e);
    t && (t.probesSent++, t.lastProbeTime = performance.now());
  }
  recordProbeResponse(e, t) {
    const s = this.links.get(e);
    s && (s.probesReceived++, s.latency = this._ema(s.latency, t), this._recalcScore(s));
  }
  recordBytesSent(e, t) {
    const s = this.links.get(e);
    s && (s.bytesSent += t, s.bytesInWindow += t);
  }
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
  updatePacketLoss() {
    for (const e of this.links.values())
      if (e.probesSent > 0) {
        const t = 1 - e.probesReceived / e.probesSent;
        e.packetLoss = this._ema(e.packetLoss, Math.max(0, t)), this._recalcScore(e);
      }
  }
  getScores() {
    return new Map(this.links);
  }
  getRankedLinks() {
    return [...this.links.values()].sort((e, t) => t.score - e.score).map((e) => e.id);
  }
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
  onQualityUpdate(e) {
    this._onQualityUpdate = e;
  }
  start() {
    this._probeTimer = setInterval(() => {
      this.updateThroughput(), this.updatePacketLoss(), this._onQualityUpdate && this._onQualityUpdate(this.getScores());
    }, this.probeIntervalMs);
  }
  stop() {
    this._probeTimer && (clearInterval(this._probeTimer), this._probeTimer = null);
  }
  _ema(e, t) {
    return e === 0 ? t : this.emaAlpha * t + (1 - this.emaAlpha) * e;
  }
  _recalcScore(e) {
    const t = 1 / (1 + e.latency / 100), s = 1 - e.packetLoss, n = Math.min(1, Math.log10(1 + e.throughput / 1e4) / 4);
    e.score = Math.max(0.01, t * 0.4 + s * 0.35 + n * 0.25);
  }
}
class ns {
  constructor({ senders: e = [], linkIds: t = [], monitor: s = null } = {}) {
    this.senders = e, this.linkIds = t, this.monitor = s || new Tt();
    for (const n of this.linkIds)
      this.monitor.links.has(n) || this.monitor.addLink(n);
    this._wrr = {
      weights: /* @__PURE__ */ new Map(),
      counters: /* @__PURE__ */ new Map()
    }, this._reassembly = /* @__PURE__ */ new Map(), this._onComplete = null, this._onChunkReceived = null, this._onProgress = null;
  }
  onComplete(e) {
    this._onComplete = e;
  }
  onChunkReceived(e) {
    this._onChunkReceived = e;
  }
  onProgress(e) {
    this._onProgress = e;
  }
  updatePaths(e, t) {
    this.senders = e, this.linkIds = t;
    for (const s of t)
      this.monitor.links.has(s) || this.monitor.addLink(s);
  }
  async sendChunks(e) {
    if (this.senders.length === 0)
      throw new Error("BondingEngine: no senders available");
    this._refreshWeights();
    const t = this._buildSendPlan(e.length), s = [];
    for (let n = 0; n < e.length; n++) {
      const i = t[n], r = e[n], o = this.linkIds[i];
      s.push(
        this.senders[i](r).then(() => {
          this.monitor.recordBytesSent(o, r.byteLength);
        })
      );
    }
    await Promise.all(s);
  }
  async sendSingle(e) {
    if (this.senders.length === 1) {
      await this.senders[0](e), this.monitor.recordBytesSent(this.linkIds[0], e.byteLength);
      return;
    }
    this._rrSingleIdx || (this._rrSingleIdx = 0), this._rrSingleIdx = (this._rrSingleIdx + 1) % this.senders.length;
    const t = this._rrSingleIdx;
    await this.senders[t](e), this.monitor.recordBytesSent(this.linkIds[t], e.byteLength);
  }
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
      const o = this._assemble(r);
      this._reassembly.delete(t), this._onComplete && this._onComplete({ transferId: t, data: o });
    }
  }
  _refreshWeights() {
    this._wrr.weights = this.monitor.getWeights();
    for (const e of this.linkIds)
      this._wrr.counters.has(e) || this._wrr.counters.set(e, 0);
  }
  _buildSendPlan(e) {
    const t = new Array(e), s = this._wrr.weights, n = /* @__PURE__ */ new Map();
    let i = 0;
    for (let a = 0; a < this.linkIds.length; a++) {
      const h = this.linkIds[a], l = s.get(h) || 1 / this.linkIds.length, d = Math.round(l * e);
      n.set(a, d), i += d;
    }
    if (i < e) {
      const a = this._pickBestSender();
      n.set(a, (n.get(a) || 0) + (e - i));
    } else if (i > e)
      for (let a = this.linkIds.length - 1; a >= 0 && i > e; a--) {
        const h = n.get(a) || 0, l = Math.min(h, i - e);
        n.set(a, h - l), i -= l;
      }
    let r = 0;
    const o = new Map(n);
    for (; r < e; )
      for (let a = 0; a < this.linkIds.length && r < e; a++) {
        const h = o.get(a) || 0;
        h > 0 && (t[r++] = a, o.set(a, h - 1));
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
const _e = 13, kt = 64 * 1024, z = {
  DATA: 1,
  ACK: 2,
  FIN: 4,
  PROBE: 8,
  META: 16
};
function je({ transferId: c, chunkIndex: e, totalChunks: t, flags: s, payload: n }) {
  const i = n ? n instanceof Uint8Array ? n : new Uint8Array(n) : new Uint8Array(0), r = new ArrayBuffer(_e + i.byteLength), o = new DataView(r);
  return o.setUint32(0, c, !0), o.setUint32(4, e, !0), o.setUint32(8, t, !0), o.setUint8(12, s), i.byteLength > 0 && new Uint8Array(r, _e).set(i), r;
}
function is(c) {
  const e = new DataView(c);
  return {
    transferId: e.getUint32(0, !0),
    chunkIndex: e.getUint32(4, !0),
    totalChunks: e.getUint32(8, !0),
    flags: e.getUint8(12),
    payload: c.byteLength > _e ? new Uint8Array(c, _e) : null
  };
}
function ot(c, e, t = kt) {
  const s = new Uint8Array(c), n = Math.ceil(s.byteLength / t), i = [];
  for (let r = 0; r < n; r++) {
    const o = r * t, a = Math.min(o + t, s.byteLength), h = s.slice(o, a);
    i.push(
      je({
        transferId: e,
        chunkIndex: r,
        totalChunks: n,
        flags: z.DATA,
        payload: h
      })
    );
  }
  return i;
}
function rs(c, e) {
  const t = JSON.stringify(e), n = new TextEncoder().encode(t);
  return je({
    transferId: c,
    chunkIndex: 0,
    totalChunks: 0,
    flags: z.META,
    payload: n
  });
}
function os(c) {
  const e = new TextDecoder();
  return JSON.parse(e.decode(c));
}
function at(c) {
  const e = new Uint8Array(8);
  return new DataView(e.buffer).setFloat64(0, c, !0), je({
    transferId: 0,
    chunkIndex: 0,
    totalChunks: 0,
    flags: z.PROBE,
    payload: e
  });
}
function as(c) {
  return new DataView(c.buffer, c.byteOffset, c.byteLength).getFloat64(0, !0);
}
const ct = 1, ht = 2, cs = new TextEncoder(), hs = new TextDecoder();
class ls {
  constructor(e) {
    this._send = e, this._listeners = {};
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
          console.error("Messenger error:", n);
        }
  }
  async send(e) {
    const t = cs.encode(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = ct, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  async sendBinary(e) {
    const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = ht, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === ct) {
      const n = hs.decode(t.slice(1));
      this._emit("text", n);
    } else s === ht && this._emit("binary", e.slice(1));
  }
}
const S = {
  REQUEST: 1,
  RESPONSE: 2,
  BODY: 3,
  END: 4,
  ERROR: 5
}, ne = new TextEncoder(), ee = new TextDecoder();
function ds(c, e, t, s = {}, n = null) {
  const i = ne.encode(e), r = ne.encode(t), o = ne.encode(JSON.stringify(s)), a = n ? new Uint8Array(n) : new Uint8Array(0), h = 6 + i.length + 2 + r.length + 4 + o.length + a.length, l = new ArrayBuffer(h), d = new DataView(l), f = new Uint8Array(l);
  let u = 0;
  return d.setUint8(u, S.REQUEST), u += 1, d.setUint32(u, c, !0), u += 4, d.setUint8(u, i.length), u += 1, f.set(i, u), u += i.length, d.setUint16(u, r.length, !0), u += 2, f.set(r, u), u += r.length, d.setUint32(u, o.length, !0), u += 4, f.set(o, u), u += o.length, a.length > 0 && f.set(a, u), l;
}
function lt(c, e, t = {}) {
  const s = ne.encode(JSON.stringify(t)), n = 11 + s.length, i = new ArrayBuffer(n), r = new DataView(i), o = new Uint8Array(i);
  let a = 0;
  return r.setUint8(a, S.RESPONSE), a += 1, r.setUint32(a, c, !0), a += 4, r.setUint16(a, e, !0), a += 2, r.setUint32(a, s.length, !0), a += 4, o.set(s, a), i;
}
function te(c, e, t) {
  const s = new Uint8Array(t), n = new ArrayBuffer(9 + s.length), i = new DataView(n);
  return new Uint8Array(n).set(s, 9), i.setUint8(0, S.BODY), i.setUint32(1, c, !0), i.setUint32(5, e, !0), n;
}
function dt(c, e = 0) {
  const t = new ArrayBuffer(9), s = new DataView(t);
  return s.setUint8(0, S.END), s.setUint32(1, c, !0), s.setUint32(5, e, !0), t;
}
function Ce(c, e) {
  const t = ne.encode(e), s = new ArrayBuffer(5 + t.length), n = new DataView(s);
  return new Uint8Array(s).set(t, 5), n.setUint8(0, S.ERROR), n.setUint32(1, c, !0), s;
}
function pe(c) {
  const e = new DataView(c), t = new Uint8Array(c), s = e.getUint8(0), n = e.getUint32(1, !0);
  switch (s) {
    case S.REQUEST: {
      let i = 5;
      const r = e.getUint8(i);
      i += 1;
      const o = ee.decode(t.slice(i, i + r));
      i += r;
      const a = e.getUint16(i, !0);
      i += 2;
      const h = ee.decode(t.slice(i, i + a));
      i += a;
      const l = e.getUint32(i, !0);
      i += 4;
      const d = JSON.parse(ee.decode(t.slice(i, i + l)));
      i += l;
      const f = i < c.byteLength ? c.slice(i) : null;
      return { type: s, requestId: n, method: o, url: h, headers: d, body: f };
    }
    case S.RESPONSE: {
      let i = 5;
      const r = e.getUint16(i, !0);
      i += 2;
      const o = e.getUint32(i, !0);
      i += 4;
      const a = JSON.parse(ee.decode(t.slice(i, i + o)));
      return { type: s, requestId: n, status: r, headers: a };
    }
    case S.BODY: {
      const i = e.getUint32(5, !0);
      return { type: s, requestId: n, seqNum: i, data: c.slice(9) };
    }
    case S.END:
      return { type: s, requestId: n, seqCount: c.byteLength >= 9 ? e.getUint32(5, !0) : 0 };
    case S.ERROR:
      return { type: s, requestId: n, message: ee.decode(t.slice(5)) };
    default:
      return { type: s, requestId: n };
  }
}
class fs {
  constructor(e) {
    this._map = {}, this._internal = /* @__PURE__ */ new Set();
    for (const [t, s] of Object.entries(e)) {
      const n = t.toLowerCase();
      this._map[n] = s, n.startsWith("x-speedrtc-") && this._internal.add(n);
    }
  }
  get(e) {
    return this._map[e.toLowerCase()] ?? null;
  }
  has(e) {
    const t = e.toLowerCase();
    return t in this._map && !this._internal.has(t);
  }
  forEach(e) {
    for (const [t, s] of Object.entries(this._map))
      this._internal.has(t) || e(s, t);
  }
  entries() {
    return Object.entries(this._map).filter(([e]) => !this._internal.has(e))[Symbol.iterator]();
  }
  keys() {
    return Object.keys(this._map).filter((e) => !this._internal.has(e))[Symbol.iterator]();
  }
  values() {
    return Object.values(Object.fromEntries(Object.entries(this._map).filter(([e]) => !this._internal.has(e))))[Symbol.iterator]();
  }
  getSetCookie() {
    const e = this._map["set-cookie"];
    return e ? e.split(`
`) : [];
  }
}
let us = 1;
class _s {
  constructor() {
    this._cookies = [];
  }
  store(e, t) {
    if (!t) return;
    const s = Array.isArray(t) ? t : [t], n = this._parseOrigin(e), i = Date.now();
    for (const r of s) {
      const o = r.split(";").map((m) => m.trim()), [a] = o, h = a.indexOf("=");
      if (h < 0) continue;
      const l = a.slice(0, h).trim(), d = a.slice(h + 1).trim();
      let f = n.hostname, u = "/", _ = null, p = !1, w = n.protocol === "https:";
      for (let m = 1; m < o.length; m++) {
        const [W, v = ""] = o[m].split("=").map((q) => q.trim()), b = W.toLowerCase();
        b === "domain" ? f = v.replace(/^\./, "") : b === "path" ? u = v || "/" : b === "expires" ? _ = new Date(v).getTime() : b === "max-age" ? _ = i + parseInt(v, 10) * 1e3 : b === "httponly" ? p = !0 : b === "secure" && (w = !0);
      }
      if (_ !== null && _ < i) {
        this._cookies = this._cookies.filter((m) => !(m.name === l && m.domain === f && m.path === u));
        continue;
      }
      const g = this._cookies.findIndex((m) => m.name === l && m.domain === f && m.path === u), x = { name: l, value: d, domain: f, path: u, expires: _, httpOnly: p, secure: w };
      g >= 0 ? this._cookies[g] = x : this._cookies.push(x);
    }
  }
  get(e) {
    try {
      const { hostname: t, pathname: s, protocol: n } = new URL(e), i = n === "https:", r = Date.now();
      return this._cookies = this._cookies.filter((o) => o.expires === null || o.expires > r), this._cookies.filter((o) => !(o.secure && !i || !t.endsWith(o.domain) && t !== o.domain || !s.startsWith(o.path))).map((o) => `${o.name}=${o.value}`).join("; ") || null;
    } catch {
      return null;
    }
  }
  clear(e) {
    if (e)
      try {
        const { hostname: t } = new URL(e);
        this._cookies = this._cookies.filter((s) => !t.endsWith(s.domain) && t !== s.domain);
      } catch {
      }
    else
      this._cookies = [];
  }
  _parseOrigin(e) {
    try {
      return new URL(e);
    } catch {
      return { hostname: e, protocol: "https:" };
    }
  }
}
class ps {
  constructor(e) {
    this._send = e, this._pending = /* @__PURE__ */ new Map(), this.cookieJar = new _s(), this._intercepted = !1, this._origFetch = null, this._origXhrOpen = null, this._origXhrSend = null, this._interceptTarget = null, this._interceptFilter = null;
  }
  intercept(e = globalThis, t = null) {
    this._intercepted && this.release(), this._interceptTarget = e, this._interceptFilter = t, this._intercepted = !0, e.__speedrtc_proxy_fetch = (i, r) => this.fetch(i, r), this._messageHandler = (i) => {
      if (!i.data || i.data.type !== "speedrtc-fetch" || !i.source) return;
      const { id: r, url: o, method: a, headers: h, body: l } = i.data;
      this.fetch(o, { method: a, headers: h, body: l }).then(async (d) => {
        const f = await d.arrayBuffer(), u = {};
        d.headers.forEach((_, p) => {
          u[p] = _;
        }), i.source.postMessage({
          type: "speedrtc-fetch-res",
          id: r,
          status: d.status,
          statusText: d.statusText,
          headers: u,
          body: f
        }, "*", [f]);
      }).catch((d) => {
        try {
          i.source.postMessage({
            type: "speedrtc-fetch-res",
            id: r,
            error: d.message || "Fetch failed"
          }, "*");
        } catch {
        }
      });
    }, e.addEventListener("message", this._messageHandler), this._origFetch = e.fetch;
    const s = this;
    e.fetch = function(r, o) {
      let a;
      if (r instanceof Request ? a = r.url : a = String(r), s._shouldIntercept(a)) {
        const h = {};
        if (r instanceof Request && (h.method = r.method, h.headers = {}, r.headers.forEach((l, d) => {
          h.headers[d] = l;
        }), h.credentials = r.credentials, h.mode = r.mode, h.redirect = r.redirect, h.referrer = r.referrer, h.referrerPolicy = r.referrerPolicy, r.body && (h.body = r.body)), o && Object.assign(h, o), o != null && o.headers) {
          const l = {};
          if (h.headers)
            for (const [d, f] of Object.entries(h.headers)) l[d] = f;
          if (o.headers instanceof Headers)
            o.headers.forEach((d, f) => {
              l[f] = d;
            });
          else if (Array.isArray(o.headers))
            for (const [d, f] of o.headers) l[d] = f;
          else
            Object.assign(l, o.headers);
          h.headers = l;
        }
        return s.fetch(a, h);
      }
      return s._origFetch.call(e, r, o);
    };
    const n = e.XMLHttpRequest;
    if (n) {
      this._origXhrOpen = n.prototype.open, this._origXhrSend = n.prototype.send;
      const i = this._origXhrOpen, r = this._origXhrSend;
      n.prototype.open = function(a, h, ...l) {
        return this._speedrtcMethod = a, this._speedrtcUrl = String(h), this._speedrtcHeaders = {}, this._speedrtcAsync = l[0] !== !1, i.call(this, a, h, ...l);
      };
      const o = n.prototype.setRequestHeader;
      this._origXhrSetHeader = o, n.prototype.setRequestHeader = function(a, h) {
        return this._speedrtcHeaders && (this._speedrtcHeaders[a] = h), o.call(this, a, h);
      }, n.prototype.send = function(a) {
        const h = this._speedrtcUrl;
        if (h && s._shouldIntercept(h)) {
          const l = this, d = {
            method: this._speedrtcMethod || "GET",
            headers: this._speedrtcHeaders || {}
          };
          a != null && (d.body = a), s.fetch(h, d).then(async (f) => {
            Object.defineProperty(l, "status", { value: f.status, writable: !1, configurable: !0 }), Object.defineProperty(l, "statusText", { value: f.statusText, writable: !1, configurable: !0 });
            const u = await f.text();
            Object.defineProperty(l, "responseText", { value: u, writable: !1, configurable: !0 }), Object.defineProperty(l, "response", { value: u, writable: !1, configurable: !0 }), Object.defineProperty(l, "readyState", { value: 4, writable: !1, configurable: !0 });
            const _ = [];
            f.headers.forEach((p, w) => _.push(`${w}: ${p}`)), Object.defineProperty(l, "_speedrtcRespHeaders", { value: _.join(`\r
`), configurable: !0 }), l.getAllResponseHeaders = () => l._speedrtcRespHeaders, l.getResponseHeader = (p) => f.headers.get(p), l.onreadystatechange && l.onreadystatechange(new Event("readystatechange")), l.onload && l.onload(new Event("load")), l.dispatchEvent(new Event("readystatechange")), l.dispatchEvent(new Event("load")), l.dispatchEvent(new Event("loadend"));
          }).catch((f) => {
            Object.defineProperty(l, "readyState", { value: 4, writable: !1, configurable: !0 }), Object.defineProperty(l, "status", { value: 0, writable: !1, configurable: !0 }), l.onerror && l.onerror(new Event("error")), l.dispatchEvent(new Event("error")), l.dispatchEvent(new Event("loadend"));
          });
          return;
        }
        return r.call(this, a);
      };
    }
  }
  release() {
    if (!this._intercepted) return;
    const e = this._interceptTarget;
    try {
      delete e.__speedrtc_proxy_fetch;
    } catch {
    }
    this._messageHandler && (e.removeEventListener("message", this._messageHandler), this._messageHandler = null), this._origFetch && (e.fetch = this._origFetch);
    const t = e.XMLHttpRequest;
    t && (this._origXhrOpen && (t.prototype.open = this._origXhrOpen), this._origXhrSend && (t.prototype.send = this._origXhrSend), this._origXhrSetHeader && (t.prototype.setRequestHeader = this._origXhrSetHeader)), this._origFetch = null, this._origXhrOpen = null, this._origXhrSend = null, this._origXhrSetHeader = null, this._interceptTarget = null, this._interceptFilter = null, this._intercepted = !1;
  }
  _shouldIntercept(e) {
    var t;
    if (!e) return !1;
    try {
      const s = new URL(e, (t = globalThis.location) == null ? void 0 : t.href);
      if (s.protocol !== "http:" && s.protocol !== "https:") return !1;
      if (this._interceptFilter) {
        if (typeof this._interceptFilter == "function") return this._interceptFilter(s.href);
        if (Array.isArray(this._interceptFilter))
          return this._interceptFilter.some((n) => {
            const i = s.hostname;
            return i === n || i.endsWith("." + n);
          });
      }
      return globalThis.location ? s.origin !== globalThis.location.origin : !0;
    } catch {
      return !1;
    }
  }
  createInterceptScript() {
    return "<script>(function(){var _of=window.fetch;window.fetch=function(i,o){try{var u=new URL(typeof i==='string'?i:i.url,location.href);if(u.origin!==location.origin){return window.parent.__speedrtc_proxy_fetch(u.href,o||{});}}catch(e){}return _of.call(window,i,o);};})()<\/script>";
  }
  async fetch(e, t = {}) {
    const s = us++, n = (t.method || "GET").toUpperCase(), i = Object.assign({}, t.headers || {});
    let r = null;
    if (t.body) {
      if (typeof t.body == "string")
        r = new TextEncoder().encode(t.body).buffer;
      else if (t.body instanceof ArrayBuffer)
        r = t.body;
      else if (t.body instanceof Uint8Array)
        r = t.body.buffer;
      else if (t.body instanceof URLSearchParams)
        r = new TextEncoder().encode(t.body.toString()).buffer, i["content-type"] || (i["content-type"] = "application/x-www-form-urlencoded");
      else if (t.body instanceof Blob)
        r = await t.body.arrayBuffer(), !i["content-type"] && t.body.type && (i["content-type"] = t.body.type);
      else if (typeof FormData < "u" && t.body instanceof FormData) {
        const h = new Request("/", { method: "POST", body: t.body });
        r = await h.arrayBuffer(), i["content-type"] || (i["content-type"] = h.headers.get("content-type"));
      } else if (typeof ReadableStream < "u" && t.body instanceof ReadableStream) {
        const h = t.body.getReader(), l = [];
        let d = 0;
        for (; ; ) {
          const { done: _, value: p } = await h.read();
          if (_) break;
          l.push(p), d += p.byteLength;
        }
        const f = new Uint8Array(d);
        let u = 0;
        for (const _ of l)
          f.set(_, u), u += _.byteLength;
        r = f.buffer;
      }
    }
    t.redirect && (i["x-proxy-opt-redirect"] = t.redirect), t.cache && (i["x-proxy-opt-cache"] = t.cache), t.mode && (i["x-proxy-opt-mode"] = t.mode), t.referrer && (i["x-proxy-opt-referrer"] = t.referrer), t.referrerPolicy && (i["x-proxy-opt-referrerpolicy"] = t.referrerPolicy), t.credentials && (i["x-proxy-opt-credentials"] = t.credentials);
    try {
      const h = new URL(e).origin, l = this.cookieJar.get(e);
      l && !i.cookie && (i.cookie = l);
    } catch {
    }
    const o = t.timeout || 3e4, a = ds(s, n, e, i, r);
    return new Promise((h, l) => {
      const d = t.signal;
      let f = !1;
      const u = setTimeout(() => {
        f || (f = !0, this._pending.delete(s), l(new DOMException(`Proxy request timed out: ${n} ${e}`, "TimeoutError")));
      }, o), _ = () => {
        f || (f = !0, clearTimeout(u), this._pending.delete(s), l(d.reason || new DOMException("The operation was aborted.", "AbortError")));
      };
      if (d) {
        if (d.aborted) {
          _();
          return;
        }
        d.addEventListener("abort", _, { once: !0 });
      }
      this._pending.set(s, {
        resolve: (p) => {
          d && d.removeEventListener("abort", _), h(p);
        },
        reject: (p) => {
          d && d.removeEventListener("abort", _), l(p);
        },
        timeout: u,
        url: e,
        status: 0,
        headers: {},
        bodyChunks: [],
        totalBodySize: 0,
        seqCount: -1,
        endReceived: !1
      }), this._send(a).catch(l);
    });
  }
  handleIncoming(e) {
    const t = pe(e), s = this._pending.get(t.requestId);
    if (s)
      switch (t.type) {
        case S.RESPONSE:
          s.status = t.status, s.headers = t.headers;
          break;
        case S.BODY:
          s.bodyChunks.push({ seqNum: t.seqNum, data: new Uint8Array(t.data) }), s.totalBodySize += t.data.byteLength, s.endReceived && s.bodyChunks.length >= s.seqCount && this._resolveRequest(t.requestId, s);
          break;
        case S.END:
          s.seqCount = t.seqCount, s.endReceived = !0, s.bodyChunks.length >= t.seqCount && this._resolveRequest(t.requestId, s);
          break;
        case S.ERROR:
          clearTimeout(s.timeout), this._pending.delete(t.requestId), s.reject(new Error(t.message || "Proxy error"));
          break;
      }
  }
  _resolveRequest(e, t) {
    clearTimeout(t.timeout), this._pending.delete(e), t.bodyChunks.sort((a, h) => a.seqNum - h.seqNum);
    const s = new Uint8Array(t.totalBodySize);
    let n = 0;
    for (const a of t.bodyChunks)
      s.set(a.data, n), n += a.data.length;
    const i = new fs(t.headers), r = i.get("x-speedrtc-compressed") === "gzip", o = i.get("x-speedrtc-set-cookie");
    if (o)
      try {
        const a = JSON.parse(o);
        i._map["set-cookie"] = a.join(`
`);
        try {
          const h = new URL(t.url).origin;
          this.cookieJar.store(h, a);
        } catch {
        }
      } catch {
      }
    r ? this._decompressAndResolve(s.buffer, t, i) : t.resolve(new J(t.status, i, s.buffer));
  }
  async _decompressAndResolve(e, t, s) {
    if (typeof DecompressionStream > "u") {
      t.resolve(new J(t.status, s, e));
      return;
    }
    try {
      const n = new DecompressionStream("gzip"), i = n.writable.getWriter(), r = n.readable.getReader();
      i.write(new Uint8Array(e)), i.close();
      const o = [];
      let a = 0;
      for (; ; ) {
        const { done: d, value: f } = await r.read();
        if (d) break;
        o.push(f), a += f.byteLength;
      }
      const h = new Uint8Array(a);
      let l = 0;
      for (const d of o)
        h.set(d, l), l += d.byteLength;
      t.resolve(new J(t.status, s, h.buffer));
    } catch {
      t.resolve(new J(t.status, s, e));
    }
  }
}
class J {
  constructor(e, t, s) {
    this.status = e, this.statusText = t.get("x-speedrtc-status-text") || "", this.url = t.get("x-speedrtc-url") || "", this.redirected = t.get("x-speedrtc-redirected") === "1", this.ok = e >= 200 && e < 300, this.type = "basic", this.headers = t, this._body = s, this.bodyUsed = !1, this.body = typeof ReadableStream < "u" ? new ReadableStream({
      start(n) {
        n.enqueue(new Uint8Array(s)), n.close();
      }
    }) : null;
  }
  async text() {
    return this.bodyUsed = !0, new TextDecoder().decode(this._body);
  }
  async json() {
    return JSON.parse(await this.text());
  }
  async arrayBuffer() {
    return this.bodyUsed = !0, this._body;
  }
  async blob() {
    this.bodyUsed = !0;
    const e = this.headers.get("content-type") || "";
    return new Blob([this._body], e ? { type: e } : void 0);
  }
  async formData() {
    const e = this.headers.get("content-type") || "", t = new TextDecoder().decode(this._body);
    if (e.includes("application/x-www-form-urlencoded")) {
      const s = new FormData();
      return new URLSearchParams(t).forEach((n, i) => s.append(i, n)), s;
    }
    return new FormData();
  }
  clone() {
    return new J(this.status, this.headers, this._body.slice(0));
  }
}
const ms = 16 * 1024, se = /* @__PURE__ */ new Map(), gs = 200, ys = /* @__PURE__ */ new Set([200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501]), ws = /* @__PURE__ */ new Set([
  "content-encoding",
  "transfer-encoding",
  "content-length",
  "connection",
  "keep-alive",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer"
]), bs = /* @__PURE__ */ new Set([
  "host",
  "origin",
  "referer"
]), Cs = /* @__PURE__ */ new Set([
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "x-content-type-options",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-expose-headers",
  "access-control-max-age",
  "strict-transport-security"
]), Se = "<script data-speedrtc>!function(){var _i=0,_c={},_p,h=/^https?:\\/\\//,D=Object.defineProperty;function g(){if(_p)return _p;try{if(_p=window.__speedrtc_proxy_fetch)return _p}catch(e){}try{if(_p=window.parent.__speedrtc_proxy_fetch)return _p}catch(e){}try{if(_p=window.top.__speedrtc_proxy_fetch)return _p}catch(e){}}window.addEventListener('message',function(e){var m=e.data;if(!m||m.type!=='speedrtc-fetch-res')return;var c=_c[m.id];if(!c)return;delete _c[m.id];if(m.error)return c[1](new Error(m.error));c[0](new Response(m.body,{status:m.status,statusText:m.statusText||'',headers:m.headers||{}}))});function P(u,o){var fn=g();if(fn)return fn(u,o||{});var id=++_i;return new Promise(function(ok,no){_c[id]=[ok,no];try{var t=window.parent!==window?window.parent:window.top;t.postMessage({type:'speedrtc-fetch',id:id,url:u,method:(o&&o.method)||'GET',headers:(o&&o.headers)||{},body:(o&&o.body)||null},'*')}catch(e){delete _c[id];no(e)}})}var f=fetch;fetch=function(i,o){var u=i&&i.url||''+i;return h.test(u)?P(u,o||{}):f.apply(this,arguments)};var X=XMLHttpRequest.prototype,O=X.open,S=X.send,H=X.setRequestHeader;X.open=function(m,u){this._m=m;this._u=''+u;this._h={};return O.apply(this,arguments)};X.setRequestHeader=function(n,v){this._h&&(this._h[n]=v);return H.apply(this,arguments)};X.send=function(b){var x=this,u=x._u;if(h.test(u)){var o={method:x._m||'GET',headers:x._h||{}};b!=null&&(o.body=b);P(u,o).then(function(r){D(x,'status',{value:r.status,configurable:1});D(x,'statusText',{value:r.statusText||'',configurable:1});return r.text().then(function(t){D(x,'responseText',{value:t,configurable:1});D(x,'response',{value:t,configurable:1});D(x,'readyState',{value:4,configurable:1});try{x.dispatchEvent(new Event('readystatechange'))}catch(e){}try{x.onreadystatechange&&x.onreadystatechange()}catch(e){}try{x.dispatchEvent(new Event('load'))}catch(e){}try{x.onload&&x.onload()}catch(e){}try{x.dispatchEvent(new Event('loadend'))}catch(e){}})}).catch(function(){D(x,'readyState',{value:4,configurable:1});D(x,'status',{value:0,configurable:1});try{x.dispatchEvent(new Event('error'))}catch(e){}try{x.onerror&&x.onerror()}catch(e){}try{x.dispatchEvent(new Event('loadend'))}catch(e){}});return}return S.apply(this,arguments)};try{var hp=history.pushState,hr=history.replaceState;history.pushState=function(s,t,u){try{return hp.call(this,s,t,u)}catch(e){return hp.call(this,s,t)}};history.replaceState=function(s,t,u){try{return hr.call(this,s,t,u)}catch(e){return hr.call(this,s,t)}}}catch(e){}try{if(navigator.serviceWorker)navigator.serviceWorker.register=function(){return Promise.reject(new Error('blocked'))}}catch(e){}try{var sb=navigator.sendBeacon;if(sb)navigator.sendBeacon=function(u,b){if(h.test(u)){P(u,{method:'POST',body:b});return true}return sb.apply(navigator,arguments)}}catch(e){}try{var wo=window.open;window.open=function(u){if(u&&h.test(u)){try{window.parent.postMessage({type:'speedrtc-nav',url:u},'*')}catch(e){}return null}return wo.apply(this,arguments)}}catch(e){}document.addEventListener('error',function(e){var el=e.target,t,s;if(!el||!el.tagName||el._s)return;t=el.tagName;s=t==='LINK'?el.href||'':el.src||el.currentSrc||el.data||'';if(!h.test(s))return;el._s=1;t==='LINK'&&(el.rel||'').includes('stylesheet')?P(s,{}).then(function(r){return r.text()}).then(function(t){var n=document.createElement('style');n.textContent=t;el.parentNode&&el.parentNode.insertBefore(n,el);el.disabled=1}).catch(function(){}):t==='SCRIPT'?P(s,{}).then(function(r){return r.text()}).then(function(t){var n=document.createElement('script');n.textContent=t;document.head.appendChild(n)}).catch(function(){}):P(s,{}).then(function(r){return r.blob()}).then(function(b){var u=URL.createObjectURL(b);el.src!==void 0?el.src=u:el.data!==void 0&&(el.data=u)}).catch(function(){})},1);document.addEventListener('click',function(e){for(var n=e.target;n;n=n.parentElement)if(n.tagName==='A'&&h.test(n.href||'')){e.preventDefault();e.stopPropagation();try{window.parent.postMessage({type:'speedrtc-nav',url:n.href},'*')}catch(x){}break}},1);document.addEventListener('submit',function(e){var f=e.target,u=f.action||'';if(!h.test(u))return;e.preventDefault();(f.method||'get').toUpperCase()==='GET'&&(u+=(~u.indexOf('?')?'&':'?')+new URLSearchParams(new FormData(f)));try{window.parent.postMessage({type:'speedrtc-nav',url:u},'*')}catch(x){}},1)}()<\/script>";
class Ss {
  constructor(e, t = {}) {
    this._send = e, this._allowList = t.allowList || [], this._blockList = t.blockList || [], this._chunkSize = t.chunkSize || ms, this._compress = t.compress || !1, this._active = !1;
  }
  serve(e) {
    e && (e.chunkSize != null && (this._chunkSize = e.chunkSize), e.compress != null && (this._compress = e.compress), e.allowList != null && (this._allowList = e.allowList), e.blockList != null && (this._blockList = e.blockList)), this._active = !0;
  }
  stop() {
    this._active = !1;
  }
  async handleIncoming(e) {
    const t = pe(e);
    if (t.type !== S.REQUEST) return;
    if (!this._active) {
      await this._send(Ce(t.requestId, "Proxy server not active"));
      return;
    }
    const { requestId: s, method: n, url: i, headers: r, body: o } = t;
    let a = 0;
    if (!this._isDomainAllowed(i)) {
      await this._send(Ce(s, "Domain not allowed"));
      return;
    }
    try {
      const h = {}, l = {};
      for (const [I, U] of Object.entries(r))
        I.startsWith("x-proxy-opt-") ? l[I.slice(12)] = U : h[I] = U;
      const d = { method: n, headers: h };
      o && n !== "GET" && n !== "HEAD" && (d.body = o), l.redirect && (d.redirect = l.redirect), l.cache && (d.cache = l.cache), l.mode && (d.mode = l.mode), l.referrer && (d.referrer = l.referrer), l.referrerpolicy && (d.referrerPolicy = l.referrerpolicy), l.credentials && (d.credentials = l.credentials);
      const f = new URL(i), u = f.origin, _ = f.host, p = h.origin || "";
      let w;
      try {
        const I = new URL(p);
        w = I.origin === u ? "same-origin" : I.hostname.endsWith("." + _) || _.endsWith("." + I.hostname) ? "same-site" : "cross-site";
      } catch {
        w = "none";
      }
      const g = (h.accept || "").toLowerCase();
      let x, m;
      g.includes("text/html") ? (x = "document", m = "navigate") : g.includes("application/json") || g.startsWith("*/*") ? (x = "empty", m = "cors") : g.includes("image/") ? (x = "image", m = "no-cors") : g.includes("text/css") ? (x = "style", m = "cors") : g.includes("application/javascript") || g.includes("text/javascript") ? (x = "script", m = "no-cors") : g.includes("font/") ? (x = "font", m = "cors") : (x = "empty", m = "cors");
      for (const I of bs) delete h[I];
      h.host = _, h.origin || (h.origin = u), h.referer || (h.referer = f.href), h["user-agent"] || (h["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"), h.accept || (h.accept = "*/*"), h["accept-language"] || (h["accept-language"] = "en-US,en;q=0.9"), h["accept-encoding"] = "identity", h["sec-fetch-site"] = w, h["sec-fetch-mode"] = m, h["sec-fetch-dest"] = x, h["sec-ch-ua"] = '"Google Chrome";v="124", "Chromium";v="124", "Not-A.Brand";v="99"', h["sec-ch-ua-mobile"] = "?0", h["sec-ch-ua-platform"] = '"Windows"', o && (h["content-length"] = String(o.byteLength || 0));
      const W = n === "GET" || n === "HEAD" ? `${n}:${i}` : null, v = W ? se.get(W) : null;
      if (v) {
        const I = h["if-none-match"], U = h["if-modified-since"];
        if (I && I === v.etag || U && v.lastModified && new Date(U) >= new Date(v.lastModified)) {
          await this._send(lt(s, 304, { etag: v.etag || "", "last-modified": v.lastModified || "" })), await this._send(dt(s));
          return;
        }
        v.etag && (h["if-none-match"] = v.etag), v.lastModified && (h["if-modified-since"] = v.lastModified);
      }
      const b = await fetch(i, d), q = {}, me = [];
      b.headers.forEach((I, U) => {
        const Q = U.toLowerCase();
        if (!ws.has(Q) && !Cs.has(Q)) {
          if (Q === "set-cookie") {
            me.push(I);
            return;
          }
          q[U] = I;
        }
      }), me.length > 0 && (q["x-speedrtc-set-cookie"] = JSON.stringify(me));
      const Ve = b.headers.get("etag"), Ge = b.headers.get("last-modified"), Je = b.headers.get("cache-control") || "", Mt = Je.includes("no-store") || Je.includes("no-cache");
      if (W && !Mt && ys.has(b.status) && (Ve || Ge) && (se.size >= gs && se.delete(se.keys().next().value), se.set(W, { etag: Ve, lastModified: Ge })), q["x-speedrtc-status-text"] = b.statusText, q["x-speedrtc-url"] = b.url, b.redirected && (q["x-speedrtc-redirected"] = "1"), this._compress && (q["x-speedrtc-compressed"] = "gzip"), await this._send(lt(s, b.status, q)), b.body) {
        const I = (b.headers.get("content-type") || "").toLowerCase(), U = I.includes("text/css"), Q = I.includes("text/html"), ze = b.url || i;
        let Y = b.body;
        if (U) {
          const K = await new Response(Y).arrayBuffer(), H = this._rewriteCssUrls(new TextDecoder().decode(K), ze), O = new TextEncoder().encode(H), R = this._chunkSize;
          let A = 0;
          if (this._compress && typeof CompressionStream < "u") {
            const C = new CompressionStream("gzip"), $ = C.writable.getWriter();
            $.write(O), $.close();
            const Z = C.readable.getReader();
            try {
              for (; ; ) {
                const { done: ge, value: E } = await Z.read();
                if (ge) break;
                if (E != null && E.length)
                  for (let F = 0; F < E.length; F += R)
                    await this._send(te(s, A++, E.subarray(F, F + R)));
              }
            } finally {
              Z.cancel().catch(() => {
              });
            }
          } else
            for (let C = 0; C < O.length; C += R)
              await this._send(te(s, A++, O.subarray(C, C + R)));
          a = A;
        } else if (Q) {
          const K = await new Response(Y).arrayBuffer();
          let H = new TextDecoder().decode(K);
          H = this._rewriteHtml(H, ze);
          const O = new TextEncoder().encode(H), R = this._chunkSize;
          let A = 0;
          if (this._compress && typeof CompressionStream < "u") {
            const C = new CompressionStream("gzip"), $ = C.writable.getWriter();
            $.write(O), $.close();
            const Z = C.readable.getReader();
            try {
              for (; ; ) {
                const { done: ge, value: E } = await Z.read();
                if (ge) break;
                if (E != null && E.length)
                  for (let F = 0; F < E.length; F += R)
                    await this._send(te(s, A++, E.subarray(F, F + R)));
              }
            } finally {
              Z.cancel().catch(() => {
              });
            }
          } else
            for (let C = 0; C < O.length; C += R)
              await this._send(te(s, A++, O.subarray(C, C + R)));
          a = A;
        } else {
          this._compress && typeof CompressionStream < "u" && (Y = Y.pipeThrough(new CompressionStream("gzip")));
          const K = Y.getReader();
          let H = 0;
          const O = this._chunkSize;
          try {
            for (; ; ) {
              const { done: R, value: A } = await K.read();
              if (R) break;
              if (A != null && A.length)
                for (let C = 0; C < A.length; C += O) {
                  const $ = A.subarray(C, C + O);
                  await this._send(te(s, H++, $));
                }
            }
          } finally {
            K.cancel().catch(() => {
            });
          }
          a = H;
        }
      }
      await this._send(dt(s, a));
    } catch (h) {
      await this._send(Ce(s, h.message || "Proxy fetch failed"));
    }
  }
  _rewriteHtml(e, t) {
    let s;
    try {
      s = new URL(t);
    } catch {
      return e;
    }
    const n = /<base\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*?>/i.exec(e);
    if (n)
      try {
        s = new URL(n[1], s);
      } catch {
      }
    e = this._resolveHtmlUrls(e, s);
    const i = /<head(\s[^>]*)?>/i.exec(e);
    if (i) {
      const r = i.index + i[0].length;
      e = e.slice(0, r) + Se + e.slice(r);
    } else {
      const r = /<html(\s[^>]*)?>/i.exec(e);
      if (r) {
        const o = r.index + r[0].length;
        e = e.slice(0, o) + "<head>" + Se + "</head>" + e.slice(o);
      } else
        e = Se + e;
    }
    return e;
  }
  _resolveHtmlUrls(e, t) {
    return e = e.replace(
      /(\b(?:src|href|action|poster|data|formaction)\s*=\s*)(["'])([^"']*?)\2/gi,
      (s, n, i, r) => {
        if (r = r.trim(), !r || /^(data:|blob:|#|javascript:|mailto:|tel:|about:)/.test(r)) return s;
        try {
          return n + i + new URL(r, t).href + i;
        } catch {
          return s;
        }
      }
    ), e = e.replace(
      /(\bsrcset\s*=\s*)(["'])([^"']*?)\2/gi,
      (s, n, i, r) => {
        const o = r.split(",").map((a) => {
          const h = a.trim().split(/\s+/);
          if (h[0] && !/^(data:|blob:)/.test(h[0]))
            try {
              h[0] = new URL(h[0], t).href;
            } catch {
            }
          return h.join(" ");
        }).join(", ");
        return n + i + o + i;
      }
    ), e = e.replace(
      /(style\s*=\s*)(["'])([^"']*?)\2/gi,
      (s, n, i, r) => {
        const o = r.replace(/url\(\s*(['"]?)([^)'"]*?)\1\s*\)/gi, (a, h, l) => {
          if (!l || /^(data:|blob:|#)/.test(l)) return a;
          try {
            return `url(${h}${new URL(l, t).href}${h})`;
          } catch {
            return a;
          }
        });
        return n + i + o + i;
      }
    ), e;
  }
  _rewriteCssUrls(e, t) {
    let s;
    try {
      s = new URL(t);
    } catch {
      return e;
    }
    return e = e.replace(/@import\s+url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (n, i, r) => {
      if (r = r.trim(), r.startsWith("data:") || r.startsWith("#")) return n;
      try {
        return `@import url(${i}${new URL(r, s).href}${i})`;
      } catch {
        return n;
      }
    }), e = e.replace(/@import\s+(['"])([^'"]+)\1/gi, (n, i, r) => {
      if (r.startsWith("data:") || r.startsWith("#")) return n;
      try {
        return `@import ${i}${new URL(r, s).href}${i}`;
      } catch {
        return n;
      }
    }), e = e.replace(/url\(\s*(['"]?)([^)'"]*?)\1\s*\)/gi, (n, i, r) => {
      if (r = r.trim(), !r || r.startsWith("data:") || r.startsWith("#")) return n;
      try {
        return `url(${i}${new URL(r, s).href}${i})`;
      } catch {
        return n;
      }
    }), e;
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
class xt {
  constructor(e = {}) {
    this._upstreamSend = e.upstreamSend || null, this._downstreamSend = e.downstreamSend || null, this._active = !1, this._requestMap = /* @__PURE__ */ new Map(), this._stats = { relayed: 0, bytes: 0 }, this._allowList = e.allowList || [], this._blockList = e.blockList || [], this._onRelay = e.onRelay || null;
  }
  start() {
    this._active = !0;
  }
  stop() {
    this._active = !1, this._requestMap.clear();
  }
  setUpstream(e) {
    this._upstreamSend = e;
  }
  setDownstream(e) {
    this._downstreamSend = e;
  }
  async handleFromClient(e) {
    if (!this._active) return;
    const t = pe(e);
    if (t.type === S.REQUEST) {
      if (!this._isDomainAllowed(t.url)) return;
      this._requestMap.set(t.requestId, "upstream");
    }
    this._upstreamSend && (await this._upstreamSend(e), this._recordRelay(e));
  }
  async handleFromServer(e) {
    if (!this._active) return;
    const t = pe(e);
    (t.type === S.END || t.type === S.ERROR) && this._requestMap.delete(t.requestId), this._downstreamSend && (await this._downstreamSend(e), this._recordRelay(e));
  }
  getStats() {
    return {
      active: this._active,
      pendingRequests: this._requestMap.size,
      relayedFrames: this._stats.relayed,
      relayedBytes: this._stats.bytes
    };
  }
  _recordRelay(e) {
    this._stats.relayed++, this._stats.bytes += e.byteLength || e.length || 0, this._onRelay && this._onRelay(this._stats);
  }
  _isDomainAllowed(e) {
    if (this._allowList.length === 0 && this._blockList.length === 0) return !0;
    try {
      const t = new URL(e).hostname;
      if (this._blockList.length > 0) {
        for (const s of this._blockList)
          if (this._matchDomain(t, s)) return !1;
      }
      if (this._allowList.length > 0) {
        for (const s of this._allowList)
          if (this._matchDomain(t, s)) return !0;
        return !1;
      }
      return !0;
    } catch {
      return !1;
    }
  }
  _matchDomain(e, t) {
    if (t.startsWith("*.")) {
      const s = t.slice(2);
      return e === s || e.endsWith("." + s);
    }
    return e === t;
  }
}
class Vs {
  constructor(e = []) {
    this._hops = [], this._connections = [], this._active = !1;
    for (const t of e)
      this._hops.push({
        qdp: t.qdp || null,
        config: t.config || t,
        relay: new xt({
          allowList: t.allowList || [],
          blockList: t.blockList || []
        })
      });
  }
  async build(e) {
    for (let t = 0; t < this._hops.length; t++) {
      const s = this._hops[t];
      if (!s.qdp && s.config && (s.qdp = new e(s.config)), t > 0) {
        const n = this._hops[t - 1];
        n.relay.setUpstream(async (i) => {
          const r = this._wrapRelay(i);
          s.qdp.bonding && s.qdp.bonding.senders.length > 0 && await s.qdp.bonding.sendSingle(r);
        }), s.relay.setDownstream(async (i) => {
          const r = this._wrapRelay(i);
          n.qdp.bonding && n.qdp.bonding.senders.length > 0 && await n.qdp.bonding.sendSingle(r);
        });
      }
    }
    return this;
  }
  start() {
    this._active = !0;
    for (const e of this._hops)
      e.relay.start();
  }
  stop() {
    this._active = !1;
    for (const e of this._hops)
      e.relay.stop();
  }
  getEntryRelay() {
    return this._hops.length > 0 ? this._hops[0].relay : null;
  }
  getExitRelay() {
    return this._hops.length > 0 ? this._hops[this._hops.length - 1].relay : null;
  }
  getStats() {
    return this._hops.map((e, t) => ({
      hop: t,
      relay: e.relay.getStats()
    }));
  }
  _wrapRelay(e) {
    const t = e instanceof ArrayBuffer ? e : e.buffer || e, s = new ArrayBuffer(1 + t.byteLength), n = new Uint8Array(s);
    return n[0] = 4, n.set(new Uint8Array(t), 1), s;
  }
  disconnect() {
    this.stop();
    for (const e of this._hops)
      e.qdp && e.qdp.disconnect();
    this._hops = [];
  }
}
class Is {
  constructor(e, t) {
    this.pc = e, this._renegotiate = t, this.localStream = null, this.remoteStream = null, this._senders = [], this._listeners = {}, this.pc.ontrack = (s) => {
      this.remoteStream || (this.remoteStream = new MediaStream()), this.remoteStream.addTrack(s.track), this._emit("remoteStream", this.remoteStream), this._emit("track", s.track, s.streams);
    };
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
          console.error("MediaManager error:", n);
        }
  }
  async startCamera(e = { video: !0, audio: !0 }) {
    return this.localStream = await navigator.mediaDevices.getUserMedia(e), this._addTracks(this.localStream), this._emit("localStream", this.localStream), this.localStream;
  }
  async startScreenShare(e = { video: !0 }) {
    var t;
    return this.localStream = await navigator.mediaDevices.getDisplayMedia(e), this._addTracks(this.localStream), this._emit("localStream", this.localStream), (t = this.localStream.getVideoTracks()[0]) == null || t.addEventListener("ended", () => {
      this.stop(), this._emit("screenShareEnded");
    }), this.localStream;
  }
  async replaceTrack(e) {
    const t = this._senders.find((s) => {
      var n;
      return ((n = s.track) == null ? void 0 : n.kind) === e.kind;
    });
    t && await t.replaceTrack(e);
  }
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
  _addTracks(e) {
    for (const t of e.getTracks()) {
      const s = this.pc.addTrack(t, e);
      this._senders.push(s);
    }
    this._renegotiate();
  }
}
const ft = 1, At = 2, Rt = 3, De = new TextEncoder(), Ie = new TextDecoder();
class vs {
  constructor(e) {
    this._send = e, this._streams = /* @__PURE__ */ new Map(), this._listeners = {};
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
          console.error("StreamManager error:", n);
        }
  }
  create(e) {
    const t = new ut(e, this._send);
    this._streams.set(e, t);
    const s = De.encode(e), n = new ArrayBuffer(2 + s.length), i = new Uint8Array(n);
    return i[0] = ft, i[1] = s.length, i.set(s, 2), this._send(n), t;
  }
  get(e) {
    return this._streams.get(e);
  }
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === ft) {
      const n = t[1], i = Ie.decode(t.slice(2, 2 + n)), r = new ut(i, this._send);
      this._streams.set(i, r), this._emit("incoming", r);
      return;
    }
    if (s === At) {
      const n = t[1], i = Ie.decode(t.slice(2, 2 + n)), r = e.slice(2 + n), o = this._streams.get(i);
      o && o._handleData(r);
      return;
    }
    if (s === Rt) {
      const n = t[1], i = Ie.decode(t.slice(2, 2 + n)), r = this._streams.get(i);
      r && (r._handleClose(), this._streams.delete(i));
    }
  }
}
class ut {
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
  async write(e) {
    if (this._closed) throw new Error("Stream closed");
    const t = new Uint8Array(e), s = De.encode(this.name), n = new ArrayBuffer(2 + s.length + t.length), i = new Uint8Array(n);
    i[0] = At, i[1] = s.length, i.set(s, 2), i.set(t, 2 + s.length), await this._send(n);
  }
  async close() {
    if (this._closed) return;
    this._closed = !0;
    const e = De.encode(this.name), t = new ArrayBuffer(2 + e.length), s = new Uint8Array(t);
    s[0] = Rt, s[1] = e.length, s.set(e, 2), await this._send(t), this._emit("close");
  }
  _handleData(e) {
    this._emit("data", e);
  }
  _handleClose() {
    this._closed = !0, this._emit("close");
  }
}
const k = {
  CHUNK: 240,
  MESSAGE: 241,
  PROXY: 242,
  STREAM: 243
}, Ps = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
      "turns:openrelay.metered.ca:443?transport=tcp"
    ],
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];
let _t = 1, ie = null, ve = null;
function Et() {
  return ie ? Promise.resolve(ie) : (ve || (ve = RTCPeerConnection.generateCertificate({ name: "ECDSA", namedCurve: "P-256" }).then((c) => (ie = c, c)).catch(() => null)), ve);
}
Et();
function M(c, e) {
  const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length), n = new Uint8Array(s);
  return n[0] = c, n.set(t, 1), s;
}
class Ts {
  constructor({
    iceServers: e = Ps,
    dataChannels: t = 32,
    chunkSize: s = kt,
    proxy: n = {},
    isHost: i = !1,
    requireRoomCode: r = !1,
    trackerUrls: o = null,
    driveSignal: a = null,
    mqtt: h = null,
    bondTransports: l = !1,
    serverMode: d = !1,
    iceTransportPolicy: f = "all",
    iceCandidatePoolSize: u = 10,
    signalServer: _ = null,
    webTransport: p = null,
    dhtNodes: w = null,
    icmp: g = null,
    srtp: x = null,
    relay: m = null
  } = {}) {
    this.iceServers = e, this.iceTransportPolicy = f, this.iceCandidatePoolSize = u, this.dataChannelCount = t, this.chunkSize = s, this.isHost = i, this.requireRoomCode = r, this.trackerUrls = o, this.driveSignalConfig = a, this.mqttConfig = h, this.bondTransports = l, this._bondSet = Array.isArray(l) ? new Set(l.map((W) => W.toLowerCase())) : null, this.signalServerUrl = _, this.serverMode = d, this.remoteIsHost = !1, this.webTransportConfig = p, this.dhtNodes = w, this.icmpConfig = g, this.srtpConfig = x, this.relayConfig = m, this.pc = null, this.signaling = null, this.pool = null, this.bonding = null, this.monitor = new Tt(), this.roomCode = null, this.isOfferer = !1, this._listeners = {}, this._pendingMeta = /* @__PURE__ */ new Map(), this._probeTimers = /* @__PURE__ */ new Map(), this._negotiationState = "idle", this._pcCreated = !1, this._iceRestartPending = !1, this._pendingIceCandidates = [], this._pendingRemoteCandidates = [], this._preConnectedWs = null, this._preWarmedManager = null, this._proxyOpts = n, this.message = null, this._proxyClient = null, this._proxyServer = null, this.proxy = null, this.media = null, this.stream = null, this._mqttTransport = null, this._mqttReconnectTimer = null, this._mqttReconnectAttempt = 0, this._allDcDead = !1, this._webTransport = null, this._e2e = null, this._e2ePublicKeyB64 = null, this._icmpTransport = null, this._srtpTransport = null, this._proxyRelay = null;
  }
  warmup() {
    var e;
    if (Et(), this._pcCreated || this._createPeerConnection(), this.driveSignalConfig && y.warmupToken(this.driveSignalConfig).catch(() => {
    }), this.signalServerUrl && !this._preConnectedWs && tt.preConnect(this.signalServerUrl).then((t) => {
      this._preConnectedWs = t;
    }).catch(() => {
    }), !this.driveSignalConfig && !this.signalServerUrl && !this._preWarmedManager) {
      const t = (e = this.trackerUrls) != null && e.length ? [...this.trackerUrls] : fe.DEFAULT_TRACKER_URLS;
      this._preWarmedManager = new yt(t), this._preWarmedConnectPromise = this._preWarmedManager.connect().catch(() => {
      });
    }
  }
  getVersion() {
    return "3.0.0";
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
          console.error("QDP event error:", n);
        }
  }
  async createRoom(e = null) {
    var t;
    if (this.isOfferer = !0, e ? this.roomCode = e : this.requireRoomCode ? this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase() : this.roomCode = "QDP-PUBLIC-SWARM", (t = this.mqttConfig) != null && t.e2e && (this._e2e = new st(), await this._e2e.init(), this._e2ePublicKeyB64 = btoa(String.fromCharCode(...await this._e2e.getPublicKey()))), this._pcCreated || this._createPeerConnection(), !this.driveSignalConfig) {
      this._negotiationState = "offering";
      const s = await this.pc.createOffer();
      await this.pc.setLocalDescription(s);
    }
    return this._preWarmedConnectPromise && (await this._preWarmedConnectPromise, this._preWarmedConnectPromise = null), new Promise((s, n) => {
      this.signaling = this._createSignaling(!0), this._wrapSignalingSend(), this.signaling.onOpen = () => {
        this._emit("wss-open", 0), this._emit("room-created", this.roomCode), this.driveSignalConfig || this.signaling.send({
          type: "offer",
          sdp: this.pc.localDescription,
          roomCode: this.roomCode,
          isHost: this.isHost
        }), s(this.roomCode);
      }, this.signaling.onMessage = (i) => {
        this._onSignalingMessage(i);
      }, this.signaling.onClose = () => {
        this._emit("wss-close", 0);
      }, this.signaling.connect();
    });
  }
  async joinRoom(e = null) {
    var t;
    if (this.isOfferer = !1, e)
      this.roomCode = e;
    else {
      if (this.requireRoomCode)
        return Promise.reject(new Error("QDP is configured with requireRoomCode=true, but no code was provided to joinRoom()."));
      this.roomCode = "QDP-PUBLIC-SWARM";
    }
    return (t = this.mqttConfig) != null && t.e2e && !this._e2e && (this._e2e = new st(), await this._e2e.init(), this._e2ePublicKeyB64 = btoa(String.fromCharCode(...await this._e2e.getPublicKey()))), this._pcCreated || this._createPeerConnection(), this._preWarmedConnectPromise && (await this._preWarmedConnectPromise, this._preWarmedConnectPromise = null), new Promise((s, n) => {
      this._joinResolver = s, this.signaling = this._createSignaling(!1), this._wrapSignalingSend(), this.signaling.onOpen = () => {
        this._emit("wss-open", 0);
      }, this.signaling.onMessage = (i) => {
        this._onSignalingMessage(i);
      }, this.signaling.onClose = () => {
        this._emit("wss-close", 0);
      }, this.signaling.connect();
    });
  }
  async send(e) {
    if (!this.bonding) throw new Error("Not connected");
    const t = _t++, n = ot(e, t, this.chunkSize).map((i) => M(k.CHUNK, i));
    await this.bonding.sendChunks(n);
  }
  async sendFile(e) {
    if (!this.bonding) throw new Error("Not connected");
    const t = _t++, s = await e.arrayBuffer(), n = { name: e.name, size: e.size, type: e.type }, i = M(k.CHUNK, rs(t, n));
    for (const a of this.bonding.senders)
      try {
        await a(i);
      } catch {
      }
    await new Promise((a) => setTimeout(a, 50));
    const r = ot(s, t, this.chunkSize), o = r.map((a) => M(k.CHUNK, a));
    this._emit("send-start", { transferId: t, name: e.name, totalChunks: r.length }), await this.bonding.sendChunks(o), this._emit("send-complete", { transferId: t, name: e.name });
  }
  getStats() {
    const e = {
      links: Object.fromEntries(this.monitor.getScores()),
      weights: Object.fromEntries(this.monitor.getWeights()),
      signalingConnected: this._isSignalingReady(),
      openChannels: this.pool ? this.pool.getOpenCount() : 0,
      totalChannels: this.dataChannelCount,
      bondTransports: this.bondTransports
    };
    if (this._mqttTransport) {
      const t = this.monitor.links.get("mqtt-0");
      e.mqtt = {
        connected: this._mqttTransport.connected,
        throughput: t ? t.throughput : 0,
        latency: t ? t.latency : 0,
        reconnectAttempt: this._mqttReconnectAttempt
      };
    }
    if (this._webTransport) {
      const t = this.monitor.links.get("wt-0");
      e.webTransport = {
        connected: this._webTransport.connected,
        throughput: t ? t.throughput : 0,
        latency: t ? t.latency : 0
      };
    }
    if (this._icmpTransport) {
      const t = this.monitor.links.get("icmp-0");
      e.icmp = {
        connected: this._icmpTransport.connected,
        strategy: this._icmpTransport.strategy,
        throughput: t ? t.throughput : 0,
        latency: t ? t.latency : 0
      };
    }
    if (this._srtpTransport) {
      const t = this.monitor.links.get("srtp-0");
      e.srtp = {
        connected: this._srtpTransport.connected,
        throughput: t ? t.throughput : 0,
        latency: t ? t.latency : 0
      };
    }
    return e;
  }
  getTransports() {
    const e = [];
    if (this.pool)
      for (const t of this.pool.openChannels) {
        const s = `dc-${t}`, n = this.monitor.links.get(s);
        e.push({
          type: "webrtc",
          linkId: s,
          state: "open",
          throughput: n ? n.throughput : 0,
          latency: n ? n.latency : 0,
          score: n ? n.score : 0
        });
      }
    if (this._mqttTransport) {
      const t = this.monitor.links.get("mqtt-0");
      e.push({
        type: "mqtt",
        linkId: "mqtt-0",
        state: this._mqttTransport.connected ? "open" : "closed",
        throughput: t ? t.throughput : 0,
        latency: t ? t.latency : 0,
        score: t ? t.score : 0
      });
    }
    if (this._webTransport) {
      const t = this.monitor.links.get("wt-0");
      e.push({
        type: "webtransport",
        linkId: "wt-0",
        state: this._webTransport.connected ? "open" : "closed",
        throughput: t ? t.throughput : 0,
        latency: t ? t.latency : 0,
        score: t ? t.score : 0
      });
    }
    if (this._icmpTransport) {
      const t = this.monitor.links.get("icmp-0");
      e.push({
        type: "icmp",
        linkId: "icmp-0",
        strategy: this._icmpTransport.strategy,
        state: this._icmpTransport.connected ? "open" : "closed",
        throughput: t ? t.throughput : 0,
        latency: t ? t.latency : 0,
        score: t ? t.score : 0
      });
    }
    if (this._srtpTransport) {
      const t = this.monitor.links.get("srtp-0");
      e.push({
        type: "srtp",
        linkId: "srtp-0",
        state: this._srtpTransport.connected ? "open" : "closed",
        throughput: t ? t.throughput : 0,
        latency: t ? t.latency : 0,
        score: t ? t.score : 0
      });
    }
    return e;
  }
  getSignalStats() {
    var e, t;
    return (e = this.signaling) != null && e.getSignalStats ? this.signaling.getSignalStats() : (t = this.signaling) != null && t._manager ? this.signaling._manager.getStats() : [];
  }
  disconnect() {
    this.monitor.stop();
    for (const e of this._probeTimers.values()) clearInterval(e);
    if (this._probeTimers.clear(), this._proxyClient && this._proxyClient.release(), this.media && this.media.stop(), this.pool && this.pool.close(), this.pc && this.pc.close(), this.signaling && this.signaling.close(), this._preConnectedWs) {
      try {
        this._preConnectedWs.close();
      } catch {
      }
      this._preConnectedWs = null;
    }
    this._preWarmedManager && (this._preWarmedManager.close(), this._preWarmedManager = null), this._mqttTransport && (this._mqttTransport.close(), this._mqttTransport = null), this._mqttReconnectTimer && (clearTimeout(this._mqttReconnectTimer), this._mqttReconnectTimer = null), this._mqttReconnectAttempt = 0, this._webTransport && (this._stopWebTransportProbing(), this._webTransport.close(), this._webTransport = null), this._icmpTransport && (this._stopICMPProbing(), this._icmpTransport.close(), this._icmpTransport = null), this._srtpTransport && (this._srtpTransport.close(), this._srtpTransport = null), this._proxyRelay && (this._proxyRelay.stop(), this._proxyRelay = null), this._e2e = null, this._e2ePublicKeyB64 = null, this.pc = null, this.pool = null, this.bonding = null, this.signaling = null, this.message = null, this.proxy = null, this.media = null, this.stream = null;
  }
  _createSignaling(e) {
    if (this.driveSignalConfig)
      return new y(this.roomCode, e, this.driveSignalConfig);
    const t = !!this.mqttConfig, s = !this.signalServerUrl && !this.driveSignalConfig, n = !!(this.dhtNodes && this.dhtNodes.length), i = [];
    if (t && i.push(new Vt(this.roomCode, e, this.mqttConfig)), n && i.push(new Xt(this.roomCode, e, this.dhtNodes)), s) {
      const o = new fe(this.roomCode, e, this.trackerUrls);
      this._preWarmedManager && (o.useManager(this._preWarmedManager), this._preWarmedManager = null), i.push(o);
    }
    if (this.bondTransports && i.length >= 2)
      return new Jt(i);
    if (i.length > 0)
      return i[0];
    if (this.signalServerUrl) {
      const o = new tt(this.roomCode, e, this.signalServerUrl);
      return this._preConnectedWs && (o.usePreConnectedSocket(this._preConnectedWs), this._preConnectedWs = null), o;
    }
    const r = new fe(this.roomCode, e, this.trackerUrls);
    return this._preWarmedManager && (r.useManager(this._preWarmedManager), this._preWarmedManager = null), r;
  }
  _isSignalingReady() {
    return this.signaling ? this.signaling.connected !== void 0 ? this.signaling.connected : this.signaling.sockets ? this.signaling.sockets.some((e) => e.readyState === WebSocket.OPEN) : !1 : !1;
  }
  _wrapSignalingSend() {
    if (!this.signaling || !this._e2ePublicKeyB64) return;
    const e = this.signaling.send.bind(this.signaling);
    this.signaling.send = (t) => {
      t && typeof t == "object" && (t.e2ePublicKey = this._e2ePublicKeyB64), e(t);
    };
  }
  _onSignalingMessage(e) {
    var t;
    if (e) {
      if (e.isHost === !0 && (this.remoteIsHost = !0), e.e2ePublicKey && this._e2e && !this._e2e.ready) {
        const s = atob(e.e2ePublicKey), n = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) n[i] = s.charCodeAt(i);
        this._e2e.deriveSharedKey(n).catch(() => {
        });
      }
      switch (e.type) {
        case "peer-joined":
          this.isOfferer ? (this._emit("peer-joined"), this._flushPendingCandidates(), this._negotiationState === "idle" ? (this._negotiationState = "offering", this._createPeerConnection(), this._startOffer()) : this._negotiationState === "offering" && ((t = this.pc) != null && t.localDescription) && this.signaling.send({
            type: "offer",
            sdp: this.pc.localDescription,
            roomCode: this.roomCode,
            isHost: this.isHost
          })) : !this.isOfferer && !this._pcCreated && this._emit("peer-joined");
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
  }
  _createPeerConnection() {
    if (this._pcCreated) return;
    this._pcCreated = !0;
    const e = {
      iceServers: this.iceServers,
      iceTransportPolicy: this.iceTransportPolicy,
      iceCandidatePoolSize: this.iceCandidatePoolSize,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require"
    };
    ie && (e.certificates = [ie]), this.pc = new RTCPeerConnection(e), this.pc.onicecandidate = (t) => {
      var n;
      if (this.driveSignalConfig || !t.candidate || !this._isSignalingReady()) return;
      const s = {
        type: "ice-candidate",
        candidate: t.candidate,
        roomCode: this.roomCode
      };
      (n = this.signaling) != null && n.remotePeerId ? this.signaling.send(s) : this._pendingIceCandidates.push(s);
    }, this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const t = this.pc.connectionState;
      this._emit("connection-state", t), t === "connected" ? (this._iceRestartPending = !1, this._onPeerConnected()) : (t === "disconnected" || t === "failed") && (t === "failed" && !this._iceRestartPending ? (this._iceRestartPending = !0, this._restartIce()) : this._emit("disconnected"));
    }, this.pc.oniceconnectionstatechange = () => {
      this.pc && this._emit("ice-state", this.pc.iceConnectionState);
    }, this.pool = new Ft(this.pc, {
      channelCount: this.dataChannelCount,
      ordered: this.serverMode
    }), this.pool.onOpen((t) => {
      this._emit("channel-open", t), this._updateBondingPaths();
    }), this.pool.onClose((t) => {
      this._emit("channel-close", t);
    }), this.pool.onMessage((t, s) => {
      this._routeIncoming(s, `dc-${t}`);
    }), this.pool.createChannels(), this.media = new Is(this.pc, () => this._renegotiate());
  }
  async _startOffer() {
    const e = await this.pc.createOffer();
    await this.pc.setLocalDescription(e), this.driveSignalConfig && await this._waitForIceGathering(), this.signaling.send({
      type: "offer",
      sdp: this.pc.localDescription,
      roomCode: this.roomCode,
      isHost: this.isHost
    });
  }
  async _handleOffer(e) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(e)), this._flushRemoteCandidates();
    const t = await this.pc.createAnswer();
    await this.pc.setLocalDescription(t), this.driveSignalConfig && await this._waitForIceGathering(), this.signaling.send({
      type: "answer",
      sdp: this.pc.localDescription,
      roomCode: this.roomCode,
      isHost: this.isHost
    }), this._emit("peer-joined"), this._joinResolver && (this._joinResolver(), this._joinResolver = null);
  }
  async _handleAnswer(e) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(e)), this._flushPendingCandidates(), this._flushRemoteCandidates();
  }
  _waitForIceGathering() {
    return !this.pc || this.pc.iceGatheringState === "complete" ? Promise.resolve() : new Promise((e) => {
      const t = this.pc.onicegatheringstatechange;
      this.pc.onicegatheringstatechange = (s) => {
        t && t.call(this.pc, s), this.pc.iceGatheringState === "complete" && e();
      }, setTimeout(e, 1e4);
    });
  }
  async _handleIceCandidate(e) {
    if (!(!this.pc || !e)) {
      if (!this.pc.remoteDescription) {
        this._pendingRemoteCandidates.push(e);
        return;
      }
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(e));
      } catch {
      }
    }
  }
  _flushPendingCandidates() {
    for (const e of this._pendingIceCandidates)
      this._isSignalingReady() && this.signaling.send(e);
    this._pendingIceCandidates = [];
  }
  _flushRemoteCandidates() {
    for (const e of this._pendingRemoteCandidates)
      this.pc.addIceCandidate(new RTCIceCandidate(e)).catch(() => {
      });
    this._pendingRemoteCandidates = [];
  }
  async _renegotiate() {
    if (!this.pc || !this._isSignalingReady()) return;
    const e = await this.pc.createOffer();
    await this.pc.setLocalDescription(e), this.signaling.send({
      type: "offer",
      sdp: this.pc.localDescription,
      roomCode: this.roomCode
    });
  }
  async _restartIce() {
    if (!this.pc || !this._isSignalingReady()) {
      this._emit("disconnected");
      return;
    }
    try {
      const e = await this.pc.createOffer({ iceRestart: !0 });
      await this.pc.setLocalDescription(e), this.signaling.send({
        type: "offer",
        sdp: this.pc.localDescription,
        roomCode: this.roomCode,
        iceRestart: !0
      });
    } catch {
      this._emit("disconnected");
    }
  }
  _onPeerConnected() {
    this._updateBondingPaths(), this._initSubModules(), this.monitor.start(), this._startProbing(), this._startMQTTTransport(), this._startWebTransport(), this._startICMPTransport(), this._startSRTPTransport(), this._emit("connected", { remoteIsHost: this.remoteIsHost });
  }
  _initSubModules() {
    const e = async (s) => {
      this.bonding && this.bonding.senders.length > 0 && await this.bonding.sendSingle(s);
    }, t = this.serverMode ? async (s) => {
      const n = M(k.PROXY, s);
      this.pool && this.pool.getOpenCount() > 0 ? this.pool.sendImmediate(n) === -1 && await this.pool.send(n) : await e(n);
    } : async (s) => {
      await e(M(k.PROXY, s));
    };
    this.message = new ls(async (s) => {
      await e(M(k.MESSAGE, s));
    }), this._proxyClient = new ps(t), this._proxyServer = new Ss(t, this._proxyOpts), this.proxy = {
      fetch: (s, n) => this._proxyClient.fetch(s, n),
      intercept: (s, n) => this._proxyClient.intercept(s, n),
      release: () => this._proxyClient.release(),
      createInterceptScript: () => this._proxyClient.createInterceptScript(),
      cookieJar: this._proxyClient.cookieJar,
      serve: (s) => {
        s && (s.allowList != null && (this._proxyServer._allowList = s.allowList), s.blockList != null && (this._proxyServer._blockList = s.blockList), s.chunkSize != null && (this._proxyServer._chunkSize = s.chunkSize), s.compress != null && (this._proxyServer._compress = s.compress)), this._proxyServer.serve();
      },
      stop: () => this._proxyServer.stop(),
      relay: (s, n = {}) => (this._proxyRelay = new xt({
        allowList: n.allowList || [],
        blockList: n.blockList || [],
        onRelay: n.onRelay || null
      }), this._proxyRelay.setUpstream(async (i) => {
        const r = M(k.PROXY, i);
        s.bonding && s.bonding.senders.length > 0 && await s.bonding.sendSingle(r);
      }), this._proxyRelay.setDownstream(t), this._proxyRelay.start(), this._proxyRelay),
      stopRelay: () => {
        this._proxyRelay && (this._proxyRelay.stop(), this._proxyRelay = null);
      },
      getRelayStats: () => this._proxyRelay ? this._proxyRelay.getStats() : null
    }, this.stream = new vs(async (s) => {
      await e(M(k.STREAM, s));
    });
  }
  _updateBondingPaths() {
    var r;
    const e = [], t = [], s = this._bondSet;
    if (!s || s.has("webrtc") || s.has("dc"))
      for (const o of this.pool.openChannels) {
        const a = `dc-${o}`;
        t.push(a), e.push(async (h) => {
          await this.pool.sendOnChannel(o, h);
        });
      }
    const n = this.pool.getOpenCount() > 0, i = this._allDcDead;
    if (this._allDcDead = !n, this._mqttTransport && this._mqttTransport.connected && (!s || s.has("mqtt"))) {
      const o = "mqtt-0";
      t.push(o), e.push(async (a) => {
        await this._mqttTransport.send(a), this.monitor.recordBytesSent(o, a.byteLength || a.length);
      });
    }
    if (this._webTransport && this._webTransport.connected && (!s || s.has("webtransport"))) {
      const o = "wt-0";
      t.push(o), e.push(async (a) => {
        await this._webTransport.send(a), this.monitor.recordBytesSent(o, a.byteLength || a.length);
      });
    }
    if (this._icmpTransport && this._icmpTransport.connected && (!s || s.has("icmp"))) {
      const o = "icmp-0";
      t.push(o), e.push(async (a) => {
        await this._icmpTransport.send(a), this.monitor.recordBytesSent(o, a.byteLength || a.length);
      });
    }
    if (this._srtpTransport && this._srtpTransport.connected && (!s || s.has("srtp"))) {
      const o = "srtp-0";
      t.push(o), e.push(async (a) => {
        await this._srtpTransport.send(a), this.monitor.recordBytesSent(o, a.byteLength || a.length);
      });
    }
    this._allDcDead && !i && ((r = this._mqttTransport) != null && r.connected) && this._emit("transport-failover", { from: "webrtc", to: "mqtt" }), !this._allDcDead && i && this._emit("transport-failover", { from: "mqtt", to: "webrtc" }), this.bonding ? this.bonding.updatePaths(e, t) : (this.bonding = new ns({
      senders: e,
      linkIds: t,
      monitor: this.monitor
    }), this.bonding.onProgress((o) => {
      this._emit("progress", o);
    }), this.bonding.onComplete(({ transferId: o, data: a }) => {
      const h = this._pendingMeta.get(o);
      h ? (this._pendingMeta.delete(o), this._emit("file", { ...h, data: a, transferId: o })) : this._emit("data", { data: a, transferId: o });
    }));
  }
  _startMQTTTransport() {
    if (!this.mqttConfig || !this.bondTransports && !this.mqttConfig.dataTransport || this._bondSet && !this._bondSet.has("mqtt") && !this.mqttConfig.dataTransport || !this.signaling) return;
    const e = this.signaling.peerId || "qdp-" + Array.from(crypto.getRandomValues(new Uint8Array(8))).map((s) => s.toString(16).padStart(2, "0")).join(""), t = this.signaling.remotePeerId;
    if (t) {
      if (this._mqttTransportOpts = {
        brokerUrl: this.mqttConfig.brokerUrl,
        roomCode: this.roomCode,
        localPeerId: e,
        remotePeerId: t,
        username: this.mqttConfig.username,
        password: this.mqttConfig.password,
        qos: this.mqttConfig.qos,
        keepalive: this.mqttConfig.keepalive,
        topicPrefix: this.mqttConfig.topicPrefix,
        maxPayload: this.mqttConfig.maxPayload,
        protocolVersion: this.mqttConfig.protocolVersion,
        topicAlias: this.mqttConfig.topicAlias,
        messageExpiry: this.mqttConfig.messageExpiry,
        e2e: this._e2e,
        server: this.mqttConfig.server
      }, this.mqttConfig.brokerUrls && this.mqttConfig.brokerUrls.length > 1) {
        this._mqttTransport = new Qt({
          brokerUrls: this.mqttConfig.brokerUrls,
          roomCode: this.roomCode,
          localPeerId: e,
          remotePeerId: t,
          username: this.mqttConfig.username,
          password: this.mqttConfig.password,
          qos: this.mqttConfig.qos,
          keepalive: this.mqttConfig.keepalive,
          topicPrefix: this.mqttConfig.topicPrefix,
          maxPayload: this.mqttConfig.maxPayload,
          protocolVersion: this.mqttConfig.protocolVersion,
          topicAlias: this.mqttConfig.topicAlias,
          messageExpiry: this.mqttConfig.messageExpiry,
          e2e: this._e2e,
          server: this.mqttConfig.server,
          onData: (s) => {
            this._routeIncoming(s, "mqtt-0");
          },
          onOpen: () => {
            this._mqttReconnectAttempt = 0, this.monitor.addLink("mqtt-0"), this._updateBondingPaths(), this._startMQTTProbing(), this._emit("transport-added", { type: "mqtt", linkId: "mqtt-0" }), this._allDcDead && this._emit("transport-failover", { from: "webrtc", to: "mqtt" });
          },
          onClose: () => {
            this._stopMQTTProbing(), this.monitor.removeLink("mqtt-0"), this._updateBondingPaths(), this._emit("transport-removed", { type: "mqtt", linkId: "mqtt-0" }), this._scheduleMQTTReconnect();
          }
        }), this._mqttTransport.connect();
        return;
      }
      this._connectMQTTTransport();
    }
  }
  _connectMQTTTransport() {
    this._mqttTransportOpts && (this._mqttTransport = new vt({
      ...this._mqttTransportOpts,
      onData: (e) => {
        this._routeIncoming(e, "mqtt-0");
      },
      onOpen: () => {
        this._mqttReconnectAttempt = 0, this.monitor.addLink("mqtt-0"), this._updateBondingPaths(), this._startMQTTProbing(), this._emit("transport-added", { type: "mqtt", linkId: "mqtt-0" }), this._allDcDead && this._emit("transport-failover", { from: "webrtc", to: "mqtt" });
      },
      onClose: () => {
        this._stopMQTTProbing(), this.monitor.removeLink("mqtt-0"), this._updateBondingPaths(), this._emit("transport-removed", { type: "mqtt", linkId: "mqtt-0" }), this.pool && this.pool.getOpenCount() > 0 ? this._emit("transport-failover", { from: "mqtt", to: "webrtc" }) : this._emit("transport-failover", { from: "mqtt", to: "none" }), this._scheduleMQTTReconnect();
      }
    }), this._mqttTransport.connect());
  }
  _scheduleMQTTReconnect() {
    if (this._mqttReconnectTimer || !this._mqttTransportOpts) return;
    this._mqttReconnectAttempt++;
    const s = Math.min(1e3 * Math.pow(2, this._mqttReconnectAttempt - 1), 3e4);
    this._mqttReconnectTimer = setTimeout(() => {
      this._mqttReconnectTimer = null, this._mqttTransportOpts && this._connectMQTTTransport();
    }, s);
  }
  _startWebTransport() {
    var t;
    if (!this.webTransportConfig || !this.signaling) return;
    const e = this.signaling.remotePeerId;
    e && (this._webTransport = new zt({
      url: this.webTransportConfig.url,
      roomCode: this.roomCode,
      localPeerId: this.signaling.peerId || ((t = this._mqttTransportOpts) == null ? void 0 : t.localPeerId) || "qdp-wt",
      remotePeerId: e,
      reliable: this.webTransportConfig.reliable ?? !1,
      server: this.webTransportConfig.server,
      onData: (s) => {
        this._routeIncoming(s, "wt-0");
      },
      onOpen: () => {
        this.monitor.addLink("wt-0"), this._updateBondingPaths(), this._startWebTransportProbing(), this._emit("transport-added", { type: "webtransport", linkId: "wt-0" });
      },
      onClose: () => {
        this._stopWebTransportProbing(), this.monitor.removeLink("wt-0"), this._updateBondingPaths(), this._emit("transport-removed", { type: "webtransport", linkId: "wt-0" });
      }
    }), this._webTransport.connect());
  }
  _startWebTransportProbing() {
    this._wtProbeTimer || (this._wtProbeTimer = setInterval(() => {
      var e;
      (e = this._webTransport) != null && e.connected && this.monitor.sendProbe("wt-0", (t) => {
        this._webTransport.send(t);
      });
    }, 2e3));
  }
  _stopWebTransportProbing() {
    this._wtProbeTimer && (clearInterval(this._wtProbeTimer), this._wtProbeTimer = null);
  }
  _startICMPTransport() {
    var e, t;
    this.icmpConfig && (this._icmpTransport = new ts({
      targetIp: this.icmpConfig.targetIp,
      strategy: this.icmpConfig.strategy || "relay",
      relayUrl: this.icmpConfig.relayUrl,
      nativeBridge: this.icmpConfig.nativeBridge,
      identifier: this.icmpConfig.identifier,
      roomCode: this.roomCode,
      localPeerId: (e = this.signaling) == null ? void 0 : e.peerId,
      remotePeerId: (t = this.signaling) == null ? void 0 : t.remotePeerId,
      pingInterval: this.icmpConfig.pingInterval,
      server: this.icmpConfig.server,
      onData: (s) => {
        this._routeIncoming(s, "icmp-0");
      },
      onOpen: () => {
        this.monitor.addLink("icmp-0"), this._updateBondingPaths(), this._startICMPProbing(), this._emit("transport-added", { type: "icmp", linkId: "icmp-0" });
      },
      onClose: () => {
        this._stopICMPProbing(), this.monitor.removeLink("icmp-0"), this._updateBondingPaths(), this._emit("transport-removed", { type: "icmp", linkId: "icmp-0" });
      },
      onLatency: (s) => {
        this._emit("icmp-latency", s);
      }
    }), this._icmpTransport.connect().catch(() => {
    }));
  }
  _startICMPProbing() {
    this._icmpProbeTimer || (this._icmpProbeTimer = setInterval(() => {
      var e;
      (e = this._icmpTransport) != null && e.connected && this.monitor.sendProbe("icmp-0", (t) => {
        this._icmpTransport.send(t).catch(() => {
        });
      });
    }, 3e3));
  }
  _stopICMPProbing() {
    this._icmpProbeTimer && (clearInterval(this._icmpProbeTimer), this._icmpProbeTimer = null);
  }
  _startSRTPTransport() {
    var e, t;
    if (this.srtpConfig && (this._srtpTransport = new ss({
      iceServers: this.srtpConfig.iceServers || this.iceServers,
      roomCode: this.roomCode,
      localPeerId: (e = this.signaling) == null ? void 0 : e.peerId,
      remotePeerId: (t = this.signaling) == null ? void 0 : t.remotePeerId,
      signaling: this.signaling,
      sampleRate: this.srtpConfig.sampleRate || 48e3,
      server: this.srtpConfig.server,
      onData: (s) => {
        this._routeIncoming(s, "srtp-0");
      },
      onOpen: () => {
        this.monitor.addLink("srtp-0"), this._updateBondingPaths(), this._emit("transport-added", { type: "srtp", linkId: "srtp-0" });
      },
      onClose: () => {
        this.monitor.removeLink("srtp-0"), this._updateBondingPaths(), this._emit("transport-removed", { type: "srtp", linkId: "srtp-0" });
      }
    }), this._srtpTransport.connect(this.isOfferer).catch(() => {
    }), this.signaling)) {
      const s = this.signaling.onMessage;
      this.signaling.onMessage = (n) => {
        n && (n.type === "srtp-offer" || n.type === "srtp-answer" || n.type === "srtp-ice") && this._srtpTransport.handleSignalingMessage(n), s && s(n);
      };
    }
  }
  _routeIncoming(e, t) {
    const s = new Uint8Array(e);
    if (s.length < 1) return;
    const n = s[0], i = e.slice(1);
    switch (n) {
      case k.CHUNK:
        this._handleChunkData(i, t);
        break;
      case k.MESSAGE:
        this.message && this.message.handleIncoming(i);
        break;
      case k.PROXY:
        this._handleProxyData(i);
        break;
      case k.STREAM:
        this.stream && this.stream.handleIncoming(i);
        break;
      default:
        this._handleChunkData(e, t);
        break;
    }
  }
  _handleChunkData(e, t) {
    const s = is(e);
    if (s.flags & z.PROBE) {
      this._handleProbe(s, t);
      return;
    }
    if (s.flags & z.META) {
      const n = os(s.payload);
      this._pendingMeta.set(s.transferId, n), this._emit("file-incoming", { transferId: s.transferId, ...n });
      return;
    }
    s.flags & z.DATA && this.bonding && this.bonding.receiveChunk(s);
  }
  _handleProxyData(e) {
    if (this._proxyRelay && this._proxyRelay._active) {
      new DataView(e).getUint8(0) === S.REQUEST ? this._proxyRelay.handleFromClient(e) : this._proxyRelay.handleFromServer(e);
      return;
    }
    new DataView(e).getUint8(0) === S.REQUEST ? this._proxyServer && this._proxyServer.handleIncoming(e) : this._proxyClient && this._proxyClient.handleIncoming(e);
  }
  _startProbing() {
    const e = this.serverMode ? 8e3 : 3e3;
    for (const t of this.pool.openChannels) {
      const s = `dc-${t}`;
      this.monitor.addLink(s);
      const n = setInterval(async () => {
        const i = at(performance.now());
        try {
          await this.pool.sendOnChannel(t, M(k.CHUNK, i)), this.monitor.recordProbeSent(s);
        } catch {
        }
      }, e);
      this._probeTimers.set(s, n);
    }
  }
  _handleProbe(e, t) {
    if (e.payload) {
      const s = as(e.payload), n = performance.now() - s;
      n > 0 && n < 3e4 && this.monitor.recordProbeResponse(t, n);
    }
  }
  _startMQTTProbing() {
    if (!this._mqttTransport) return;
    const e = this.serverMode ? 1e4 : 5e3, t = "mqtt-0";
    if (this._probeTimers.has(t)) return;
    const s = setInterval(async () => {
      if (!this._mqttTransport || !this._mqttTransport.connected) return;
      const n = at(performance.now());
      try {
        await this._mqttTransport.send(M(k.CHUNK, n)), this.monitor.recordProbeSent(t);
      } catch {
      }
    }, e);
    this._probeTimers.set(t, s);
  }
  _stopMQTTProbing() {
    const e = this._probeTimers.get("mqtt-0");
    e && (clearInterval(e), this._probeTimers.delete("mqtt-0"));
  }
}
const Gs = Ts;
class Js {
  constructor(e = [], t = {}) {
    this._brokerConfigs = e, this._connections = [], this._topicFilter = t.topicFilter || null, this._topicRewrite = t.topicRewrite || null, this._closed = !1, this.onRelay = t.onRelay || null, this.onOpen = t.onOpen || null, this.onClose = t.onClose || null;
  }
  start() {
    this._closed = !1, this._brokerConfigs.forEach((e, t) => {
      const s = {
        config: e,
        index: t,
        ws: null,
        connected: !1,
        packetId: 0,
        recvBuf: new Uint8Array(0),
        pingInterval: null,
        clientId: "qdp-bridge-" + t + "-" + Array.from(crypto.getRandomValues(new Uint8Array(4))).map((n) => n.toString(16).padStart(2, "0")).join("")
      };
      this._connections.push(s), this._connectBroker(s);
    });
  }
  stop() {
    this._closed = !0;
    for (const e of this._connections) {
      if (e.pingInterval && clearInterval(e.pingInterval), e.ws)
        try {
          e.ws.readyState === WebSocket.OPEN && e.ws.send(Be()), e.ws.close();
        } catch {
        }
      e.connected = !1;
    }
    this._connections = [];
  }
  get connectedCount() {
    return this._connections.filter((e) => e.connected).length;
  }
  _connectBroker(e) {
    const t = new WebSocket(e.config.brokerUrl, ["mqtt"]);
    t.binaryType = "arraybuffer", e.ws = t, t.onopen = () => {
      t.send(Me(
        e.clientId,
        e.config.username || null,
        e.config.password || null,
        e.config.keepalive || 30
      ));
    }, t.onmessage = (s) => {
      const n = new Uint8Array(s.data), i = new Uint8Array(e.recvBuf.length + n.length);
      i.set(e.recvBuf), i.set(n, e.recvBuf.length), e.recvBuf = i, this._processBuffer(e);
    }, t.onclose = () => {
      e.connected = !1, e.pingInterval && clearInterval(e.pingInterval), !this._closed && this.onClose && this.onClose(e.index);
    }, t.onerror = () => {
    };
  }
  _processBuffer(e) {
    for (; e.recvBuf.length >= 2; ) {
      const t = We(e.recvBuf);
      if (!t) break;
      e.recvBuf = e.recvBuf.slice(t.totalLen), this._handlePacket(e, t);
    }
  }
  _handlePacket(e, t) {
    switch (t.type) {
      case T.CONNACK: {
        if (t.data[t.payloadStart + 1] === 0) {
          e.connected = !0, e.pingInterval = setInterval(() => {
            var r;
            ((r = e.ws) == null ? void 0 : r.readyState) === WebSocket.OPEN && e.ws.send(Fe());
          }, (e.config.keepalive || 30) * 1e3 * 0.75);
          const n = e.config.topics || [`${e.config.topicPrefix || "qdp"}/#`], i = ++e.packetId & 65535 || 1;
          e.ws.send(qe(i, n, e.config.qos || 1)), this.onOpen && this.onOpen(e.index);
        }
        break;
      }
      case T.PUBLISH: {
        const s = He(t.firstByte, t.data, t.payloadStart, t.remainingLen);
        s.qos === 1 && s.packetId > 0 && e.ws.send(Ne(s.packetId)), this._relayMessage(e, s.topic, s.payload);
        break;
      }
    }
  }
  _relayMessage(e, t, s) {
    var i;
    if (this._topicFilter && !this._topicFilter(t)) return;
    const n = this._topicRewrite ? this._topicRewrite(t) : t;
    for (const r of this._connections) {
      if (r === e || !r.connected) continue;
      const o = ++r.packetId & 65535 || 1, a = Le(n, s, r.config.qos || 1, o);
      ((i = r.ws) == null ? void 0 : i.readyState) === WebSocket.OPEN && r.ws.send(a);
    }
    this.onRelay && this.onRelay({ topic: n, sourceIndex: e.index });
  }
}
const Pe = {
  cloudflare: "https://cloudflare-dns.com/dns-query",
  google: "https://dns.google/resolve",
  quad9: "https://dns.quad9.net:5053/dns-query"
}, ks = 63, xs = 253;
function As(c) {
  const e = "0123456789abcdefghijklmnopqrstuvwxyz";
  let t = "";
  for (let s = 0; s < c.length; s++)
    t += e[c[s] % 36], t += e[Math.floor(c[s] / 36) % 36];
  return t;
}
function Rs(c) {
  const e = "0123456789abcdefghijklmnopqrstuvwxyz", t = [];
  for (let s = 0; s < c.length; s += 2) {
    const n = e.indexOf(c[s]), i = e.indexOf(c[s + 1] || "0");
    t.push(i * 36 + n & 255);
  }
  return new Uint8Array(t);
}
function Es(c, e) {
  const t = [];
  let s = 0;
  const n = ks, i = e.length + 2, r = xs - i;
  let o = 0;
  for (; s < c.length && o < r; ) {
    const a = Math.min(n, c.length - s, r - o - 1);
    t.push(c.slice(s, s + a)), s += a, o += a + 1;
  }
  return t.join(".") + "." + e;
}
function Us(c, e) {
  const t = new TextEncoder(), s = crypto.getRandomValues(new Uint8Array(2)), n = new Uint8Array([1, 0]), i = new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0]), r = c.split("."), o = [];
  for (const u of r) {
    const _ = t.encode(u);
    o.push(new Uint8Array([_.length])), o.push(_);
  }
  o.push(new Uint8Array([0]));
  const a = new Uint8Array([e >> 8 & 255, e & 255]), h = new Uint8Array([0, 1]);
  let l = s.length + n.length + i.length + h.length + a.length;
  for (const u of o) l += u.length;
  const d = new Uint8Array(l);
  let f = 0;
  d.set(s, f), f += s.length, d.set(n, f), f += n.length, d.set(i, f), f += i.length;
  for (const u of o)
    d.set(u, f), f += u.length;
  return d.set(a, f), f += a.length, d.set(h, f), d;
}
function Os(c) {
  let e = "";
  for (let t = 0; t < c.length; t++) e += String.fromCharCode(c[t]);
  return btoa(e).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
class zs {
  constructor(e = {}) {
    this.resolver = e.resolver || "cloudflare", this.baseDomain = e.baseDomain, this.roomCode = e.roomCode, this.localPeerId = e.localPeerId, this.remotePeerId = e.remotePeerId, this.pollInterval = e.pollInterval || 250, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this._resolverUrl = typeof this.resolver == "string" && Pe[this.resolver] ? Pe[this.resolver] : this.resolver || Pe.cloudflare, this._closed = !1, this._pollTimer = null, this._seqSend = 0, this._seqRecv = 0, this._useJSON = this._resolverUrl.includes("dns.google");
  }
  connect() {
    if (this._serverConfig) return this._connectServer();
    if (!this.baseDomain) throw new Error("DoHTransport: baseDomain is required");
    return this._closed = !1, new Promise((e) => {
      this.connected = !0, this._startPolling(), this.onOpen && this.onOpen(), e();
    });
  }
  _connectServer() {
    return this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "doh",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, this.onClose && this.onClose();
      }
    }), this._relay.connect();
  }
  async send(e) {
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    if (!this.connected || this._closed) return;
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e), s = As(t), i = `s${this._seqSend++}.${this.localPeerId}.${this.roomCode}`, r = Es(i + "." + s, this.baseDomain);
    this._useJSON ? await this._queryJSON(r, "TXT") : await this._queryWire(r, 16);
  }
  async _queryJSON(e, t) {
    try {
      return await (await fetch(`${this._resolverUrl}?name=${encodeURIComponent(e)}&type=${t}`, {
        headers: { Accept: "application/dns-json" }
      })).json();
    } catch {
      return null;
    }
  }
  async _queryWire(e, t) {
    try {
      const s = Us(e, t), n = Os(s), i = await fetch(`${this._resolverUrl}?dns=${n}`, {
        headers: { Accept: "application/dns-message" }
      });
      return new Uint8Array(await i.arrayBuffer());
    } catch {
      return null;
    }
  }
  _startPolling() {
    this._closed || (this._pollTimer = setInterval(async () => {
      if (this._closed) return;
      const e = `r${this._seqRecv}.${this.remotePeerId}.${this.roomCode}.${this.baseDomain}`;
      let t;
      if (this._useJSON) {
        if (t = await this._queryJSON(e, "TXT"), t && t.Answer) {
          for (const s of t.Answer)
            if (s.data) {
              const n = s.data.replace(/"/g, ""), i = Rs(n);
              this._seqRecv++, this.onData && this.onData(i.buffer);
            }
        }
      } else
        t = await this._queryWire(e, 16), t && t.length > 12 && (this._seqRecv++, this.onData && this.onData(t.buffer));
    }, this.pollInterval));
  }
  close() {
    this._closed = !0, this.connected = !1, this._pollTimer && (clearInterval(this._pollTimer), this._pollTimer = null), this._relay && (this._relay.close(), this._relay = null), this.onClose && this.onClose();
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
}
class Xs {
  constructor(e = {}) {
    this.workerUrl = e.workerUrl, this.roomCode = e.roomCode, this.localPeerId = e.localPeerId, this.remotePeerId = e.remotePeerId, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this._ws = null, this._closed = !1;
  }
  connect() {
    if (this._serverConfig) return this._connectServer();
    if (!this.workerUrl) throw new Error("CDNTransport: workerUrl is required");
    return this._closed = !1, new Promise((e, t) => {
      const s = new URL(this.workerUrl);
      s.pathname = "/websocket", this.roomCode && s.searchParams.set("room", this.roomCode), this.localPeerId && s.searchParams.set("peer", this.localPeerId), this.remotePeerId && s.searchParams.set("remote", this.remotePeerId), this._ws = new WebSocket(s.toString()), this._ws.binaryType = "arraybuffer";
      const n = setTimeout(() => {
        this.connected || (this._ws.close(), t(new Error("CDNTransport: connection timeout")));
      }, 15e3);
      this._ws.onopen = () => {
        clearTimeout(n), this.connected = !0, this.onOpen && this.onOpen(), e();
      }, this._ws.onmessage = (i) => {
        this.onData && this.onData(i.data);
      }, this._ws.onclose = () => {
        clearTimeout(n), this.connected = !1, !this._closed && this.onClose && this.onClose();
      }, this._ws.onerror = () => {
        clearTimeout(n), this.connected || t(new Error("CDNTransport: connection failed"));
      };
    });
  }
  _connectServer() {
    return this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "cdn",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, this.onClose && this.onClose();
      }
    }), this._relay.connect();
  }
  async send(e) {
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    !this._ws || this._ws.readyState !== WebSocket.OPEN || this._ws.send(e);
  }
  close() {
    if (this._closed = !0, this.connected = !1, this._ws) {
      try {
        this._ws.close();
      } catch {
      }
      this._ws = null;
    }
    this._relay && (this._relay.close(), this._relay = null), this.onClose && this.onClose();
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
}
class Qs {
  constructor(e = {}) {
    this.serverUrl = e.serverUrl, this.roomCode = e.roomCode, this.localPeerId = e.localPeerId, this.remotePeerId = e.remotePeerId, this.pollMode = e.pollMode || !1, this.pollInterval = e.pollInterval || 100, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this._eventSource = null, this._closed = !1, this._pollTimer = null, this._lastEventId = "0";
  }
  connect() {
    if (this._serverConfig) return this._connectServer();
    if (!this.serverUrl) throw new Error("SSETransport: serverUrl is required");
    return this._closed = !1, this.pollMode ? this._connectPolling() : this._connectSSE();
  }
  _connectServer() {
    return this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "sse",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, this.onClose && this.onClose();
      }
    }), this._relay.connect();
  }
  _connectSSE() {
    return new Promise((e, t) => {
      const s = new URL(this.serverUrl);
      s.pathname = s.pathname.replace(/\/$/, "") + "/events", this.roomCode && s.searchParams.set("room", this.roomCode), this.localPeerId && s.searchParams.set("peer", this.localPeerId), this.remotePeerId && s.searchParams.set("remote", this.remotePeerId), this._eventSource = new EventSource(s.toString());
      const n = setTimeout(() => {
        this.connected || (this._eventSource.close(), t(new Error("SSETransport: connection timeout")));
      }, 15e3);
      this._eventSource.onopen = () => {
        clearTimeout(n), this.connected = !0, this.onOpen && this.onOpen(), e();
      }, this._eventSource.addEventListener("data", (i) => {
        if (!this._closed) {
          this._lastEventId = i.lastEventId || this._lastEventId;
          try {
            const r = Uint8Array.from(atob(i.data), (o) => o.charCodeAt(0));
            this.onData && this.onData(r.buffer);
          } catch {
          }
        }
      }), this._eventSource.onerror = () => {
        clearTimeout(n), this.connected ? (this.connected = !1, !this._closed && this.onClose && this.onClose()) : t(new Error("SSETransport: connection failed"));
      };
    });
  }
  _connectPolling() {
    return new Promise((e) => {
      this.connected = !0, this._startPolling(), this.onOpen && this.onOpen(), e();
    });
  }
  _startPolling() {
    this._pollTimer = setInterval(async () => {
      if (!this._closed)
        try {
          const e = new URL(this.serverUrl);
          e.pathname = e.pathname.replace(/\/$/, "") + "/poll", e.searchParams.set("room", this.roomCode), e.searchParams.set("peer", this.localPeerId), e.searchParams.set("remote", this.remotePeerId), e.searchParams.set("after", this._lastEventId);
          const t = await fetch(e.toString());
          if (!t.ok) return;
          const s = await t.json();
          if (!Array.isArray(s)) return;
          for (const n of s)
            if (n.id && (this._lastEventId = n.id), n.data) {
              const i = Uint8Array.from(atob(n.data), (r) => r.charCodeAt(0));
              this.onData && this.onData(i.buffer);
            }
        } catch {
        }
    }, this.pollInterval);
  }
  async send(e) {
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    if (!this.connected || this._closed) return;
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e);
    let s = "";
    for (let r = 0; r < t.length; r++) s += String.fromCharCode(t[r]);
    const n = btoa(s), i = new URL(this.serverUrl);
    i.pathname = i.pathname.replace(/\/$/, "") + "/send", i.searchParams.set("room", this.roomCode), i.searchParams.set("peer", this.localPeerId), i.searchParams.set("remote", this.remotePeerId);
    try {
      await fetch(i.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: n })
      });
    } catch {
    }
  }
  close() {
    this._closed = !0, this.connected = !1, this._eventSource && (this._eventSource.close(), this._eventSource = null), this._pollTimer && (clearInterval(this._pollTimer), this._pollTimer = null), this._relay && (this._relay.close(), this._relay = null), this.onClose && this.onClose();
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
}
const Te = 3, Ds = 6, Ms = 7, ke = 8, xe = 9, Ae = 18, pt = 19, Ls = 22, Re = 6, ae = 20, ce = 21, qs = 25, Fs = 12, G = 554869826;
function he() {
  return crypto.getRandomValues(new Uint8Array(12));
}
function Ee(c, e, t) {
  const s = e ^ G >> 16, n = c.split(".").map(Number), i = [G >> 24 & 255, G >> 16 & 255, G >> 8 & 255, G & 255], r = n.map((a, h) => a ^ i[h]), o = new Uint8Array(8);
  return o[0] = 0, o[1] = 1, o[2] = s >> 8 & 255, o[3] = s & 255, o.set(r, 4), o;
}
function le(c, e, t) {
  let s = 0;
  for (const o of t)
    s += 4 + o.value.length, o.value.length % 4 !== 0 && (s += 4 - o.value.length % 4);
  const n = new Uint8Array(20 + s), i = new DataView(n.buffer);
  i.setUint16(0, c), i.setUint16(2, s), i.setUint32(4, G), n.set(e, 8);
  let r = 20;
  for (const o of t) {
    i.setUint16(r, o.type), r += 2, i.setUint16(r, o.value.length), r += 2, n.set(o.value, r), r += o.value.length;
    const a = o.value.length % 4 === 0 ? 0 : 4 - o.value.length % 4;
    r += a;
  }
  return n;
}
function de(c) {
  if (c.length < 20) return null;
  const e = new DataView(c.buffer, c.byteOffset), t = e.getUint16(0), s = e.getUint16(2), n = c.slice(8, 20), i = [];
  let r = 20;
  const o = 20 + s;
  for (; r + 4 <= o; ) {
    const a = e.getUint16(r);
    r += 2;
    const h = e.getUint16(r);
    r += 2;
    const l = c.slice(r, r + h);
    i.push({ type: a, value: l }), r += h, h % 4 !== 0 && (r += 4 - h % 4);
  }
  return { type: t, txId: n, attributes: i };
}
class Ys {
  constructor(e = {}) {
    this.turnUrl = e.turnUrl, this.username = e.username || "", this.credential = e.credential || "", this.peerIp = e.peerIp || "0.0.0.0", this.peerPort = e.peerPort || 49152, this.roomCode = e.roomCode, this.localPeerId = e.localPeerId, this.remotePeerId = e.remotePeerId, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this._ws = null, this._closed = !1, this._channelNumber = 16384, this._channelBound = !1, this._realm = "", this._nonce = "", this._relayedAddr = null;
  }
  connect() {
    if (this._serverConfig) return this._connectServer();
    if (!this.turnUrl) throw new Error("TURNTransport: turnUrl is required");
    return this._closed = !1, new Promise((e, t) => {
      const s = this.turnUrl.replace(/^turn:/, "ws:").replace(/^turns:/, "wss:");
      this._ws = new WebSocket(s), this._ws.binaryType = "arraybuffer";
      const n = setTimeout(() => {
        this.connected || (this._ws.close(), t(new Error("TURNTransport: connection timeout")));
      }, 15e3);
      this._ws.onopen = async () => {
        try {
          await this._allocate(), await this._createPermission(), await this._bindChannel(), clearTimeout(n), this.connected = !0, this._channelBound = !0, this.onOpen && this.onOpen(), e();
        } catch (i) {
          clearTimeout(n), t(i);
        }
      }, this._ws.onmessage = (i) => {
        const r = new Uint8Array(i.data);
        if (r.length >= 4) {
          const a = r[0] << 8 | r[1];
          if (a >= 16384 && a <= 32767) {
            const h = r[2] << 8 | r[3], l = r.slice(4, 4 + h);
            this.onData && this.onData(l.buffer);
            return;
          }
        }
        const o = de(r);
        if (o && o.type === (Ms | 256))
          for (const a of o.attributes)
            a.type === pt && this.onData && this.onData(a.value.buffer);
      }, this._ws.onclose = () => {
        clearTimeout(n), this.connected = !1, this._channelBound = !1, !this._closed && this.onClose && this.onClose();
      }, this._ws.onerror = () => {
        clearTimeout(n), this.connected || t(new Error("TURNTransport: connection failed"));
      };
    });
  }
  _connectServer() {
    return this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "turn",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, this.onClose && this.onClose();
      }
    }), this._relay.connect();
  }
  async _allocate() {
    const e = he(), t = new Uint8Array([17, 0, 0, 0]), s = new TextEncoder().encode(this.username), n = [
      { type: qs, value: t },
      { type: Re, value: s }
    ];
    this._realm && this._nonce && (n.push({ type: ae, value: new TextEncoder().encode(this._realm) }), n.push({ type: ce, value: new TextEncoder().encode(this._nonce) }));
    const i = le(Te, e, n);
    return this._ws.send(i), new Promise((r) => {
      const o = (a) => {
        const h = new Uint8Array(a.data), l = de(h);
        if (l) {
          for (const d of l.attributes)
            d.type === ae && (this._realm = new TextDecoder().decode(d.value)), d.type === ce && (this._nonce = new TextDecoder().decode(d.value)), d.type === Ls && (this._relayedAddr = d.value);
          l.type === (Te | 256) ? (this._ws.removeEventListener("message", o), r()) : l.type === (Te | 272) && this._realm && this._nonce && (this._ws.removeEventListener("message", o), this._allocate().then(r));
        }
      };
      this._ws.addEventListener("message", o);
    });
  }
  async _createPermission() {
    const e = he(), t = Ee(this.peerIp, this.peerPort), s = le(ke, e, [
      { type: Ae, value: t },
      { type: Re, value: new TextEncoder().encode(this.username) },
      { type: ae, value: new TextEncoder().encode(this._realm) },
      { type: ce, value: new TextEncoder().encode(this._nonce) }
    ]);
    return this._ws.send(s), new Promise((n) => {
      const i = (r) => {
        const o = new Uint8Array(r.data), a = de(o);
        a && (a.type === (ke | 256) || a.type === (ke | 272)) && (this._ws.removeEventListener("message", i), n());
      };
      this._ws.addEventListener("message", i);
    });
  }
  async _bindChannel() {
    const e = he(), t = new Uint8Array(4);
    t[0] = this._channelNumber >> 8 & 255, t[1] = this._channelNumber & 255;
    const s = Ee(this.peerIp, this.peerPort), n = le(xe, e, [
      { type: Fs, value: t },
      { type: Ae, value: s },
      { type: Re, value: new TextEncoder().encode(this.username) },
      { type: ae, value: new TextEncoder().encode(this._realm) },
      { type: ce, value: new TextEncoder().encode(this._nonce) }
    ]);
    return this._ws.send(n), new Promise((i) => {
      const r = (o) => {
        const a = new Uint8Array(o.data), h = de(a);
        h && (h.type === (xe | 256) || h.type === (xe | 272)) && (this._ws.removeEventListener("message", r), i());
      };
      this._ws.addEventListener("message", r);
    });
  }
  async send(e) {
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e);
    if (this._channelBound) {
      const s = new Uint8Array(4 + t.length);
      s[0] = this._channelNumber >> 8 & 255, s[1] = this._channelNumber & 255, s[2] = t.length >> 8 & 255, s[3] = t.length & 255, s.set(t, 4), this._ws.send(s);
    } else {
      const s = he(), n = Ee(this.peerIp, this.peerPort), i = le(Ds, s, [
        { type: Ae, value: n },
        { type: pt, value: t }
      ]);
      this._ws.send(i);
    }
  }
  close() {
    if (this._closed = !0, this.connected = !1, this._channelBound = !1, this._ws) {
      try {
        this._ws.close();
      } catch {
      }
      this._ws = null;
    }
    this._relay && (this._relay.close(), this._relay = null), this.onClose && this.onClose();
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
}
const mt = [
  "/api/v2/analytics/events",
  "/api/v1/metrics/collect",
  "/api/v2/telemetry/batch",
  "/api/v1/config/sync",
  "/api/v2/health/check",
  "/api/v1/session/heartbeat",
  "/api/v2/notifications/poll",
  "/api/v1/preferences/update"
];
function Bs(c) {
  const e = c instanceof ArrayBuffer ? new Uint8Array(c) : new Uint8Array(c);
  let t = "";
  for (let n = 0; n < e.length; n++) t += String.fromCharCode(e[n]);
  const s = btoa(t);
  return JSON.stringify({
    timestamp: Date.now(),
    sessionId: Math.random().toString(36).slice(2, 10),
    events: [{ type: "pageview", data: s, seq: Math.floor(Math.random() * 1e4) }],
    version: "2.1.0"
  });
}
function Ns(c) {
  try {
    const e = typeof c == "string" ? JSON.parse(c) : c;
    if (e.events && e.events[0] && e.events[0].data) {
      const t = e.events[0].data, s = atob(t), n = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) n[i] = s.charCodeAt(i);
      return n.buffer;
    }
    if (e.data) {
      const t = atob(e.data), s = new Uint8Array(t.length);
      for (let n = 0; n < t.length; n++) s[n] = t.charCodeAt(n);
      return s.buffer;
    }
  } catch {
  }
  return null;
}
class Zs {
  constructor(e = {}) {
    this.serverUrl = e.serverUrl, this.roomCode = e.roomCode, this.localPeerId = e.localPeerId, this.remotePeerId = e.remotePeerId, this.pollInterval = e.pollInterval || 150, this.jitter = e.jitter || 50, this.rotateEndpoints = e.rotateEndpoints !== !1, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this._closed = !1, this._pollTimer = null, this._seq = 0, this._lastSeq = "0", this._endpointIdx = 0;
  }
  _getEndpoint() {
    if (!this.rotateEndpoints) return "/api/data";
    const e = mt[this._endpointIdx % mt.length];
    return this._endpointIdx++, e;
  }
  _getJitteredInterval() {
    return this.pollInterval + Math.floor(Math.random() * this.jitter);
  }
  connect() {
    if (this._serverConfig) return this._connectServer();
    if (!this.serverUrl) throw new Error("HTTPCamoTransport: serverUrl is required");
    return this._closed = !1, new Promise((e) => {
      this.connected = !0, this._startPolling(), this.onOpen && this.onOpen(), e();
    });
  }
  _connectServer() {
    return this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "httpcamo",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, this.onClose && this.onClose();
      }
    }), this._relay.connect();
  }
  _startPolling() {
    const e = async () => {
      if (!this._closed) {
        try {
          const t = new URL(this.serverUrl);
          t.pathname = this._getEndpoint(), t.searchParams.set("r", this.roomCode), t.searchParams.set("p", this.localPeerId), t.searchParams.set("t", this.remotePeerId), t.searchParams.set("after", this._lastSeq), t.searchParams.set("_", Date.now().toString(36));
          const s = await fetch(t.toString(), {
            headers: {
              Accept: "application/json",
              "X-Requested-With": "XMLHttpRequest"
            }
          });
          if (!s.ok) return;
          const n = await s.json(), i = n.messages || n.events || (Array.isArray(n) ? n : []);
          for (const r of i) {
            const o = Ns(r);
            o && (r.seq && (this._lastSeq = r.seq.toString()), r.id && (this._lastSeq = r.id.toString()), this.onData && this.onData(o));
          }
        } catch {
        }
        this._closed || (this._pollTimer = setTimeout(e, this._getJitteredInterval()));
      }
    };
    this._pollTimer = setTimeout(e, 0);
  }
  async send(e) {
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    if (!this.connected || this._closed) return;
    const t = Bs(e), s = new URL(this.serverUrl);
    s.pathname = this._getEndpoint(), s.searchParams.set("r", this.roomCode), s.searchParams.set("p", this.localPeerId), s.searchParams.set("t", this.remotePeerId), s.searchParams.set("_", Date.now().toString(36));
    try {
      await fetch(s.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json"
        },
        body: t
      });
    } catch {
    }
    this._seq++;
  }
  close() {
    this._closed = !0, this.connected = !1, this._pollTimer && (clearTimeout(this._pollTimer), this._pollTimer = null), this._relay && (this._relay.close(), this._relay = null), this.onClose && this.onClose();
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
}
const X = 2, Ke = 3, Ut = X * Ke, gt = 16;
function Ws(c, e, t) {
  const s = (1 << e) - 1;
  return t & ~s | c & s;
}
function Hs(c, e) {
  return c & (1 << e) - 1;
}
function Ot(c, e, t) {
  const s = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e);
  s.length * 8;
  let n = 0, i = t * 4;
  for (let r = 0; r < s.length && i < c.data.length - 4; r++) {
    const o = s[r];
    for (let a = 7; a >= 0 && i < c.data.length - 4; a -= X) {
      const h = n % Ke, l = Math.floor(n / Ut) * 4 + t * 4;
      if (l + h >= c.data.length) break;
      const d = Math.min(X, a + 1), f = o >> a - d + 1 & (1 << d) - 1;
      c.data[l + h] = Ws(f, d, c.data[l + h]), n++;
    }
  }
  return n;
}
function Dt(c, e, t) {
  const s = new Uint8Array(e);
  let n = 0, i = 0, r = 0, o = 0;
  for (; i < e; ) {
    const a = n % Ke, h = Math.floor(n / Ut) * 4 + t * 4;
    if (h + a >= c.data.length) break;
    const l = Hs(c.data[h + a], X);
    if (r = r << X | l, o += X, o >= 8) {
      const d = o - 8;
      s[i] = r >> d & 255, r &= (1 << d) - 1, o = d, i++;
    }
    n++;
  }
  return s;
}
function $s(c, e) {
  const t = new Uint8Array(4);
  new DataView(t.buffer).setUint32(0, e, !0), Ot(c, t, 0);
}
function js(c) {
  const e = Dt(c, 4, 0);
  return new DataView(e.buffer).getUint32(0, !0);
}
class en {
  constructor(e = {}) {
    this.serverUrl = e.serverUrl, this.roomCode = e.roomCode, this.localPeerId = e.localPeerId, this.remotePeerId = e.remotePeerId, this.imageWidth = e.imageWidth || 256, this.imageHeight = e.imageHeight || 256, this.pollInterval = e.pollInterval || 300, this._serverConfig = e.server || null, this._relay = null, this.connected = !1, this.onData = e.onData || null, this.onOpen = e.onOpen || null, this.onClose = e.onClose || null, this._closed = !1, this._pollTimer = null, this._seq = 0, this._lastSeq = "0", this._canvas = null, this._ctx = null;
  }
  _ensureCanvas() {
    this._canvas || (typeof OffscreenCanvas < "u" ? (this._canvas = new OffscreenCanvas(this.imageWidth, this.imageHeight), this._ctx = this._canvas.getContext("2d")) : typeof document < "u" && (this._canvas = document.createElement("canvas"), this._canvas.width = this.imageWidth, this._canvas.height = this.imageHeight, this._ctx = this._canvas.getContext("2d")));
  }
  connect() {
    if (this._serverConfig) return this._connectServer();
    if (!this.serverUrl) throw new Error("StegTransport: serverUrl is required");
    return this._closed = !1, this._ensureCanvas(), new Promise((e) => {
      this.connected = !0, this._startPolling(), this.onOpen && this.onOpen(), e();
    });
  }
  _connectServer() {
    return this._relay = new L({
      server: this._serverConfig,
      roomCode: this.roomCode,
      localPeerId: this.localPeerId,
      remotePeerId: this.remotePeerId,
      transportType: "steg",
      onData: (e) => {
        this.onData && this.onData(e);
      },
      onOpen: () => {
        this.connected = !0, this.onOpen && this.onOpen();
      },
      onClose: () => {
        this.connected = !1, this.onClose && this.onClose();
      }
    }), this._relay.connect();
  }
  async send(e) {
    if (this._relay) {
      await this._relay.send(e);
      return;
    }
    if (!this.connected || this._closed) return;
    this._ensureCanvas();
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e);
    this._ctx.fillStyle = "#" + Array.from(crypto.getRandomValues(new Uint8Array(3))).map((o) => o.toString(16).padStart(2, "0")).join(""), this._ctx.fillRect(0, 0, this.imageWidth, this.imageHeight);
    for (let o = 0; o < 20; o++) {
      this._ctx.fillStyle = "#" + Array.from(crypto.getRandomValues(new Uint8Array(3))).map((f) => f.toString(16).padStart(2, "0")).join("");
      const a = Math.random() * this.imageWidth, h = Math.random() * this.imageHeight, l = Math.random() * 60 + 10, d = Math.random() * 60 + 10;
      this._ctx.fillRect(a, h, l, d);
    }
    const s = this._ctx.getImageData(0, 0, this.imageWidth, this.imageHeight);
    $s(s, t.length), Ot(s, t, gt), this._ctx.putImageData(s, 0, 0);
    let n;
    this._canvas.convertToBlob ? n = await this._canvas.convertToBlob({ type: "image/png" }) : n = await new Promise((o) => this._canvas.toBlob(o, "image/png"));
    const i = new FormData();
    i.append("image", n, `img_${Date.now()}.png`), i.append("room", this.roomCode), i.append("peer", this.localPeerId), i.append("remote", this.remotePeerId), i.append("seq", (this._seq++).toString());
    const r = new URL(this.serverUrl);
    r.pathname = r.pathname.replace(/\/$/, "") + "/upload";
    try {
      await fetch(r.toString(), {
        method: "POST",
        body: i
      });
    } catch {
    }
  }
  _startPolling() {
    const e = async () => {
      if (!this._closed) {
        try {
          const t = new URL(this.serverUrl);
          t.pathname = t.pathname.replace(/\/$/, "") + "/image", t.searchParams.set("room", this.roomCode), t.searchParams.set("peer", this.localPeerId), t.searchParams.set("remote", this.remotePeerId), t.searchParams.set("after", this._lastSeq), t.searchParams.set("_", Date.now().toString(36));
          const s = await fetch(t.toString());
          if (!s.ok || s.status === 204) {
            this._closed || (this._pollTimer = setTimeout(e, this.pollInterval));
            return;
          }
          const n = s.headers.get("content-type") || "";
          if (n.includes("image/png")) {
            const i = await s.blob(), r = await createImageBitmap(i);
            this._ensureCanvas(), (this._canvas.width !== r.width || this._canvas.height !== r.height) && (this._canvas.width = r.width, this._canvas.height = r.height, this._ctx = this._canvas.getContext("2d")), this._ctx.drawImage(r, 0, 0);
            const o = this._ctx.getImageData(0, 0, r.width, r.height), a = js(o);
            if (a > 0 && a < o.data.length) {
              const l = Dt(o, a, gt);
              this.onData && this.onData(l.buffer);
            }
            const h = s.headers.get("x-seq");
            h && (this._lastSeq = h);
          } else if (n.includes("application/json")) {
            const i = await s.json();
            if (i.images && Array.isArray(i.images)) {
              for (const r of i.images)
                if (r.seq && (this._lastSeq = r.seq.toString()), r.data) {
                  const o = atob(r.data), a = new Uint8Array(o.length);
                  for (let h = 0; h < o.length; h++) a[h] = o.charCodeAt(h);
                  this.onData && this.onData(a.buffer);
                }
            }
          }
        } catch {
        }
        this._closed || (this._pollTimer = setTimeout(e, this.pollInterval));
      }
    };
    this._pollTimer = setTimeout(e, 0);
  }
  close() {
    this._closed = !0, this.connected = !1, this._pollTimer && (clearTimeout(this._pollTimer), this._pollTimer = null), this._relay && (this._relay.close(), this._relay = null), this._canvas = null, this._ctx = null, this.onClose && this.onClose();
  }
  createSender() {
    return async (e) => {
      await this.send(e);
    };
  }
}
export {
  ns as BondingEngine,
  Xs as CDNTransport,
  Tt as ConnectionMonitor,
  kt as DEFAULT_CHUNK_SIZE,
  Xt as DHTSignal,
  Ft as DataChannelPool,
  tt as DirectSignal,
  zs as DoHTransport,
  y as DriveSignal,
  st as E2ECrypto,
  z as Flags,
  _e as HEADER_SIZE,
  Zs as HTTPCamoTransport,
  ts as ICMPTransport,
  D as ICMP_STRATEGY,
  Js as MQTTBridge,
  Qt as MQTTPool,
  Vt as MQTTSignal,
  vt as MQTTTransport,
  Is as MediaManager,
  ls as Messenger,
  ps as ProxyClient,
  S as ProxyFrameType,
  xt as ProxyRelay,
  Ss as ProxyServer,
  Ts as QDP,
  Vs as RelayChain,
  ss as SRTPTransport,
  Qs as SSETransport,
  L as ServerRelay,
  yt as SignalManager,
  Jt as SignalRacer,
  Gs as SpeedRTC,
  en as StegTransport,
  ut as Stream,
  vs as StreamManager,
  Ys as TURNTransport,
  zt as WebTransportTransport,
  is as decodeChunk,
  os as decodeMetaPayload,
  as as decodeProbeTimestamp,
  pe as decodeProxyFrame,
  je as encodeChunk,
  rs as encodeMetaChunk,
  at as encodeProbe,
  ds as encodeRequest,
  ot as splitIntoChunks
};
