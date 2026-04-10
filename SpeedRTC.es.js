var Le = Object.defineProperty;
var De = (l, e, t) => e in l ? Le(l, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : l[e] = t;
var ue = (l, e, t) => De(l, typeof e != "symbol" ? e + "" : e, t);
class Ne {
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
      const r = this.channels[n];
      if (r.bufferedAmount < 524288)
        return r.send(e), n;
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
        this._onOpen = (r) => {
          this._onOpen = n, n && n(r), s();
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
const fe = 0.3, We = 2e4, He = 8e3, Be = 5e3, $e = 4, qe = 1;
class Fe {
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
      }, Be);
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
      this._awaitingResponse = !1, this.latency = this.latency === 0 ? s : fe * s + (1 - fe) * this.latency;
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
class ve {
  constructor(e) {
    this.nodes = e.map((t) => new Fe(t)), this._active = [], this._primary = null, this._pingTimer = null, this._rebalanceTimer = null, this._closed = !1, this.onMessage = null, this.onRebalance = null, this.onNodeJoined = null;
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
      const r = this.nodes.length, i = () => {
        if (!n && this._active.length >= qe) {
          n = !0, this._primary = this._best(), this._startTimers(), e(this._active.length);
          return;
        }
        s >= r && !n && (this._active.length > 0 ? (n = !0, this._primary = this._best(), this._startTimers(), e(this._active.length)) : t(new Error("SignalManager: all trackers failed to connect")));
      };
      for (const c of this.nodes)
        c._onMessage = (a, o) => this._onRawMessage(a, o), c.connect().then((a) => {
          if (s++, this._closed) {
            a.close(), i();
            return;
          }
          this._active.length < $e ? (this._active.push(a), n && (this._rebalance(), this.onNodeJoined && this.onNodeJoined(a.url))) : a.close(), i();
        }).catch(() => {
          s++, i();
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
    }, He), this._rebalanceTimer = setInterval(() => {
      this._rebalance();
    }, We);
  }
  _stopTimers() {
    clearInterval(this._pingTimer), clearInterval(this._rebalanceTimer), this._pingTimer = null, this._rebalanceTimer = null;
  }
  _onRawMessage(e, t) {
    this.onMessage && this.onMessage(e, t);
  }
}
const pe = [
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
class ie {
  constructor(e, t, s = null) {
    this.roomCode = e, this.isOfferer = t;
    const n = Array.from("FRTC" + e).map((i) => i.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    this.infoHash = n.padEnd(40, "0"), this.peerId = Array.from(crypto.getRandomValues(new Uint8Array(20))).map((i) => i.toString(16).padStart(2, "0")).join("");
    const r = s != null && s.length ? [...s] : pe;
    this._manager = new ve(r), this._managerPreConnected = !1, this.remotePeerId = null, this._preferredNodeUrl = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this._announceInterval = null, this._localOfferPayload = null;
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
    var n, r;
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
    if ((r = s.offer) != null && r.sdp) {
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
ue(ie, "DEFAULT_TRACKER_URLS", pe);
const Z = "https://oauth2.googleapis.com/token", _e = "https://www.googleapis.com/auth/spreadsheets", je = "https://accounts.google.com/gsi/client";
let me = !1, X = null;
const ee = /* @__PURE__ */ new Map();
function ge(l) {
  return l ? l.refreshToken ? `refresh:${l.clientId}:${l.refreshToken.slice(-12)}` : l.serviceAccount ? `service:${l.serviceAccount.client_email}` : l.accessToken ? `static:${l.accessToken.slice(-12)}` : null : null;
}
class m {
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
    this.peerId = m._generatePeerId(), this.remotePeerId = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this.connected = !1, this._pollTimer = null, this._myColumn = null, this._remoteColIndex = null, this._readCursor = 1, this._destroyed = !1, this._baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
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
    const t = ge(e);
    if (!t) return;
    const s = ee.get(t);
    if (!(s && Date.now() < s.expiry - 5e3))
      try {
        await new m("__warmup__", !1, e)._ensureToken();
      } catch {
      }
  }
  async connect() {
    try {
      if (this._authMode === "raw") {
        if (await this._registerColumn(), this._lastRawValues && this._myColumn) {
          const e = m._colIndex(this._myColumn);
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
      this._myColumn = m._colLetter(t);
      return;
    }
    const s = e.length;
    this._myColumn = m._colLetter(s), await this._writeCell(`${this._qSheet()}!${this._myColumn}1`, this.peerId);
  }
  async _registerColumn() {
    const e = await this._readHeaders(), t = e.indexOf(this.peerId);
    if (t >= 0) {
      this._myColumn = m._colLetter(t);
      return;
    }
    const s = e.length;
    this._myColumn = m._colLetter(s), await this._writeCell(`${this._qSheet()}!${this._myColumn}1`, this.peerId);
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
            for (let r = this._readCursor; r < e.length; r++) {
              const i = e[r] ? e[r][s] : null;
              if (i)
                try {
                  const c = JSON.parse(i);
                  this.onMessage && this.onMessage(c);
                } catch {
                }
            }
            e.length > this._readCursor && (this._readCursor = e.length);
          }
        }
        if (this._authMode === "raw" && this._myColumn) {
          const s = m._colIndex(this._myColumn);
          let n = 0;
          for (let r = 0; r < e.length; r++)
            e[r] && e[r][s] && (n = r + 1);
          n >= this._myWriteRow && (this._myWriteRow = n);
        }
      } catch {
      }
  }
  async _sheetsRequest(e, t, s) {
    await this._ensureToken();
    const n = e.includes("?") ? "&" : "?", r = !this._accessToken && this._apiKey ? `${n}key=${encodeURIComponent(this._apiKey)}` : "", i = `${this._baseUrl}${e}${r}`, c = { "Content-Type": "application/json" };
    this._accessToken && (c.Authorization = `Bearer ${this._accessToken}`);
    const a = { method: t, headers: c };
    s && (a.body = JSON.stringify(s));
    let o = await fetch(i, a);
    if (o.status === 401 && this._authMode !== "static" && this._authMode !== "apikey" && (this._tokenExpiry = 0, await this._ensureToken(), this._accessToken && (a.headers.Authorization = `Bearer ${this._accessToken}`), o = await fetch(i, a)), !o.ok) {
      const d = new Error(`Sheets API ${t} ${e} → ${o.status}`);
      throw d.status = o.status, d;
    }
    const h = await o.text();
    return h ? JSON.parse(h) : {};
  }
  async _ensureToken() {
    if (this._authMode === "apikey" || this._accessToken && Date.now() < this._tokenExpiry - 5e3) return;
    const e = ge(this._driveConfig);
    if (e) {
      const t = ee.get(e);
      if (t && Date.now() < t.expiry - 5e3) {
        this._accessToken = t.token, this._tokenExpiry = t.expiry;
        return;
      }
    }
    this._authMode === "refresh" ? await this._refreshAccessToken() : this._authMode === "service" ? await this._mintServiceAccountToken() : this._authMode === "client" && await this._requestClientToken(), e && this._accessToken && ee.set(e, { token: this._accessToken, expiry: this._tokenExpiry });
  }
  async _refreshAccessToken() {
    const e = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this._clientId,
      client_secret: this._clientSecret,
      refresh_token: this._refreshToken
    }), t = await fetch(Z, {
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
      scope: _e,
      aud: Z,
      iat: e,
      exp: e + 3600
    }, s = await m._signJwt(t, this._serviceAccount.private_key, this), n = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: s
    }), r = await fetch(Z, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: n.toString()
    });
    if (!r.ok)
      throw new Error(`[DriveSignal] service account token mint failed: ${r.status}`);
    const i = await r.json();
    this._accessToken = i.access_token, this._tokenExpiry = Date.now() + (i.expires_in ? i.expires_in * 1e3 - 3e5 : 3300 * 1e3);
  }
  async _requestClientToken() {
    return await m._loadGisScript(), this._gisTokenClient || (this._gisTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this._clientId,
      scope: _e,
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
    return me && typeof google < "u" && google.accounts ? Promise.resolve() : X || (X = new Promise((e, t) => {
      const s = document.createElement("script");
      s.src = je, s.async = !0, s.onload = () => {
        me = !0, e();
      }, s.onerror = () => t(new Error("[DriveSignal] Failed to load Google Identity Services script")), document.head.appendChild(s);
    }), X);
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
      const { row: s, col: n } = m._parseRange(e);
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
      const r = m._colIndex(e), i = this._myWriteRow;
      return this._myWriteRow++, this._rawWriteCell(i, r, t);
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
    const n = Math.floor(Math.random() * 2147483647), r = Math.floor(Math.random() * 2147483647), i = JSON.stringify([
      [this._rawGid, e, t, e, t],
      [n, 3, [2, s], null, null, 0],
      [null, [[null, 513, [0], null, null, null, null, null, null, null, null, 0]]]
    ]), c = JSON.stringify([{
      commands: [[r, i]],
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
    }), o = `https://docs.google.com/spreadsheets/u/0/d/${this.spreadsheetId}/save?${a}`, h = new FormData();
    h.append("rev", String(this._rawRev)), h.append("bundles", c);
    try {
      await fetch(o, {
        method: "POST",
        body: h,
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
      window[t] = (r) => {
        clearTimeout(s), delete window[t], e(m._parseGvizTable(r));
      };
      const n = document.createElement("script");
      n.src = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=responseHandler:${t}&gid=${this._rawGid}&headers=0&tq=${encodeURIComponent("SELECT *")}`, n.onerror = () => {
        clearTimeout(s), delete window[t], e([]);
      }, document.head.appendChild(n), n.addEventListener("load", () => n.remove());
    });
  }
  static _parseGvizTable(e) {
    return !e || e.status !== "ok" || !e.table ? [] : (e.table.rows || []).map((s) => (s.c || []).map((r) => r && r.v != null ? String(r.v) : ""));
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
      col: m._colIndex(s[1]),
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
    s._signingKey || (s._signingKey = await m._importPem(t));
    const n = { alg: "RS256", typ: "JWT" }, r = [
      m._b64url(JSON.stringify(n)),
      m._b64url(JSON.stringify(e))
    ], i = new TextEncoder().encode(r.join(".")), c = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      s._signingKey,
      i
    );
    return r.push(m._b64urlBuf(c)), r.join(".");
  }
  static async _importPem(e) {
    const t = e.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "").replace(/-----END (?:RSA )?PRIVATE KEY-----/, "").replace(/\s/g, ""), s = atob(t), n = new Uint8Array(s.length);
    for (let r = 0; r < s.length; r++) n[r] = s.charCodeAt(r);
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
class ye {
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
class Ee {
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
class ze {
  constructor({ senders: e = [], linkIds: t = [], monitor: s = null } = {}) {
    this.senders = e, this.linkIds = t, this.monitor = s || new Ee();
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
      const r = t[n], i = e[n], c = this.linkIds[r];
      s.push(
        this.senders[r](i).then(() => {
          this.monitor.recordBytesSent(c, i.byteLength);
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
    const { transferId: t, chunkIndex: s, totalChunks: n, payload: r } = e;
    this._onChunkReceived && this._onChunkReceived(e), this._reassembly.has(t) || this._reassembly.set(t, {
      totalChunks: n,
      received: /* @__PURE__ */ new Map()
    });
    const i = this._reassembly.get(t);
    if (i.received.set(s, r), this._onProgress && this._onProgress({
      transferId: t,
      received: i.received.size,
      total: i.totalChunks,
      percent: i.received.size / i.totalChunks * 100
    }), i.received.size === i.totalChunks) {
      const c = this._assemble(i);
      this._reassembly.delete(t), this._onComplete && this._onComplete({ transferId: t, data: c });
    }
  }
  _refreshWeights() {
    this._wrr.weights = this.monitor.getWeights();
    for (const e of this.linkIds)
      this._wrr.counters.has(e) || this._wrr.counters.set(e, 0);
  }
  _buildSendPlan(e) {
    const t = new Array(e), s = this._wrr.weights, n = /* @__PURE__ */ new Map();
    let r = 0;
    for (let a = 0; a < this.linkIds.length; a++) {
      const o = this.linkIds[a], h = s.get(o) || 1 / this.linkIds.length, d = Math.round(h * e);
      n.set(a, d), r += d;
    }
    if (r < e) {
      const a = this._pickBestSender();
      n.set(a, (n.get(a) || 0) + (e - r));
    } else if (r > e)
      for (let a = this.linkIds.length - 1; a >= 0 && r > e; a--) {
        const o = n.get(a) || 0, h = Math.min(o, r - e);
        n.set(a, o - h), r -= h;
      }
    let i = 0;
    const c = new Map(n);
    for (; i < e; )
      for (let a = 0; a < this.linkIds.length && i < e; a++) {
        const o = c.get(a) || 0;
        o > 0 && (t[i++] = a, c.set(a, o - 1));
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
    for (let r = 0; r < e.totalChunks; r++) {
      const i = e.received.get(r);
      i && (t += i.byteLength);
    }
    const s = new Uint8Array(t);
    let n = 0;
    for (let r = 0; r < e.totalChunks; r++) {
      const i = e.received.get(r);
      i && (s.set(i, n), n += i.byteLength);
    }
    return s.buffer;
  }
}
const V = 13, Ie = 64 * 1024, B = {
  DATA: 1,
  ACK: 2,
  FIN: 4,
  PROBE: 8,
  META: 16
};
function ae({ transferId: l, chunkIndex: e, totalChunks: t, flags: s, payload: n }) {
  const r = n ? n instanceof Uint8Array ? n : new Uint8Array(n) : new Uint8Array(0), i = new ArrayBuffer(V + r.byteLength), c = new DataView(i);
  return c.setUint32(0, l, !0), c.setUint32(4, e, !0), c.setUint32(8, t, !0), c.setUint8(12, s), r.byteLength > 0 && new Uint8Array(i, V).set(r), i;
}
function Ge(l) {
  const e = new DataView(l);
  return {
    transferId: e.getUint32(0, !0),
    chunkIndex: e.getUint32(4, !0),
    totalChunks: e.getUint32(8, !0),
    flags: e.getUint8(12),
    payload: l.byteLength > V ? new Uint8Array(l, V) : null
  };
}
function we(l, e, t = Ie) {
  const s = new Uint8Array(l), n = Math.ceil(s.byteLength / t), r = [];
  for (let i = 0; i < n; i++) {
    const c = i * t, a = Math.min(c + t, s.byteLength), o = s.slice(c, a);
    r.push(
      ae({
        transferId: e,
        chunkIndex: i,
        totalChunks: n,
        flags: B.DATA,
        payload: o
      })
    );
  }
  return r;
}
function Je(l, e) {
  const t = JSON.stringify(e), n = new TextEncoder().encode(t);
  return ae({
    transferId: l,
    chunkIndex: 0,
    totalChunks: 0,
    flags: B.META,
    payload: n
  });
}
function Ke(l) {
  const e = new TextDecoder();
  return JSON.parse(e.decode(l));
}
function Xe(l) {
  const e = new Uint8Array(8);
  return new DataView(e.buffer).setFloat64(0, l, !0), ae({
    transferId: 0,
    chunkIndex: 0,
    totalChunks: 0,
    flags: B.PROBE,
    payload: e
  });
}
function Ve(l) {
  return new DataView(l.buffer, l.byteOffset, l.byteLength).getFloat64(0, !0);
}
const Se = 1, be = 2, Ye = new TextEncoder(), Qe = new TextDecoder();
class Ze {
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
    const t = Ye.encode(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = Se, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  async sendBinary(e) {
    const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = be, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === Se) {
      const n = Qe.decode(t.slice(1));
      this._emit("text", n);
    } else s === be && this._emit("binary", e.slice(1));
  }
}
const b = {
  REQUEST: 1,
  RESPONSE: 2,
  BODY: 3,
  END: 4,
  ERROR: 5
}, J = new TextEncoder(), j = new TextDecoder();
function et(l, e, t, s = {}, n = null) {
  const r = J.encode(e), i = J.encode(t), c = J.encode(JSON.stringify(s)), a = n ? new Uint8Array(n) : new Uint8Array(0), o = 6 + r.length + 2 + i.length + 4 + c.length + a.length, h = new ArrayBuffer(o), d = new DataView(h), u = new Uint8Array(h);
  let f = 0;
  return d.setUint8(f, b.REQUEST), f += 1, d.setUint32(f, l, !0), f += 4, d.setUint8(f, r.length), f += 1, u.set(r, f), f += r.length, d.setUint16(f, i.length, !0), f += 2, u.set(i, f), f += i.length, d.setUint32(f, c.length, !0), f += 4, u.set(c, f), f += c.length, a.length > 0 && u.set(a, f), h;
}
function Ce(l, e, t = {}) {
  const s = J.encode(JSON.stringify(t)), n = 11 + s.length, r = new ArrayBuffer(n), i = new DataView(r), c = new Uint8Array(r);
  let a = 0;
  return i.setUint8(a, b.RESPONSE), a += 1, i.setUint32(a, l, !0), a += 4, i.setUint16(a, e, !0), a += 2, i.setUint32(a, s.length, !0), a += 4, c.set(s, a), r;
}
function z(l, e, t) {
  const s = new Uint8Array(t), n = new ArrayBuffer(9 + s.length), r = new DataView(n);
  return new Uint8Array(n).set(s, 9), r.setUint8(0, b.BODY), r.setUint32(1, l, !0), r.setUint32(5, e, !0), n;
}
function ke(l, e = 0) {
  const t = new ArrayBuffer(9), s = new DataView(t);
  return s.setUint8(0, b.END), s.setUint32(1, l, !0), s.setUint32(5, e, !0), t;
}
function te(l, e) {
  const t = J.encode(e), s = new ArrayBuffer(5 + t.length), n = new DataView(s);
  return new Uint8Array(s).set(t, 5), n.setUint8(0, b.ERROR), n.setUint32(1, l, !0), s;
}
function Ae(l) {
  const e = new DataView(l), t = new Uint8Array(l), s = e.getUint8(0), n = e.getUint32(1, !0);
  switch (s) {
    case b.REQUEST: {
      let r = 5;
      const i = e.getUint8(r);
      r += 1;
      const c = j.decode(t.slice(r, r + i));
      r += i;
      const a = e.getUint16(r, !0);
      r += 2;
      const o = j.decode(t.slice(r, r + a));
      r += a;
      const h = e.getUint32(r, !0);
      r += 4;
      const d = JSON.parse(j.decode(t.slice(r, r + h)));
      r += h;
      const u = r < l.byteLength ? l.slice(r) : null;
      return { type: s, requestId: n, method: c, url: o, headers: d, body: u };
    }
    case b.RESPONSE: {
      let r = 5;
      const i = e.getUint16(r, !0);
      r += 2;
      const c = e.getUint32(r, !0);
      r += 4;
      const a = JSON.parse(j.decode(t.slice(r, r + c)));
      return { type: s, requestId: n, status: i, headers: a };
    }
    case b.BODY: {
      const r = e.getUint32(5, !0);
      return { type: s, requestId: n, seqNum: r, data: l.slice(9) };
    }
    case b.END:
      return { type: s, requestId: n, seqCount: l.byteLength >= 9 ? e.getUint32(5, !0) : 0 };
    case b.ERROR:
      return { type: s, requestId: n, message: j.decode(t.slice(5)) };
    default:
      return { type: s, requestId: n };
  }
}
class tt {
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
let st = 1;
class nt {
  constructor() {
    this._cookies = [];
  }
  store(e, t) {
    if (!t) return;
    const s = Array.isArray(t) ? t : [t], n = this._parseOrigin(e), r = Date.now();
    for (const i of s) {
      const c = i.split(";").map((_) => _.trim()), [a] = c, o = a.indexOf("=");
      if (o < 0) continue;
      const h = a.slice(0, o).trim(), d = a.slice(o + 1).trim();
      let u = n.hostname, f = "/", p = null, S = !1, U = n.protocol === "https:";
      for (let _ = 1; _ < c.length; _++) {
        const [N, C = ""] = c[_].split("=").map((P) => P.trim()), g = N.toLowerCase();
        g === "domain" ? u = C.replace(/^\./, "") : g === "path" ? f = C || "/" : g === "expires" ? p = new Date(C).getTime() : g === "max-age" ? p = r + parseInt(C, 10) * 1e3 : g === "httponly" ? S = !0 : g === "secure" && (U = !0);
      }
      if (p !== null && p < r) {
        this._cookies = this._cookies.filter((_) => !(_.name === h && _.domain === u && _.path === f));
        continue;
      }
      const T = this._cookies.findIndex((_) => _.name === h && _.domain === u && _.path === f), x = { name: h, value: d, domain: u, path: f, expires: p, httpOnly: S, secure: U };
      T >= 0 ? this._cookies[T] = x : this._cookies.push(x);
    }
  }
  get(e) {
    try {
      const { hostname: t, pathname: s, protocol: n } = new URL(e), r = n === "https:", i = Date.now();
      return this._cookies = this._cookies.filter((c) => c.expires === null || c.expires > i), this._cookies.filter((c) => !(c.secure && !r || !t.endsWith(c.domain) && t !== c.domain || !s.startsWith(c.path))).map((c) => `${c.name}=${c.value}`).join("; ") || null;
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
class rt {
  constructor(e) {
    this._send = e, this._pending = /* @__PURE__ */ new Map(), this.cookieJar = new nt(), this._intercepted = !1, this._origFetch = null, this._origXhrOpen = null, this._origXhrSend = null, this._interceptTarget = null, this._interceptFilter = null;
  }
  intercept(e = globalThis, t = null) {
    this._intercepted && this.release(), this._interceptTarget = e, this._interceptFilter = t, this._intercepted = !0, e.__speedrtc_proxy_fetch = (r, i) => this.fetch(r, i), this._messageHandler = (r) => {
      if (!r.data || r.data.type !== "speedrtc-fetch" || !r.source) return;
      const { id: i, url: c, method: a, headers: o, body: h } = r.data;
      this.fetch(c, { method: a, headers: o, body: h }).then(async (d) => {
        const u = await d.arrayBuffer(), f = {};
        d.headers.forEach((p, S) => {
          f[S] = p;
        }), r.source.postMessage({
          type: "speedrtc-fetch-res",
          id: i,
          status: d.status,
          statusText: d.statusText,
          headers: f,
          body: u
        }, "*", [u]);
      }).catch((d) => {
        try {
          r.source.postMessage({
            type: "speedrtc-fetch-res",
            id: i,
            error: d.message || "Fetch failed"
          }, "*");
        } catch {
        }
      });
    }, e.addEventListener("message", this._messageHandler), this._origFetch = e.fetch;
    const s = this;
    e.fetch = function(i, c) {
      let a;
      if (i instanceof Request ? a = i.url : a = String(i), s._shouldIntercept(a)) {
        const o = {};
        if (i instanceof Request && (o.method = i.method, o.headers = {}, i.headers.forEach((h, d) => {
          o.headers[d] = h;
        }), o.credentials = i.credentials, o.mode = i.mode, o.redirect = i.redirect, o.referrer = i.referrer, o.referrerPolicy = i.referrerPolicy, i.body && (o.body = i.body)), c && Object.assign(o, c), c != null && c.headers) {
          const h = {};
          if (o.headers)
            for (const [d, u] of Object.entries(o.headers)) h[d] = u;
          if (c.headers instanceof Headers)
            c.headers.forEach((d, u) => {
              h[u] = d;
            });
          else if (Array.isArray(c.headers))
            for (const [d, u] of c.headers) h[d] = u;
          else
            Object.assign(h, c.headers);
          o.headers = h;
        }
        return s.fetch(a, o);
      }
      return s._origFetch.call(e, i, c);
    };
    const n = e.XMLHttpRequest;
    if (n) {
      this._origXhrOpen = n.prototype.open, this._origXhrSend = n.prototype.send;
      const r = this._origXhrOpen, i = this._origXhrSend;
      n.prototype.open = function(a, o, ...h) {
        return this._speedrtcMethod = a, this._speedrtcUrl = String(o), this._speedrtcHeaders = {}, this._speedrtcAsync = h[0] !== !1, r.call(this, a, o, ...h);
      };
      const c = n.prototype.setRequestHeader;
      this._origXhrSetHeader = c, n.prototype.setRequestHeader = function(a, o) {
        return this._speedrtcHeaders && (this._speedrtcHeaders[a] = o), c.call(this, a, o);
      }, n.prototype.send = function(a) {
        const o = this._speedrtcUrl;
        if (o && s._shouldIntercept(o)) {
          const h = this, d = {
            method: this._speedrtcMethod || "GET",
            headers: this._speedrtcHeaders || {}
          };
          a != null && (d.body = a), s.fetch(o, d).then(async (u) => {
            Object.defineProperty(h, "status", { value: u.status, writable: !1, configurable: !0 }), Object.defineProperty(h, "statusText", { value: u.statusText, writable: !1, configurable: !0 });
            const f = await u.text();
            Object.defineProperty(h, "responseText", { value: f, writable: !1, configurable: !0 }), Object.defineProperty(h, "response", { value: f, writable: !1, configurable: !0 }), Object.defineProperty(h, "readyState", { value: 4, writable: !1, configurable: !0 });
            const p = [];
            u.headers.forEach((S, U) => p.push(`${U}: ${S}`)), Object.defineProperty(h, "_speedrtcRespHeaders", { value: p.join(`\r
`), configurable: !0 }), h.getAllResponseHeaders = () => h._speedrtcRespHeaders, h.getResponseHeader = (S) => u.headers.get(S), h.onreadystatechange && h.onreadystatechange(new Event("readystatechange")), h.onload && h.onload(new Event("load")), h.dispatchEvent(new Event("readystatechange")), h.dispatchEvent(new Event("load")), h.dispatchEvent(new Event("loadend"));
          }).catch((u) => {
            Object.defineProperty(h, "readyState", { value: 4, writable: !1, configurable: !0 }), Object.defineProperty(h, "status", { value: 0, writable: !1, configurable: !0 }), h.onerror && h.onerror(new Event("error")), h.dispatchEvent(new Event("error")), h.dispatchEvent(new Event("loadend"));
          });
          return;
        }
        return i.call(this, a);
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
            const r = s.hostname;
            return r === n || r.endsWith("." + n);
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
    const s = st++, n = (t.method || "GET").toUpperCase(), r = Object.assign({}, t.headers || {});
    let i = null;
    if (t.body) {
      if (typeof t.body == "string")
        i = new TextEncoder().encode(t.body).buffer;
      else if (t.body instanceof ArrayBuffer)
        i = t.body;
      else if (t.body instanceof Uint8Array)
        i = t.body.buffer;
      else if (t.body instanceof URLSearchParams)
        i = new TextEncoder().encode(t.body.toString()).buffer, r["content-type"] || (r["content-type"] = "application/x-www-form-urlencoded");
      else if (t.body instanceof Blob)
        i = await t.body.arrayBuffer(), !r["content-type"] && t.body.type && (r["content-type"] = t.body.type);
      else if (typeof FormData < "u" && t.body instanceof FormData) {
        const o = new Request("/", { method: "POST", body: t.body });
        i = await o.arrayBuffer(), r["content-type"] || (r["content-type"] = o.headers.get("content-type"));
      } else if (typeof ReadableStream < "u" && t.body instanceof ReadableStream) {
        const o = t.body.getReader(), h = [];
        let d = 0;
        for (; ; ) {
          const { done: p, value: S } = await o.read();
          if (p) break;
          h.push(S), d += S.byteLength;
        }
        const u = new Uint8Array(d);
        let f = 0;
        for (const p of h)
          u.set(p, f), f += p.byteLength;
        i = u.buffer;
      }
    }
    t.redirect && (r["x-proxy-opt-redirect"] = t.redirect), t.cache && (r["x-proxy-opt-cache"] = t.cache), t.mode && (r["x-proxy-opt-mode"] = t.mode), t.referrer && (r["x-proxy-opt-referrer"] = t.referrer), t.referrerPolicy && (r["x-proxy-opt-referrerpolicy"] = t.referrerPolicy), t.credentials && (r["x-proxy-opt-credentials"] = t.credentials);
    try {
      const o = new URL(e).origin, h = this.cookieJar.get(e);
      h && !r.cookie && (r.cookie = h);
    } catch {
    }
    const c = t.timeout || 3e4, a = et(s, n, e, r, i);
    return new Promise((o, h) => {
      const d = t.signal;
      let u = !1;
      const f = setTimeout(() => {
        u || (u = !0, this._pending.delete(s), h(new DOMException(`Proxy request timed out: ${n} ${e}`, "TimeoutError")));
      }, c), p = () => {
        u || (u = !0, clearTimeout(f), this._pending.delete(s), h(d.reason || new DOMException("The operation was aborted.", "AbortError")));
      };
      if (d) {
        if (d.aborted) {
          p();
          return;
        }
        d.addEventListener("abort", p, { once: !0 });
      }
      this._pending.set(s, {
        resolve: (S) => {
          d && d.removeEventListener("abort", p), o(S);
        },
        reject: (S) => {
          d && d.removeEventListener("abort", p), h(S);
        },
        timeout: f,
        url: e,
        status: 0,
        headers: {},
        bodyChunks: [],
        totalBodySize: 0,
        seqCount: -1,
        endReceived: !1
      }), this._send(a).catch(h);
    });
  }
  handleIncoming(e) {
    const t = Ae(e), s = this._pending.get(t.requestId);
    if (s)
      switch (t.type) {
        case b.RESPONSE:
          s.status = t.status, s.headers = t.headers;
          break;
        case b.BODY:
          s.bodyChunks.push({ seqNum: t.seqNum, data: new Uint8Array(t.data) }), s.totalBodySize += t.data.byteLength, s.endReceived && s.bodyChunks.length >= s.seqCount && this._resolveRequest(t.requestId, s);
          break;
        case b.END:
          s.seqCount = t.seqCount, s.endReceived = !0, s.bodyChunks.length >= t.seqCount && this._resolveRequest(t.requestId, s);
          break;
        case b.ERROR:
          clearTimeout(s.timeout), this._pending.delete(t.requestId), s.reject(new Error(t.message || "Proxy error"));
          break;
      }
  }
  _resolveRequest(e, t) {
    clearTimeout(t.timeout), this._pending.delete(e), t.bodyChunks.sort((a, o) => a.seqNum - o.seqNum);
    const s = new Uint8Array(t.totalBodySize);
    let n = 0;
    for (const a of t.bodyChunks)
      s.set(a.data, n), n += a.data.length;
    const r = new tt(t.headers), i = r.get("x-speedrtc-compressed") === "gzip", c = r.get("x-speedrtc-set-cookie");
    if (c)
      try {
        const a = JSON.parse(c);
        r._map["set-cookie"] = a.join(`
`);
        try {
          const o = new URL(t.url).origin;
          this.cookieJar.store(o, a);
        } catch {
        }
      } catch {
      }
    i ? this._decompressAndResolve(s.buffer, t, r) : t.resolve(new H(t.status, r, s.buffer));
  }
  async _decompressAndResolve(e, t, s) {
    if (typeof DecompressionStream > "u") {
      t.resolve(new H(t.status, s, e));
      return;
    }
    try {
      const n = new DecompressionStream("gzip"), r = n.writable.getWriter(), i = n.readable.getReader();
      r.write(new Uint8Array(e)), r.close();
      const c = [];
      let a = 0;
      for (; ; ) {
        const { done: d, value: u } = await i.read();
        if (d) break;
        c.push(u), a += u.byteLength;
      }
      const o = new Uint8Array(a);
      let h = 0;
      for (const d of c)
        o.set(d, h), h += d.byteLength;
      t.resolve(new H(t.status, s, o.buffer));
    } catch {
      t.resolve(new H(t.status, s, e));
    }
  }
}
class H {
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
      return new URLSearchParams(t).forEach((n, r) => s.append(r, n)), s;
    }
    return new FormData();
  }
  clone() {
    return new H(this.status, this.headers, this._body.slice(0));
  }
}
const it = 16 * 1024, G = /* @__PURE__ */ new Map(), ot = 200, at = /* @__PURE__ */ new Set([200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501]), ct = /* @__PURE__ */ new Set([
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
]), ht = /* @__PURE__ */ new Set([
  "host",
  "origin",
  "referer"
]), lt = /* @__PURE__ */ new Set([
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
]), se = "<script data-speedrtc>!function(){var _i=0,_c={},_p,h=/^https?:\\/\\//,D=Object.defineProperty;function g(){if(_p)return _p;try{if(_p=window.__speedrtc_proxy_fetch)return _p}catch(e){}try{if(_p=window.parent.__speedrtc_proxy_fetch)return _p}catch(e){}try{if(_p=window.top.__speedrtc_proxy_fetch)return _p}catch(e){}}window.addEventListener('message',function(e){var m=e.data;if(!m||m.type!=='speedrtc-fetch-res')return;var c=_c[m.id];if(!c)return;delete _c[m.id];if(m.error)return c[1](new Error(m.error));c[0](new Response(m.body,{status:m.status,statusText:m.statusText||'',headers:m.headers||{}}))});function P(u,o){var fn=g();if(fn)return fn(u,o||{});var id=++_i;return new Promise(function(ok,no){_c[id]=[ok,no];try{var t=window.parent!==window?window.parent:window.top;t.postMessage({type:'speedrtc-fetch',id:id,url:u,method:(o&&o.method)||'GET',headers:(o&&o.headers)||{},body:(o&&o.body)||null},'*')}catch(e){delete _c[id];no(e)}})}var f=fetch;fetch=function(i,o){var u=i&&i.url||''+i;return h.test(u)?P(u,o||{}):f.apply(this,arguments)};var X=XMLHttpRequest.prototype,O=X.open,S=X.send,H=X.setRequestHeader;X.open=function(m,u){this._m=m;this._u=''+u;this._h={};return O.apply(this,arguments)};X.setRequestHeader=function(n,v){this._h&&(this._h[n]=v);return H.apply(this,arguments)};X.send=function(b){var x=this,u=x._u;if(h.test(u)){var o={method:x._m||'GET',headers:x._h||{}};b!=null&&(o.body=b);P(u,o).then(function(r){D(x,'status',{value:r.status,configurable:1});D(x,'statusText',{value:r.statusText||'',configurable:1});return r.text().then(function(t){D(x,'responseText',{value:t,configurable:1});D(x,'response',{value:t,configurable:1});D(x,'readyState',{value:4,configurable:1});try{x.dispatchEvent(new Event('readystatechange'))}catch(e){}try{x.onreadystatechange&&x.onreadystatechange()}catch(e){}try{x.dispatchEvent(new Event('load'))}catch(e){}try{x.onload&&x.onload()}catch(e){}try{x.dispatchEvent(new Event('loadend'))}catch(e){}})}).catch(function(){D(x,'readyState',{value:4,configurable:1});D(x,'status',{value:0,configurable:1});try{x.dispatchEvent(new Event('error'))}catch(e){}try{x.onerror&&x.onerror()}catch(e){}try{x.dispatchEvent(new Event('loadend'))}catch(e){}});return}return S.apply(this,arguments)};try{var hp=history.pushState,hr=history.replaceState;history.pushState=function(s,t,u){try{return hp.call(this,s,t,u)}catch(e){return hp.call(this,s,t)}};history.replaceState=function(s,t,u){try{return hr.call(this,s,t,u)}catch(e){return hr.call(this,s,t)}}}catch(e){}try{if(navigator.serviceWorker)navigator.serviceWorker.register=function(){return Promise.reject(new Error('blocked'))}}catch(e){}try{var sb=navigator.sendBeacon;if(sb)navigator.sendBeacon=function(u,b){if(h.test(u)){P(u,{method:'POST',body:b});return true}return sb.apply(navigator,arguments)}}catch(e){}try{var wo=window.open;window.open=function(u){if(u&&h.test(u)){try{window.parent.postMessage({type:'speedrtc-nav',url:u},'*')}catch(e){}return null}return wo.apply(this,arguments)}}catch(e){}document.addEventListener('error',function(e){var el=e.target,t,s;if(!el||!el.tagName||el._s)return;t=el.tagName;s=t==='LINK'?el.href||'':el.src||el.currentSrc||el.data||'';if(!h.test(s))return;el._s=1;t==='LINK'&&(el.rel||'').includes('stylesheet')?P(s,{}).then(function(r){return r.text()}).then(function(t){var n=document.createElement('style');n.textContent=t;el.parentNode&&el.parentNode.insertBefore(n,el);el.disabled=1}).catch(function(){}):t==='SCRIPT'?P(s,{}).then(function(r){return r.text()}).then(function(t){var n=document.createElement('script');n.textContent=t;document.head.appendChild(n)}).catch(function(){}):P(s,{}).then(function(r){return r.blob()}).then(function(b){var u=URL.createObjectURL(b);el.src!==void 0?el.src=u:el.data!==void 0&&(el.data=u)}).catch(function(){})},1);document.addEventListener('click',function(e){for(var n=e.target;n;n=n.parentElement)if(n.tagName==='A'&&h.test(n.href||'')){e.preventDefault();e.stopPropagation();try{window.parent.postMessage({type:'speedrtc-nav',url:n.href},'*')}catch(x){}break}},1);document.addEventListener('submit',function(e){var f=e.target,u=f.action||'';if(!h.test(u))return;e.preventDefault();(f.method||'get').toUpperCase()==='GET'&&(u+=(~u.indexOf('?')?'&':'?')+new URLSearchParams(new FormData(f)));try{window.parent.postMessage({type:'speedrtc-nav',url:u},'*')}catch(x){}},1)}()<\/script>";
class dt {
  constructor(e, t = {}) {
    this._send = e, this._allowList = t.allowList || [], this._blockList = t.blockList || [], this._chunkSize = t.chunkSize || it, this._compress = t.compress || !1, this._active = !1;
  }
  serve(e) {
    e && (e.chunkSize != null && (this._chunkSize = e.chunkSize), e.compress != null && (this._compress = e.compress), e.allowList != null && (this._allowList = e.allowList), e.blockList != null && (this._blockList = e.blockList)), this._active = !0;
  }
  stop() {
    this._active = !1;
  }
  async handleIncoming(e) {
    const t = Ae(e);
    if (t.type !== b.REQUEST) return;
    if (!this._active) {
      await this._send(te(t.requestId, "Proxy server not active"));
      return;
    }
    const { requestId: s, method: n, url: r, headers: i, body: c } = t;
    let a = 0;
    if (!this._isDomainAllowed(r)) {
      await this._send(te(s, "Domain not allowed"));
      return;
    }
    try {
      const o = {}, h = {};
      for (const [w, I] of Object.entries(i))
        w.startsWith("x-proxy-opt-") ? h[w.slice(12)] = I : o[w] = I;
      const d = { method: n, headers: o };
      c && n !== "GET" && n !== "HEAD" && (d.body = c), h.redirect && (d.redirect = h.redirect), h.cache && (d.cache = h.cache), h.mode && (d.mode = h.mode), h.referrer && (d.referrer = h.referrer), h.referrerpolicy && (d.referrerPolicy = h.referrerpolicy), h.credentials && (d.credentials = h.credentials);
      const u = new URL(r), f = u.origin, p = u.host, S = o.origin || "";
      let U;
      try {
        const w = new URL(S);
        U = w.origin === f ? "same-origin" : w.hostname.endsWith("." + p) || p.endsWith("." + w.hostname) ? "same-site" : "cross-site";
      } catch {
        U = "none";
      }
      const T = (o.accept || "").toLowerCase();
      let x, _;
      T.includes("text/html") ? (x = "document", _ = "navigate") : T.includes("application/json") || T.startsWith("*/*") ? (x = "empty", _ = "cors") : T.includes("image/") ? (x = "image", _ = "no-cors") : T.includes("text/css") ? (x = "style", _ = "cors") : T.includes("application/javascript") || T.includes("text/javascript") ? (x = "script", _ = "no-cors") : T.includes("font/") ? (x = "font", _ = "cors") : (x = "empty", _ = "cors");
      for (const w of ht) delete o[w];
      o.host = p, o.origin || (o.origin = f), o.referer || (o.referer = u.href), o["user-agent"] || (o["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"), o.accept || (o.accept = "*/*"), o["accept-language"] || (o["accept-language"] = "en-US,en;q=0.9"), o["accept-encoding"] = "identity", o["sec-fetch-site"] = U, o["sec-fetch-mode"] = _, o["sec-fetch-dest"] = x, o["sec-ch-ua"] = '"Google Chrome";v="124", "Chromium";v="124", "Not-A.Brand";v="99"', o["sec-ch-ua-mobile"] = "?0", o["sec-ch-ua-platform"] = '"Windows"', c && (o["content-length"] = String(c.byteLength || 0));
      const N = n === "GET" || n === "HEAD" ? `${n}:${r}` : null, C = N ? G.get(N) : null;
      if (C) {
        const w = o["if-none-match"], I = o["if-modified-since"];
        if (w && w === C.etag || I && C.lastModified && new Date(I) >= new Date(C.lastModified)) {
          await this._send(Ce(s, 304, { etag: C.etag || "", "last-modified": C.lastModified || "" })), await this._send(ke(s));
          return;
        }
        C.etag && (o["if-none-match"] = C.etag), C.lastModified && (o["if-modified-since"] = C.lastModified);
      }
      const g = await fetch(r, d), P = {}, Y = [];
      g.headers.forEach((w, I) => {
        const $ = I.toLowerCase();
        if (!ct.has($) && !lt.has($)) {
          if ($ === "set-cookie") {
            Y.push(w);
            return;
          }
          P[I] = w;
        }
      }), Y.length > 0 && (P["x-speedrtc-set-cookie"] = JSON.stringify(Y));
      const ce = g.headers.get("etag"), he = g.headers.get("last-modified"), le = g.headers.get("cache-control") || "", Oe = le.includes("no-store") || le.includes("no-cache");
      if (N && !Oe && at.has(g.status) && (ce || he) && (G.size >= ot && G.delete(G.keys().next().value), G.set(N, { etag: ce, lastModified: he })), P["x-speedrtc-status-text"] = g.statusText, P["x-speedrtc-url"] = g.url, g.redirected && (P["x-speedrtc-redirected"] = "1"), this._compress && (P["x-speedrtc-compressed"] = "gzip"), await this._send(Ce(s, g.status, P)), g.body) {
        const w = (g.headers.get("content-type") || "").toLowerCase(), I = w.includes("text/css"), $ = w.includes("text/html"), de = g.url || r;
        let q = g.body;
        if (I) {
          const W = await new Response(q).arrayBuffer(), O = this._rewriteCssUrls(new TextDecoder().decode(W), de), A = new TextEncoder().encode(O), v = this._chunkSize;
          let k = 0;
          if (this._compress && typeof CompressionStream < "u") {
            const y = new CompressionStream("gzip"), D = y.writable.getWriter();
            D.write(A), D.close();
            const F = y.readable.getReader();
            try {
              for (; ; ) {
                const { done: Q, value: E } = await F.read();
                if (Q) break;
                if (E != null && E.length)
                  for (let M = 0; M < E.length; M += v)
                    await this._send(z(s, k++, E.subarray(M, M + v)));
              }
            } finally {
              F.cancel().catch(() => {
              });
            }
          } else
            for (let y = 0; y < A.length; y += v)
              await this._send(z(s, k++, A.subarray(y, y + v)));
          a = k;
        } else if ($) {
          const W = await new Response(q).arrayBuffer();
          let O = new TextDecoder().decode(W);
          O = this._rewriteHtml(O, de);
          const A = new TextEncoder().encode(O), v = this._chunkSize;
          let k = 0;
          if (this._compress && typeof CompressionStream < "u") {
            const y = new CompressionStream("gzip"), D = y.writable.getWriter();
            D.write(A), D.close();
            const F = y.readable.getReader();
            try {
              for (; ; ) {
                const { done: Q, value: E } = await F.read();
                if (Q) break;
                if (E != null && E.length)
                  for (let M = 0; M < E.length; M += v)
                    await this._send(z(s, k++, E.subarray(M, M + v)));
              }
            } finally {
              F.cancel().catch(() => {
              });
            }
          } else
            for (let y = 0; y < A.length; y += v)
              await this._send(z(s, k++, A.subarray(y, y + v)));
          a = k;
        } else {
          this._compress && typeof CompressionStream < "u" && (q = q.pipeThrough(new CompressionStream("gzip")));
          const W = q.getReader();
          let O = 0;
          const A = this._chunkSize;
          try {
            for (; ; ) {
              const { done: v, value: k } = await W.read();
              if (v) break;
              if (k != null && k.length)
                for (let y = 0; y < k.length; y += A) {
                  const D = k.subarray(y, y + A);
                  await this._send(z(s, O++, D));
                }
            }
          } finally {
            W.cancel().catch(() => {
            });
          }
          a = O;
        }
      }
      await this._send(ke(s, a));
    } catch (o) {
      await this._send(te(s, o.message || "Proxy fetch failed"));
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
    const r = /<head(\s[^>]*)?>/i.exec(e);
    if (r) {
      const i = r.index + r[0].length;
      e = e.slice(0, i) + se + e.slice(i);
    } else {
      const i = /<html(\s[^>]*)?>/i.exec(e);
      if (i) {
        const c = i.index + i[0].length;
        e = e.slice(0, c) + "<head>" + se + "</head>" + e.slice(c);
      } else
        e = se + e;
    }
    return e;
  }
  _resolveHtmlUrls(e, t) {
    return e = e.replace(
      /(\b(?:src|href|action|poster|data|formaction)\s*=\s*)(["'])([^"']*?)\2/gi,
      (s, n, r, i) => {
        if (i = i.trim(), !i || /^(data:|blob:|#|javascript:|mailto:|tel:|about:)/.test(i)) return s;
        try {
          return n + r + new URL(i, t).href + r;
        } catch {
          return s;
        }
      }
    ), e = e.replace(
      /(\bsrcset\s*=\s*)(["'])([^"']*?)\2/gi,
      (s, n, r, i) => {
        const c = i.split(",").map((a) => {
          const o = a.trim().split(/\s+/);
          if (o[0] && !/^(data:|blob:)/.test(o[0]))
            try {
              o[0] = new URL(o[0], t).href;
            } catch {
            }
          return o.join(" ");
        }).join(", ");
        return n + r + c + r;
      }
    ), e = e.replace(
      /(style\s*=\s*)(["'])([^"']*?)\2/gi,
      (s, n, r, i) => {
        const c = i.replace(/url\(\s*(['"]?)([^)'"]*?)\1\s*\)/gi, (a, o, h) => {
          if (!h || /^(data:|blob:|#)/.test(h)) return a;
          try {
            return `url(${o}${new URL(h, t).href}${o})`;
          } catch {
            return a;
          }
        });
        return n + r + c + r;
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
    return e = e.replace(/@import\s+url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (n, r, i) => {
      if (i = i.trim(), i.startsWith("data:") || i.startsWith("#")) return n;
      try {
        return `@import url(${r}${new URL(i, s).href}${r})`;
      } catch {
        return n;
      }
    }), e = e.replace(/@import\s+(['"])([^'"]+)\1/gi, (n, r, i) => {
      if (i.startsWith("data:") || i.startsWith("#")) return n;
      try {
        return `@import ${r}${new URL(i, s).href}${r}`;
      } catch {
        return n;
      }
    }), e = e.replace(/url\(\s*(['"]?)([^)'"]*?)\1\s*\)/gi, (n, r, i) => {
      if (i = i.trim(), !i || i.startsWith("data:") || i.startsWith("#")) return n;
      try {
        return `url(${r}${new URL(i, s).href}${r})`;
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
class ut {
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
const Re = 1, Pe = 2, Me = 3, oe = new TextEncoder(), ne = new TextDecoder();
class ft {
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
    const t = new Te(e, this._send);
    this._streams.set(e, t);
    const s = oe.encode(e), n = new ArrayBuffer(2 + s.length), r = new Uint8Array(n);
    return r[0] = Re, r[1] = s.length, r.set(s, 2), this._send(n), t;
  }
  get(e) {
    return this._streams.get(e);
  }
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === Re) {
      const n = t[1], r = ne.decode(t.slice(2, 2 + n)), i = new Te(r, this._send);
      this._streams.set(r, i), this._emit("incoming", i);
      return;
    }
    if (s === Pe) {
      const n = t[1], r = ne.decode(t.slice(2, 2 + n)), i = e.slice(2 + n), c = this._streams.get(r);
      c && c._handleData(i);
      return;
    }
    if (s === Me) {
      const n = t[1], r = ne.decode(t.slice(2, 2 + n)), i = this._streams.get(r);
      i && (i._handleClose(), this._streams.delete(r));
    }
  }
}
class Te {
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
    const t = new Uint8Array(e), s = oe.encode(this.name), n = new ArrayBuffer(2 + s.length + t.length), r = new Uint8Array(n);
    r[0] = Pe, r[1] = s.length, r.set(s, 2), r.set(t, 2 + s.length), await this._send(n);
  }
  async close() {
    if (this._closed) return;
    this._closed = !0;
    const e = oe.encode(this.name), t = new ArrayBuffer(2 + e.length), s = new Uint8Array(t);
    s[0] = Me, s[1] = e.length, s.set(e, 2), await this._send(t), this._emit("close");
  }
  _handleData(e) {
    this._emit("data", e);
  }
  _handleClose() {
    this._closed = !0, this._emit("close");
  }
}
const R = {
  CHUNK: 240,
  MESSAGE: 241,
  PROXY: 242,
  STREAM: 243
}, pt = [
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
let xe = 1, K = null, re = null;
function Ue() {
  return K ? Promise.resolve(K) : (re || (re = RTCPeerConnection.generateCertificate({ name: "ECDSA", namedCurve: "P-256" }).then((l) => (K = l, l)).catch(() => null)), re);
}
Ue();
function L(l, e) {
  const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length), n = new Uint8Array(s);
  return n[0] = l, n.set(t, 1), s;
}
class mt {
  constructor({
    iceServers: e = pt,
    dataChannels: t = 32,
    chunkSize: s = Ie,
    proxy: n = {},
    isHost: r = !1,
    requireRoomCode: i = !1,
    trackerUrls: c = null,
    driveSignal: a = null,
    serverMode: o = !1,
    iceTransportPolicy: h = "all",
    iceCandidatePoolSize: d = 10,
    signalServer: u = null
  } = {}) {
    this.iceServers = e, this.iceTransportPolicy = h, this.iceCandidatePoolSize = d, this.dataChannelCount = t, this.chunkSize = s, this.isHost = r, this.requireRoomCode = i, this.trackerUrls = c, this.driveSignalConfig = a, this.signalServerUrl = u, this.serverMode = o, this.remoteIsHost = !1, this.pc = null, this.signaling = null, this.pool = null, this.bonding = null, this.monitor = new Ee(), this.roomCode = null, this.isOfferer = !1, this._listeners = {}, this._pendingMeta = /* @__PURE__ */ new Map(), this._probeTimers = /* @__PURE__ */ new Map(), this._negotiationState = "idle", this._pcCreated = !1, this._iceRestartPending = !1, this._pendingIceCandidates = [], this._pendingRemoteCandidates = [], this._preConnectedWs = null, this._preWarmedManager = null, this._proxyOpts = n, this.message = null, this._proxyClient = null, this._proxyServer = null, this.proxy = null, this.media = null, this.stream = null;
  }
  warmup() {
    var e;
    if (Ue(), this._pcCreated || this._createPeerConnection(), this.driveSignalConfig && m.warmupToken(this.driveSignalConfig).catch(() => {
    }), this.signalServerUrl && !this._preConnectedWs && ye.preConnect(this.signalServerUrl).then((t) => {
      this._preConnectedWs = t;
    }).catch(() => {
    }), !this.driveSignalConfig && !this.signalServerUrl && !this._preWarmedManager) {
      const t = (e = this.trackerUrls) != null && e.length ? [...this.trackerUrls] : ie.DEFAULT_TRACKER_URLS;
      this._preWarmedManager = new ve(t), this._preWarmedConnectPromise = this._preWarmedManager.connect().catch(() => {
      });
    }
  }
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
          console.error("SpeedRTC event error:", n);
        }
  }
  async createRoom(e = null) {
    if (this.isOfferer = !0, e ? this.roomCode = e : this.requireRoomCode ? this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase() : this.roomCode = "SPEEDRTC-PUBLIC-SWARM", this._pcCreated || this._createPeerConnection(), !this.driveSignalConfig) {
      this._negotiationState = "offering";
      const t = await this.pc.createOffer();
      await this.pc.setLocalDescription(t);
    }
    return this._preWarmedConnectPromise && (await this._preWarmedConnectPromise, this._preWarmedConnectPromise = null), new Promise((t, s) => {
      this.signaling = this._createSignaling(!0), this.signaling.onOpen = () => {
        this._emit("wss-open", 0), this._emit("room-created", this.roomCode), this.driveSignalConfig || this.signaling.send({
          type: "offer",
          sdp: this.pc.localDescription,
          roomCode: this.roomCode,
          isHost: this.isHost
        }), t(this.roomCode);
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
        return Promise.reject(new Error("SpeedRTC is configured with requireRoomCode=true, but no code was provided to joinRoom()."));
      this.roomCode = "SPEEDRTC-PUBLIC-SWARM";
    }
    return this._pcCreated || this._createPeerConnection(), this._preWarmedConnectPromise && (await this._preWarmedConnectPromise, this._preWarmedConnectPromise = null), new Promise((t, s) => {
      this._joinResolver = t, this.signaling = this._createSignaling(!1), this.signaling.onOpen = () => {
        this._emit("wss-open", 0);
      }, this.signaling.onMessage = (n) => {
        this._onSignalingMessage(n);
      }, this.signaling.onClose = () => {
        this._emit("wss-close", 0);
      }, this.signaling.connect();
    });
  }
  async send(e) {
    if (!this.bonding) throw new Error("Not connected");
    const t = xe++, n = we(e, t, this.chunkSize).map((r) => L(R.CHUNK, r));
    await this.bonding.sendChunks(n);
  }
  async sendFile(e) {
    if (!this.bonding) throw new Error("Not connected");
    const t = xe++, s = await e.arrayBuffer(), n = { name: e.name, size: e.size, type: e.type }, r = L(R.CHUNK, Je(t, n));
    for (const a of this.bonding.senders)
      try {
        await a(r);
      } catch {
      }
    await new Promise((a) => setTimeout(a, 50));
    const i = we(s, t, this.chunkSize), c = i.map((a) => L(R.CHUNK, a));
    this._emit("send-start", { transferId: t, name: e.name, totalChunks: i.length }), await this.bonding.sendChunks(c), this._emit("send-complete", { transferId: t, name: e.name });
  }
  getStats() {
    return {
      links: Object.fromEntries(this.monitor.getScores()),
      weights: Object.fromEntries(this.monitor.getWeights()),
      signalingConnected: this._isSignalingReady(),
      openChannels: this.pool ? this.pool.getOpenCount() : 0,
      totalChannels: this.dataChannelCount
    };
  }
  getSignalStats() {
    var e;
    return (e = this.signaling) != null && e._manager ? this.signaling._manager.getStats() : [];
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
    this._preWarmedManager && (this._preWarmedManager.close(), this._preWarmedManager = null), this.pc = null, this.pool = null, this.bonding = null, this.signaling = null, this.message = null, this.proxy = null, this.media = null, this.stream = null;
  }
  _createSignaling(e) {
    if (this.driveSignalConfig)
      return new m(this.roomCode, e, this.driveSignalConfig);
    if (this.signalServerUrl) {
      const s = new ye(this.roomCode, e, this.signalServerUrl);
      return this._preConnectedWs && (s.usePreConnectedSocket(this._preConnectedWs), this._preConnectedWs = null), s;
    }
    const t = new ie(this.roomCode, e, this.trackerUrls);
    return this._preWarmedManager && (t.useManager(this._preWarmedManager), this._preWarmedManager = null), t;
  }
  _isSignalingReady() {
    return this.signaling ? this.signaling.connected !== void 0 ? this.signaling.connected : this.signaling.sockets ? this.signaling.sockets.some((e) => e.readyState === WebSocket.OPEN) : !1 : !1;
  }
  _onSignalingMessage(e) {
    var t;
    if (e)
      switch (e.isHost === !0 && (this.remoteIsHost = !0), e.type) {
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
    K && (e.certificates = [K]), this.pc = new RTCPeerConnection(e), this.pc.onicecandidate = (t) => {
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
    }, this.pool = new Ne(this.pc, {
      channelCount: this.dataChannelCount,
      ordered: this.serverMode
    }), this.pool.onOpen((t) => {
      this._emit("channel-open", t), this._updateBondingPaths();
    }), this.pool.onClose((t) => {
      this._emit("channel-close", t);
    }), this.pool.onMessage((t, s) => {
      this._routeIncoming(s, `dc-${t}`);
    }), this.pool.createChannels(), this.media = new ut(this.pc, () => this._renegotiate());
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
    this._updateBondingPaths(), this._initSubModules(), this.monitor.start(), this._startProbing(), this._emit("connected", { remoteIsHost: this.remoteIsHost });
  }
  _initSubModules() {
    const e = async (s) => {
      this.bonding && this.bonding.senders.length > 0 && await this.bonding.sendSingle(s);
    }, t = this.serverMode ? async (s) => {
      const n = L(R.PROXY, s);
      this.pool.sendImmediate(n) === -1 && await this.pool.send(n);
    } : async (s) => {
      await e(L(R.PROXY, s));
    };
    this.message = new Ze(async (s) => {
      await e(L(R.MESSAGE, s));
    }), this._proxyClient = new rt(t), this._proxyServer = new dt(t, this._proxyOpts), this.proxy = {
      fetch: (s, n) => this._proxyClient.fetch(s, n),
      intercept: (s, n) => this._proxyClient.intercept(s, n),
      release: () => this._proxyClient.release(),
      createInterceptScript: () => this._proxyClient.createInterceptScript(),
      cookieJar: this._proxyClient.cookieJar,
      serve: (s) => {
        s && (s.allowList != null && (this._proxyServer._allowList = s.allowList), s.blockList != null && (this._proxyServer._blockList = s.blockList), s.chunkSize != null && (this._proxyServer._chunkSize = s.chunkSize), s.compress != null && (this._proxyServer._compress = s.compress)), this._proxyServer.serve();
      },
      stop: () => this._proxyServer.stop()
    }, this.stream = new ft(async (s) => {
      await e(L(R.STREAM, s));
    });
  }
  _updateBondingPaths() {
    const e = [], t = [];
    for (const s of this.pool.openChannels) {
      const n = `dc-${s}`;
      t.push(n), e.push(async (r) => {
        await this.pool.sendOnChannel(s, r);
      });
    }
    this.bonding ? this.bonding.updatePaths(e, t) : (this.bonding = new ze({
      senders: e,
      linkIds: t,
      monitor: this.monitor
    }), this.bonding.onProgress((s) => {
      this._emit("progress", s);
    }), this.bonding.onComplete(({ transferId: s, data: n }) => {
      const r = this._pendingMeta.get(s);
      r ? (this._pendingMeta.delete(s), this._emit("file", { ...r, data: n, transferId: s })) : this._emit("data", { data: n, transferId: s });
    }));
  }
  _routeIncoming(e, t) {
    const s = new Uint8Array(e);
    if (s.length < 1) return;
    const n = s[0], r = e.slice(1);
    switch (n) {
      case R.CHUNK:
        this._handleChunkData(r, t);
        break;
      case R.MESSAGE:
        this.message && this.message.handleIncoming(r);
        break;
      case R.PROXY:
        this._handleProxyData(r);
        break;
      case R.STREAM:
        this.stream && this.stream.handleIncoming(r);
        break;
      default:
        this._handleChunkData(e, t);
        break;
    }
  }
  _handleChunkData(e, t) {
    const s = Ge(e);
    if (s.flags & B.PROBE) {
      this._handleProbe(s, t);
      return;
    }
    if (s.flags & B.META) {
      const n = Ke(s.payload);
      this._pendingMeta.set(s.transferId, n), this._emit("file-incoming", { transferId: s.transferId, ...n });
      return;
    }
    s.flags & B.DATA && this.bonding && this.bonding.receiveChunk(s);
  }
  _handleProxyData(e) {
    new DataView(e).getUint8(0) === b.REQUEST ? this._proxyServer && this._proxyServer.handleIncoming(e) : this._proxyClient && this._proxyClient.handleIncoming(e);
  }
  _startProbing() {
    const e = this.serverMode ? 8e3 : 3e3;
    for (const t of this.pool.openChannels) {
      const s = `dc-${t}`;
      this.monitor.addLink(s);
      const n = setInterval(async () => {
        const r = Xe(performance.now());
        try {
          await this.pool.sendOnChannel(t, L(R.CHUNK, r)), this.monitor.recordProbeSent(s);
        } catch {
        }
      }, e);
      this._probeTimers.set(s, n);
    }
  }
  _handleProbe(e, t) {
    if (e.payload) {
      const s = Ve(e.payload), n = performance.now() - s;
      n > 0 && n < 3e4 && this.monitor.recordProbeResponse(t, n);
    }
  }
}
export {
  ze as BondingEngine,
  Ee as ConnectionMonitor,
  Ie as DEFAULT_CHUNK_SIZE,
  Ne as DataChannelPool,
  ye as DirectSignal,
  m as DriveSignal,
  B as Flags,
  V as HEADER_SIZE,
  ut as MediaManager,
  Ze as Messenger,
  rt as ProxyClient,
  b as ProxyFrameType,
  dt as ProxyServer,
  ve as SignalManager,
  mt as SpeedRTC,
  Te as Stream,
  ft as StreamManager,
  Ge as decodeChunk,
  Ke as decodeMetaPayload,
  Ve as decodeProbeTimestamp,
  Ae as decodeProxyFrame,
  ae as encodeChunk,
  Je as encodeMetaChunk,
  Xe as encodeProbe,
  et as encodeRequest,
  we as splitIntoChunks
};
