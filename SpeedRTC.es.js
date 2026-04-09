var ve = Object.defineProperty;
var Oe = (h, e, t) => e in h ? ve(h, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : h[e] = t;
var he = (h, e, t) => Oe(h, typeof e != "symbol" ? e + "" : e, t);
class Le {
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
const le = 0.3, Ne = 2e4, De = 8e3, We = 5e3, Be = 4, $e = 1;
class qe {
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
      }, We);
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
      this._awaitingResponse = !1, this.latency = this.latency === 0 ? s : le * s + (1 - le) * this.latency;
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
class Re {
  constructor(e) {
    this.nodes = e.map((t) => new qe(t)), this._active = [], this._primary = null, this._pingTimer = null, this._rebalanceTimer = null, this._closed = !1, this.onMessage = null, this.onRebalance = null, this.onNodeJoined = null;
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
        if (!n && this._active.length >= $e) {
          n = !0, this._primary = this._best(), this._startTimers(), e(this._active.length);
          return;
        }
        s >= i && !n && (this._active.length > 0 ? (n = !0, this._primary = this._best(), this._startTimers(), e(this._active.length)) : t(new Error("SignalManager: all trackers failed to connect")));
      };
      for (const c of this.nodes)
        c._onMessage = (o, a) => this._onRawMessage(o, a), c.connect().then((o) => {
          if (s++, this._closed) {
            o.close(), r();
            return;
          }
          this._active.length < Be ? (this._active.push(o), n && (this._rebalance(), this.onNodeJoined && this.onNodeJoined(o.url))) : o.close(), r();
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
    }, De), this._rebalanceTimer = setInterval(() => {
      this._rebalance();
    }, Ne);
  }
  _stopTimers() {
    clearInterval(this._pingTimer), clearInterval(this._rebalanceTimer), this._pingTimer = null, this._rebalanceTimer = null;
  }
  _onRawMessage(e, t) {
    this.onMessage && this.onMessage(e, t);
  }
}
const de = [
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
class se {
  constructor(e, t, s = null) {
    this.roomCode = e, this.isOfferer = t;
    const n = Array.from("FRTC" + e).map((r) => r.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    this.infoHash = n.padEnd(40, "0"), this.peerId = Array.from(crypto.getRandomValues(new Uint8Array(20))).map((r) => r.toString(16).padStart(2, "0")).join("");
    const i = s != null && s.length ? [...s] : de;
    this._manager = new Re(i), this._managerPreConnected = !1, this.remotePeerId = null, this._preferredNodeUrl = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this._announceInterval = null, this._localOfferPayload = null;
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
he(se, "DEFAULT_TRACKER_URLS", de);
const Y = "https://oauth2.googleapis.com/token", ue = "https://www.googleapis.com/auth/spreadsheets", He = "https://accounts.google.com/gsi/client";
let fe = !1, J = null;
const Q = /* @__PURE__ */ new Map();
function _e(h) {
  return h ? h.refreshToken ? `refresh:${h.clientId}:${h.refreshToken.slice(-12)}` : h.serviceAccount ? `service:${h.serviceAccount.client_email}` : h.accessToken ? `static:${h.accessToken.slice(-12)}` : null : null;
}
class p {
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
    this.peerId = p._generatePeerId(), this.remotePeerId = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this.connected = !1, this._pollTimer = null, this._myColumn = null, this._remoteColIndex = null, this._readCursor = 1, this._destroyed = !1, this._baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
  }
  async warmup() {
    if (this._authMode === "refresh" || this._authMode === "service")
      try {
        await this._ensureToken();
      } catch {
      }
  }
  static async warmupToken(e) {
    const t = _e(e);
    if (!t) return;
    const s = Q.get(t);
    if (!(s && Date.now() < s.expiry - 5e3))
      try {
        await new p("__warmup__", !1, e)._ensureToken();
      } catch {
      }
  }
  async connect() {
    try {
      if (this._authMode === "raw") {
        if (await this._registerColumn(), this._lastRawValues && this._myColumn) {
          const e = p._colIndex(this._myColumn);
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
        const e = `${this.sheetName}!${this._myColumn}2:${this._myColumn}1000`;
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
        `/${this.spreadsheetId}/values/${encodeURIComponent(`${this.sheetName}!1:1`)}`,
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
      this._myColumn = p._colLetter(t);
      return;
    }
    const s = e.length;
    this._myColumn = p._colLetter(s), await this._writeCell(`${this.sheetName}!${this._myColumn}1`, this.peerId);
  }
  async _registerColumn() {
    const e = await this._readHeaders(), t = e.indexOf(this.peerId);
    if (t >= 0) {
      this._myColumn = p._colLetter(t);
      return;
    }
    const s = e.length;
    this._myColumn = p._colLetter(s), await this._writeCell(`${this.sheetName}!${this._myColumn}1`, this.peerId);
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
          `/${this.spreadsheetId}/values/${encodeURIComponent(this.sheetName)}`,
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
                  const c = JSON.parse(r);
                  this.onMessage && this.onMessage(c);
                } catch {
                }
            }
            e.length > this._readCursor && (this._readCursor = e.length);
          }
        }
        if (this._authMode === "raw" && this._myColumn) {
          const s = p._colIndex(this._myColumn);
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
    const n = e.includes("?") ? "&" : "?", i = !this._accessToken && this._apiKey ? `${n}key=${encodeURIComponent(this._apiKey)}` : "", r = `${this._baseUrl}${e}${i}`, c = { "Content-Type": "application/json" };
    this._accessToken && (c.Authorization = `Bearer ${this._accessToken}`);
    const o = { method: t, headers: c };
    s && (o.body = JSON.stringify(s));
    let a = await fetch(r, o);
    if (a.status === 401 && this._authMode !== "static" && this._authMode !== "apikey" && (this._tokenExpiry = 0, await this._ensureToken(), this._accessToken && (o.headers.Authorization = `Bearer ${this._accessToken}`), a = await fetch(r, o)), !a.ok) {
      const d = new Error(`Sheets API ${t} ${e} → ${a.status}`);
      throw d.status = a.status, d;
    }
    const l = await a.text();
    return l ? JSON.parse(l) : {};
  }
  async _ensureToken() {
    if (this._authMode === "apikey" || this._accessToken && Date.now() < this._tokenExpiry - 5e3) return;
    const e = _e(this._driveConfig);
    if (e) {
      const t = Q.get(e);
      if (t && Date.now() < t.expiry - 5e3) {
        this._accessToken = t.token, this._tokenExpiry = t.expiry;
        return;
      }
    }
    this._authMode === "refresh" ? await this._refreshAccessToken() : this._authMode === "service" ? await this._mintServiceAccountToken() : this._authMode === "client" && await this._requestClientToken(), e && this._accessToken && Q.set(e, { token: this._accessToken, expiry: this._tokenExpiry });
  }
  async _refreshAccessToken() {
    const e = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this._clientId,
      client_secret: this._clientSecret,
      refresh_token: this._refreshToken
    }), t = await fetch(Y, {
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
      scope: ue,
      aud: Y,
      iat: e,
      exp: e + 3600
    }, s = await p._signJwt(t, this._serviceAccount.private_key, this), n = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: s
    }), i = await fetch(Y, {
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
    return await p._loadGisScript(), this._gisTokenClient || (this._gisTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this._clientId,
      scope: ue,
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
    return fe && typeof google < "u" && google.accounts ? Promise.resolve() : J || (J = new Promise((e, t) => {
      const s = document.createElement("script");
      s.src = He, s.async = !0, s.onload = () => {
        fe = !0, e();
      }, s.onerror = () => t(new Error("[DriveSignal] Failed to load Google Identity Services script")), document.head.appendChild(s);
    }), J);
  }
  async _readHeaders() {
    if (this._authMode === "raw")
      return this._lastRawValues = await this._rawReadSheet(), this._lastRawValues.length > 0 ? this._lastRawValues[0] : [];
    const e = `${this.sheetName}!1:1`;
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
      const { row: s, col: n } = p._parseRange(e);
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
      const i = p._colIndex(e), r = this._myWriteRow;
      return this._myWriteRow++, this._rawWriteCell(r, i, t);
    }
    const s = this._myWriteRow;
    this._myWriteRow++;
    const n = `${this.sheetName}!${e}${s}`;
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
    ]), c = JSON.stringify([{
      commands: [[i, r]],
      sid: this._rawSid,
      reqId: this._rawReqId
    }]), o = new URLSearchParams({
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
    }), a = `https://docs.google.com/spreadsheets/u/0/d/${this.spreadsheetId}/save?${o}`, l = new FormData();
    l.append("rev", String(this._rawRev)), l.append("bundles", c);
    try {
      await fetch(a, {
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
        clearTimeout(s), delete window[t], e(p._parseGvizTable(i));
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
      col: p._colIndex(s[1]),
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
    s._signingKey || (s._signingKey = await p._importPem(t));
    const n = { alg: "RS256", typ: "JWT" }, i = [
      p._b64url(JSON.stringify(n)),
      p._b64url(JSON.stringify(e))
    ], r = new TextEncoder().encode(i.join(".")), c = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      s._signingKey,
      r
    );
    return i.push(p._b64urlBuf(c)), i.join(".");
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
class pe {
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
class Te {
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
class Fe {
  constructor({ senders: e = [], linkIds: t = [], monitor: s = null } = {}) {
    this.senders = e, this.linkIds = t, this.monitor = s || new Te();
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
      const i = t[n], r = e[n], c = this.linkIds[i];
      s.push(
        this.senders[i](r).then(() => {
          this.monitor.recordBytesSent(c, r.byteLength);
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
      const c = this._assemble(r);
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
    let i = 0;
    for (let o = 0; o < this.linkIds.length; o++) {
      const a = this.linkIds[o], l = s.get(a) || 1 / this.linkIds.length, d = Math.round(l * e);
      n.set(o, d), i += d;
    }
    if (i < e) {
      const o = this._pickBestSender();
      n.set(o, (n.get(o) || 0) + (e - i));
    } else if (i > e)
      for (let o = this.linkIds.length - 1; o >= 0 && i > e; o--) {
        const a = n.get(o) || 0, l = Math.min(a, i - e);
        n.set(o, a - l), i -= l;
      }
    let r = 0;
    const c = new Map(n);
    for (; r < e; )
      for (let o = 0; o < this.linkIds.length && r < e; o++) {
        const a = c.get(o) || 0;
        a > 0 && (t[r++] = o, c.set(o, a - 1));
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
const K = 13, Ie = 64 * 1024, L = {
  DATA: 1,
  ACK: 2,
  FIN: 4,
  PROBE: 8,
  META: 16
};
function ie({ transferId: h, chunkIndex: e, totalChunks: t, flags: s, payload: n }) {
  const i = n ? n instanceof Uint8Array ? n : new Uint8Array(n) : new Uint8Array(0), r = new ArrayBuffer(K + i.byteLength), c = new DataView(r);
  return c.setUint32(0, h, !0), c.setUint32(4, e, !0), c.setUint32(8, t, !0), c.setUint8(12, s), i.byteLength > 0 && new Uint8Array(r, K).set(i), r;
}
function je(h) {
  const e = new DataView(h);
  return {
    transferId: e.getUint32(0, !0),
    chunkIndex: e.getUint32(4, !0),
    totalChunks: e.getUint32(8, !0),
    flags: e.getUint8(12),
    payload: h.byteLength > K ? new Uint8Array(h, K) : null
  };
}
function me(h, e, t = Ie) {
  const s = new Uint8Array(h), n = Math.ceil(s.byteLength / t), i = [];
  for (let r = 0; r < n; r++) {
    const c = r * t, o = Math.min(c + t, s.byteLength), a = s.slice(c, o);
    i.push(
      ie({
        transferId: e,
        chunkIndex: r,
        totalChunks: n,
        flags: L.DATA,
        payload: a
      })
    );
  }
  return i;
}
function ze(h, e) {
  const t = JSON.stringify(e), n = new TextEncoder().encode(t);
  return ie({
    transferId: h,
    chunkIndex: 0,
    totalChunks: 0,
    flags: L.META,
    payload: n
  });
}
function Ge(h) {
  const e = new TextDecoder();
  return JSON.parse(e.decode(h));
}
function Je(h) {
  const e = new Uint8Array(8);
  return new DataView(e.buffer).setFloat64(0, h, !0), ie({
    transferId: 0,
    chunkIndex: 0,
    totalChunks: 0,
    flags: L.PROBE,
    payload: e
  });
}
function Ke(h) {
  return new DataView(h.buffer, h.byteOffset, h.byteLength).getFloat64(0, !0);
}
const ge = 1, we = 2, Ve = new TextEncoder(), Ye = new TextDecoder();
class Qe {
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
    const t = Ve.encode(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = ge, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  async sendBinary(e) {
    const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = we, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === ge) {
      const n = Ye.decode(t.slice(1));
      this._emit("text", n);
    } else s === we && this._emit("binary", e.slice(1));
  }
}
const y = {
  REQUEST: 1,
  RESPONSE: 2,
  BODY: 3,
  END: 4,
  ERROR: 5
}, $ = new TextEncoder(), W = new TextDecoder();
function Xe(h, e, t, s = {}, n = null) {
  const i = $.encode(e), r = $.encode(t), c = $.encode(JSON.stringify(s)), o = n ? new Uint8Array(n) : new Uint8Array(0), a = 6 + i.length + 2 + r.length + 4 + c.length + o.length, l = new ArrayBuffer(a), d = new DataView(l), f = new Uint8Array(l);
  let u = 0;
  return d.setUint8(u, y.REQUEST), u += 1, d.setUint32(u, h, !0), u += 4, d.setUint8(u, i.length), u += 1, f.set(i, u), u += i.length, d.setUint16(u, r.length, !0), u += 2, f.set(r, u), u += r.length, d.setUint32(u, c.length, !0), u += 4, f.set(c, u), u += c.length, o.length > 0 && f.set(o, u), l;
}
function ye(h, e, t = {}) {
  const s = $.encode(JSON.stringify(t)), n = 11 + s.length, i = new ArrayBuffer(n), r = new DataView(i), c = new Uint8Array(i);
  let o = 0;
  return r.setUint8(o, y.RESPONSE), o += 1, r.setUint32(o, h, !0), o += 4, r.setUint16(o, e, !0), o += 2, r.setUint32(o, s.length, !0), o += 4, c.set(s, o), i;
}
function X(h, e, t) {
  const s = new Uint8Array(t), n = new ArrayBuffer(9 + s.length), i = new DataView(n);
  return new Uint8Array(n).set(s, 9), i.setUint8(0, y.BODY), i.setUint32(1, h, !0), i.setUint32(5, e, !0), n;
}
function Se(h, e = 0) {
  const t = new ArrayBuffer(9), s = new DataView(t);
  return s.setUint8(0, y.END), s.setUint32(1, h, !0), s.setUint32(5, e, !0), t;
}
function Z(h, e) {
  const t = $.encode(e), s = new ArrayBuffer(5 + t.length), n = new DataView(s);
  return new Uint8Array(s).set(t, 5), n.setUint8(0, y.ERROR), n.setUint32(1, h, !0), s;
}
function Ae(h) {
  const e = new DataView(h), t = new Uint8Array(h), s = e.getUint8(0), n = e.getUint32(1, !0);
  switch (s) {
    case y.REQUEST: {
      let i = 5;
      const r = e.getUint8(i);
      i += 1;
      const c = W.decode(t.slice(i, i + r));
      i += r;
      const o = e.getUint16(i, !0);
      i += 2;
      const a = W.decode(t.slice(i, i + o));
      i += o;
      const l = e.getUint32(i, !0);
      i += 4;
      const d = JSON.parse(W.decode(t.slice(i, i + l)));
      i += l;
      const f = i < h.byteLength ? h.slice(i) : null;
      return { type: s, requestId: n, method: c, url: a, headers: d, body: f };
    }
    case y.RESPONSE: {
      let i = 5;
      const r = e.getUint16(i, !0);
      i += 2;
      const c = e.getUint32(i, !0);
      i += 4;
      const o = JSON.parse(W.decode(t.slice(i, i + c)));
      return { type: s, requestId: n, status: r, headers: o };
    }
    case y.BODY: {
      const i = e.getUint32(5, !0);
      return { type: s, requestId: n, seqNum: i, data: h.slice(9) };
    }
    case y.END:
      return { type: s, requestId: n, seqCount: h.byteLength >= 9 ? e.getUint32(5, !0) : 0 };
    case y.ERROR:
      return { type: s, requestId: n, message: W.decode(t.slice(5)) };
    default:
      return { type: s, requestId: n };
  }
}
class Ze {
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
let et = 1;
class tt {
  constructor() {
    this._cookies = [];
  }
  store(e, t) {
    if (!t) return;
    const s = Array.isArray(t) ? t : [t], n = this._parseOrigin(e), i = Date.now();
    for (const r of s) {
      const c = r.split(";").map((_) => _.trim()), [o] = c, a = o.indexOf("=");
      if (a < 0) continue;
      const l = o.slice(0, a).trim(), d = o.slice(a + 1).trim();
      let f = n.hostname, u = "/", g = null, b = !1, M = n.protocol === "https:";
      for (let _ = 1; _ < c.length; _++) {
        const [P, S = ""] = c[_].split("=").map((A) => A.trim()), m = P.toLowerCase();
        m === "domain" ? f = S.replace(/^\./, "") : m === "path" ? u = S || "/" : m === "expires" ? g = new Date(S).getTime() : m === "max-age" ? g = i + parseInt(S, 10) * 1e3 : m === "httponly" ? b = !0 : m === "secure" && (M = !0);
      }
      if (g !== null && g < i) {
        this._cookies = this._cookies.filter((_) => !(_.name === l && _.domain === f && _.path === u));
        continue;
      }
      const R = this._cookies.findIndex((_) => _.name === l && _.domain === f && _.path === u), T = { name: l, value: d, domain: f, path: u, expires: g, httpOnly: b, secure: M };
      R >= 0 ? this._cookies[R] = T : this._cookies.push(T);
    }
  }
  get(e) {
    try {
      const { hostname: t, pathname: s, protocol: n } = new URL(e), i = n === "https:", r = Date.now();
      return this._cookies = this._cookies.filter((c) => c.expires === null || c.expires > r), this._cookies.filter((c) => !(c.secure && !i || !t.endsWith(c.domain) && t !== c.domain || !s.startsWith(c.path))).map((c) => `${c.name}=${c.value}`).join("; ") || null;
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
class st {
  constructor(e) {
    this._send = e, this._pending = /* @__PURE__ */ new Map(), this.cookieJar = new tt();
  }
  async fetch(e, t = {}) {
    const s = et++, n = (t.method || "GET").toUpperCase(), i = Object.assign({}, t.headers || {});
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
        const a = new Request("/", { method: "POST", body: t.body });
        r = await a.arrayBuffer(), i["content-type"] || (i["content-type"] = a.headers.get("content-type"));
      } else if (typeof ReadableStream < "u" && t.body instanceof ReadableStream) {
        const a = t.body.getReader(), l = [];
        let d = 0;
        for (; ; ) {
          const { done: g, value: b } = await a.read();
          if (g) break;
          l.push(b), d += b.byteLength;
        }
        const f = new Uint8Array(d);
        let u = 0;
        for (const g of l)
          f.set(g, u), u += g.byteLength;
        r = f.buffer;
      }
    }
    t.redirect && (i["x-proxy-opt-redirect"] = t.redirect), t.cache && (i["x-proxy-opt-cache"] = t.cache), t.mode && (i["x-proxy-opt-mode"] = t.mode), t.referrer && (i["x-proxy-opt-referrer"] = t.referrer), t.referrerPolicy && (i["x-proxy-opt-referrerpolicy"] = t.referrerPolicy), t.credentials && (i["x-proxy-opt-credentials"] = t.credentials);
    try {
      const a = new URL(e).origin, l = this.cookieJar.get(e);
      l && !i.cookie && (i.cookie = l);
    } catch {
    }
    const c = t.timeout || 3e4, o = Xe(s, n, e, i, r);
    return new Promise((a, l) => {
      const d = t.signal;
      let f = !1;
      const u = setTimeout(() => {
        f || (f = !0, this._pending.delete(s), l(new DOMException(`Proxy request timed out: ${n} ${e}`, "TimeoutError")));
      }, c), g = () => {
        f || (f = !0, clearTimeout(u), this._pending.delete(s), l(d.reason || new DOMException("The operation was aborted.", "AbortError")));
      };
      if (d) {
        if (d.aborted) {
          g();
          return;
        }
        d.addEventListener("abort", g, { once: !0 });
      }
      this._pending.set(s, {
        resolve: (b) => {
          d && d.removeEventListener("abort", g), a(b);
        },
        reject: (b) => {
          d && d.removeEventListener("abort", g), l(b);
        },
        timeout: u,
        url: e,
        status: 0,
        headers: {},
        bodyChunks: [],
        totalBodySize: 0,
        seqCount: -1,
        endReceived: !1
      }), this._send(o).catch(l);
    });
  }
  handleIncoming(e) {
    const t = Ae(e), s = this._pending.get(t.requestId);
    if (s)
      switch (t.type) {
        case y.RESPONSE:
          s.status = t.status, s.headers = t.headers;
          break;
        case y.BODY:
          s.bodyChunks.push({ seqNum: t.seqNum, data: new Uint8Array(t.data) }), s.totalBodySize += t.data.byteLength, s.endReceived && s.bodyChunks.length >= s.seqCount && this._resolveRequest(t.requestId, s);
          break;
        case y.END:
          s.seqCount = t.seqCount, s.endReceived = !0, s.bodyChunks.length >= t.seqCount && this._resolveRequest(t.requestId, s);
          break;
        case y.ERROR:
          clearTimeout(s.timeout), this._pending.delete(t.requestId), s.reject(new Error(t.message || "Proxy error"));
          break;
      }
  }
  _resolveRequest(e, t) {
    clearTimeout(t.timeout), this._pending.delete(e), t.bodyChunks.sort((o, a) => o.seqNum - a.seqNum);
    const s = new Uint8Array(t.totalBodySize);
    let n = 0;
    for (const o of t.bodyChunks)
      s.set(o.data, n), n += o.data.length;
    const i = new Ze(t.headers), r = i.get("x-speedrtc-compressed") === "gzip", c = i.get("x-speedrtc-set-cookie");
    if (c)
      try {
        const o = JSON.parse(c);
        i._map["set-cookie"] = o.join(`
`);
        try {
          const a = new URL(t.url).origin;
          this.cookieJar.store(a, o);
        } catch {
        }
      } catch {
      }
    r ? this._decompressAndResolve(s.buffer, t, i) : t.resolve(new O(t.status, i, s.buffer));
  }
  async _decompressAndResolve(e, t, s) {
    if (typeof DecompressionStream > "u") {
      t.resolve(new O(t.status, s, e));
      return;
    }
    try {
      const n = new DecompressionStream("gzip"), i = n.writable.getWriter(), r = n.readable.getReader();
      i.write(new Uint8Array(e)), i.close();
      const c = [];
      let o = 0;
      for (; ; ) {
        const { done: d, value: f } = await r.read();
        if (d) break;
        c.push(f), o += f.byteLength;
      }
      const a = new Uint8Array(o);
      let l = 0;
      for (const d of c)
        a.set(d, l), l += d.byteLength;
      t.resolve(new O(t.status, s, a.buffer));
    } catch {
      t.resolve(new O(t.status, s, e));
    }
  }
}
class O {
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
    return new O(this.status, this.headers, this._body.slice(0));
  }
}
const nt = 16 * 1024, B = /* @__PURE__ */ new Map(), it = 200, rt = /* @__PURE__ */ new Set([200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501]), ot = /* @__PURE__ */ new Set([
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
]), at = /* @__PURE__ */ new Set([
  "host",
  "origin",
  "referer"
]), ct = /* @__PURE__ */ new Set([
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
]);
class ht {
  constructor(e, t = {}) {
    this._send = e, this._allowList = t.allowList || [], this._blockList = t.blockList || [], this._chunkSize = t.chunkSize || nt, this._compress = t.compress || !1, this._active = !1;
  }
  serve(e) {
    e && (e.chunkSize != null && (this._chunkSize = e.chunkSize), e.compress != null && (this._compress = e.compress), e.allowList != null && (this._allowList = e.allowList), e.blockList != null && (this._blockList = e.blockList)), this._active = !0;
  }
  stop() {
    this._active = !1;
  }
  async handleIncoming(e) {
    const t = Ae(e);
    if (t.type !== y.REQUEST) return;
    if (!this._active) {
      await this._send(Z(t.requestId, "Proxy server not active"));
      return;
    }
    const { requestId: s, method: n, url: i, headers: r, body: c } = t;
    let o = 0;
    if (!this._isDomainAllowed(i)) {
      await this._send(Z(s, "Domain not allowed"));
      return;
    }
    try {
      const a = {}, l = {};
      for (const [w, I] of Object.entries(r))
        w.startsWith("x-proxy-opt-") ? l[w.slice(12)] = I : a[w] = I;
      const d = { method: n, headers: a };
      c && n !== "GET" && n !== "HEAD" && (d.body = c), l.redirect && (d.redirect = l.redirect), l.cache && (d.cache = l.cache), l.mode && (d.mode = l.mode), l.referrer && (d.referrer = l.referrer), l.referrerpolicy && (d.referrerPolicy = l.referrerpolicy), l.credentials && (d.credentials = l.credentials);
      const f = new URL(i), u = f.origin, g = f.host, b = a.origin || "";
      let M;
      try {
        const w = new URL(b);
        M = w.origin === u ? "same-origin" : w.hostname.endsWith("." + g) || g.endsWith("." + w.hostname) ? "same-site" : "cross-site";
      } catch {
        M = "none";
      }
      const R = (a.accept || "").toLowerCase();
      let T, _;
      R.includes("text/html") ? (T = "document", _ = "navigate") : R.includes("application/json") || R.startsWith("*/*") ? (T = "empty", _ = "cors") : R.includes("image/") ? (T = "image", _ = "no-cors") : R.includes("text/css") ? (T = "style", _ = "cors") : R.includes("application/javascript") || R.includes("text/javascript") ? (T = "script", _ = "no-cors") : R.includes("font/") ? (T = "font", _ = "cors") : (T = "empty", _ = "cors");
      for (const w of at) delete a[w];
      a.host = g, a.origin || (a.origin = u), a.referer || (a.referer = f.href), a["user-agent"] || (a["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"), a.accept || (a.accept = "*/*"), a["accept-language"] || (a["accept-language"] = "en-US,en;q=0.9"), a["accept-encoding"] = "identity", a["sec-fetch-site"] = M, a["sec-fetch-mode"] = _, a["sec-fetch-dest"] = T, a["sec-ch-ua"] = '"Google Chrome";v="124", "Chromium";v="124", "Not-A.Brand";v="99"', a["sec-ch-ua-mobile"] = "?0", a["sec-ch-ua-platform"] = '"Windows"', c && (a["content-length"] = String(c.byteLength || 0));
      const P = n === "GET" || n === "HEAD" ? `${n}:${i}` : null, S = P ? B.get(P) : null;
      if (S) {
        const w = a["if-none-match"], I = a["if-modified-since"];
        if (w && w === S.etag || I && S.lastModified && new Date(I) >= new Date(S.lastModified)) {
          await this._send(ye(s, 304, { etag: S.etag || "", "last-modified": S.lastModified || "" })), await this._send(Se(s));
          return;
        }
        S.etag && (a["if-none-match"] = S.etag), S.lastModified && (a["if-modified-since"] = S.lastModified);
      }
      const m = await fetch(i, d), A = {}, V = [];
      m.headers.forEach((w, I) => {
        const N = I.toLowerCase();
        if (!ot.has(N) && !ct.has(N)) {
          if (N === "set-cookie") {
            V.push(w);
            return;
          }
          A[I] = w;
        }
      }), V.length > 0 && (A["x-speedrtc-set-cookie"] = JSON.stringify(V));
      const re = m.headers.get("etag"), oe = m.headers.get("last-modified"), ae = m.headers.get("cache-control") || "", Pe = ae.includes("no-store") || ae.includes("no-cache");
      if (P && !Pe && rt.has(m.status) && (re || oe) && (B.size >= it && B.delete(B.keys().next().value), B.set(P, { etag: re, lastModified: oe })), A["x-speedrtc-status-text"] = m.statusText, A["x-speedrtc-url"] = m.url, m.redirected && (A["x-speedrtc-redirected"] = "1"), this._compress && (A["x-speedrtc-compressed"] = "gzip"), await this._send(ye(s, m.status, A)), m.body) {
        const I = (m.headers.get("content-type") || "").toLowerCase().includes("text/css"), N = m.url || i;
        let H = m.body;
        if (I) {
          const F = await new Response(H).arrayBuffer(), j = this._rewriteCssUrls(new TextDecoder().decode(F), N), U = new TextEncoder().encode(j), v = this._chunkSize;
          let x = 0;
          if (this._compress && typeof CompressionStream < "u") {
            const C = new CompressionStream("gzip"), z = C.writable.getWriter();
            z.write(U), z.close();
            const ce = C.readable.getReader();
            try {
              for (; ; ) {
                const { done: Ue, value: D } = await ce.read();
                if (Ue) break;
                if (D != null && D.length)
                  for (let G = 0; G < D.length; G += v)
                    await this._send(X(s, x++, D.subarray(G, G + v)));
              }
            } finally {
              ce.cancel().catch(() => {
              });
            }
          } else
            for (let C = 0; C < U.length; C += v)
              await this._send(X(s, x++, U.subarray(C, C + v)));
          o = x;
        } else {
          this._compress && typeof CompressionStream < "u" && (H = H.pipeThrough(new CompressionStream("gzip")));
          const F = H.getReader();
          let j = 0;
          const U = this._chunkSize;
          try {
            for (; ; ) {
              const { done: v, value: x } = await F.read();
              if (v) break;
              if (x != null && x.length)
                for (let C = 0; C < x.length; C += U) {
                  const z = x.subarray(C, C + U);
                  await this._send(X(s, j++, z));
                }
            }
          } finally {
            F.cancel().catch(() => {
            });
          }
          o = j;
        }
      }
      await this._send(Se(s, o));
    } catch (a) {
      await this._send(Z(s, a.message || "Proxy fetch failed"));
    }
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
class lt {
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
const Ce = 1, xe = 2, Ee = 3, ne = new TextEncoder(), ee = new TextDecoder();
class dt {
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
    const t = new ke(e, this._send);
    this._streams.set(e, t);
    const s = ne.encode(e), n = new ArrayBuffer(2 + s.length), i = new Uint8Array(n);
    return i[0] = Ce, i[1] = s.length, i.set(s, 2), this._send(n), t;
  }
  get(e) {
    return this._streams.get(e);
  }
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === Ce) {
      const n = t[1], i = ee.decode(t.slice(2, 2 + n)), r = new ke(i, this._send);
      this._streams.set(i, r), this._emit("incoming", r);
      return;
    }
    if (s === xe) {
      const n = t[1], i = ee.decode(t.slice(2, 2 + n)), r = e.slice(2 + n), c = this._streams.get(i);
      c && c._handleData(r);
      return;
    }
    if (s === Ee) {
      const n = t[1], i = ee.decode(t.slice(2, 2 + n)), r = this._streams.get(i);
      r && (r._handleClose(), this._streams.delete(i));
    }
  }
}
class ke {
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
    const t = new Uint8Array(e), s = ne.encode(this.name), n = new ArrayBuffer(2 + s.length + t.length), i = new Uint8Array(n);
    i[0] = xe, i[1] = s.length, i.set(s, 2), i.set(t, 2 + s.length), await this._send(n);
  }
  async close() {
    if (this._closed) return;
    this._closed = !0;
    const e = ne.encode(this.name), t = new ArrayBuffer(2 + e.length), s = new Uint8Array(t);
    s[0] = Ee, s[1] = e.length, s.set(e, 2), await this._send(t), this._emit("close");
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
}, ut = [
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
let be = 1, q = null, te = null;
function Me() {
  return q ? Promise.resolve(q) : (te || (te = RTCPeerConnection.generateCertificate({ name: "ECDSA", namedCurve: "P-256" }).then((h) => (q = h, h)).catch(() => null)), te);
}
Me();
function E(h, e) {
  const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length), n = new Uint8Array(s);
  return n[0] = h, n.set(t, 1), s;
}
class _t {
  constructor({
    iceServers: e = ut,
    dataChannels: t = 32,
    chunkSize: s = Ie,
    proxy: n = {},
    isHost: i = !1,
    requireRoomCode: r = !1,
    trackerUrls: c = null,
    driveSignal: o = null,
    serverMode: a = !1,
    iceTransportPolicy: l = "all",
    iceCandidatePoolSize: d = 10,
    signalServer: f = null
  } = {}) {
    this.iceServers = e, this.iceTransportPolicy = l, this.iceCandidatePoolSize = d, this.dataChannelCount = t, this.chunkSize = s, this.isHost = i, this.requireRoomCode = r, this.trackerUrls = c, this.driveSignalConfig = o, this.signalServerUrl = f, this.serverMode = a, this.remoteIsHost = !1, this.pc = null, this.signaling = null, this.pool = null, this.bonding = null, this.monitor = new Te(), this.roomCode = null, this.isOfferer = !1, this._listeners = {}, this._pendingMeta = /* @__PURE__ */ new Map(), this._probeTimers = /* @__PURE__ */ new Map(), this._negotiationState = "idle", this._pcCreated = !1, this._iceRestartPending = !1, this._pendingIceCandidates = [], this._pendingRemoteCandidates = [], this._preConnectedWs = null, this._preWarmedManager = null, this._proxyOpts = n, this.message = null, this._proxyClient = null, this._proxyServer = null, this.proxy = null, this.media = null, this.stream = null;
  }
  warmup() {
    var e;
    if (Me(), this._pcCreated || this._createPeerConnection(), this.driveSignalConfig && p.warmupToken(this.driveSignalConfig).catch(() => {
    }), this.signalServerUrl && !this._preConnectedWs && pe.preConnect(this.signalServerUrl).then((t) => {
      this._preConnectedWs = t;
    }).catch(() => {
    }), !this.driveSignalConfig && !this.signalServerUrl && !this._preWarmedManager) {
      const t = (e = this.trackerUrls) != null && e.length ? [...this.trackerUrls] : se.DEFAULT_TRACKER_URLS;
      this._preWarmedManager = new Re(t), this._preWarmedConnectPromise = this._preWarmedManager.connect().catch(() => {
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
    const t = be++, n = me(e, t, this.chunkSize).map((i) => E(k.CHUNK, i));
    await this.bonding.sendChunks(n);
  }
  async sendFile(e) {
    if (!this.bonding) throw new Error("Not connected");
    const t = be++, s = await e.arrayBuffer(), n = { name: e.name, size: e.size, type: e.type }, i = E(k.CHUNK, ze(t, n));
    for (const o of this.bonding.senders)
      try {
        await o(i);
      } catch {
      }
    await new Promise((o) => setTimeout(o, 50));
    const r = me(s, t, this.chunkSize), c = r.map((o) => E(k.CHUNK, o));
    this._emit("send-start", { transferId: t, name: e.name, totalChunks: r.length }), await this.bonding.sendChunks(c), this._emit("send-complete", { transferId: t, name: e.name });
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
    if (this._probeTimers.clear(), this.media && this.media.stop(), this.pool && this.pool.close(), this.pc && this.pc.close(), this.signaling && this.signaling.close(), this._preConnectedWs) {
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
      return new p(this.roomCode, e, this.driveSignalConfig);
    if (this.signalServerUrl) {
      const s = new pe(this.roomCode, e, this.signalServerUrl);
      return this._preConnectedWs && (s.usePreConnectedSocket(this._preConnectedWs), this._preConnectedWs = null), s;
    }
    const t = new se(this.roomCode, e, this.trackerUrls);
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
    q && (e.certificates = [q]), this.pc = new RTCPeerConnection(e), this.pc.onicecandidate = (t) => {
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
    }, this.pool = new Le(this.pc, {
      channelCount: this.dataChannelCount,
      ordered: this.serverMode
    }), this.pool.onOpen((t) => {
      this._emit("channel-open", t), this._updateBondingPaths();
    }), this.pool.onClose((t) => {
      this._emit("channel-close", t);
    }), this.pool.onMessage((t, s) => {
      this._routeIncoming(s, `dc-${t}`);
    }), this.pool.createChannels(), this.media = new lt(this.pc, () => this._renegotiate());
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
      const n = E(k.PROXY, s);
      this.pool.sendImmediate(n) === -1 && await this.pool.send(n);
    } : async (s) => {
      await e(E(k.PROXY, s));
    };
    this.message = new Qe(async (s) => {
      await e(E(k.MESSAGE, s));
    }), this._proxyClient = new st(t), this._proxyServer = new ht(t, this._proxyOpts), this.proxy = {
      fetch: (s, n) => this._proxyClient.fetch(s, n),
      serve: (s) => {
        s && (s.allowList != null && (this._proxyServer._allowList = s.allowList), s.blockList != null && (this._proxyServer._blockList = s.blockList), s.chunkSize != null && (this._proxyServer._chunkSize = s.chunkSize), s.compress != null && (this._proxyServer._compress = s.compress)), this._proxyServer.serve();
      },
      stop: () => this._proxyServer.stop()
    }, this.stream = new dt(async (s) => {
      await e(E(k.STREAM, s));
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
    this.bonding ? this.bonding.updatePaths(e, t) : (this.bonding = new Fe({
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
    const s = je(e);
    if (s.flags & L.PROBE) {
      this._handleProbe(s, t);
      return;
    }
    if (s.flags & L.META) {
      const n = Ge(s.payload);
      this._pendingMeta.set(s.transferId, n), this._emit("file-incoming", { transferId: s.transferId, ...n });
      return;
    }
    s.flags & L.DATA && this.bonding && this.bonding.receiveChunk(s);
  }
  _handleProxyData(e) {
    new DataView(e).getUint8(0) === y.REQUEST ? this._proxyServer && this._proxyServer.handleIncoming(e) : this._proxyClient && this._proxyClient.handleIncoming(e);
  }
  _startProbing() {
    const e = this.serverMode ? 8e3 : 3e3;
    for (const t of this.pool.openChannels) {
      const s = `dc-${t}`;
      this.monitor.addLink(s);
      const n = setInterval(async () => {
        const i = Je(performance.now());
        try {
          await this.pool.sendOnChannel(t, E(k.CHUNK, i)), this.monitor.recordProbeSent(s);
        } catch {
        }
      }, e);
      this._probeTimers.set(s, n);
    }
  }
  _handleProbe(e, t) {
    if (e.payload) {
      const s = Ke(e.payload), n = performance.now() - s;
      n > 0 && n < 3e4 && this.monitor.recordProbeResponse(t, n);
    }
  }
}
export {
  Fe as BondingEngine,
  Te as ConnectionMonitor,
  Ie as DEFAULT_CHUNK_SIZE,
  Le as DataChannelPool,
  pe as DirectSignal,
  p as DriveSignal,
  L as Flags,
  K as HEADER_SIZE,
  lt as MediaManager,
  Qe as Messenger,
  st as ProxyClient,
  y as ProxyFrameType,
  ht as ProxyServer,
  Re as SignalManager,
  _t as SpeedRTC,
  ke as Stream,
  dt as StreamManager,
  je as decodeChunk,
  Ge as decodeMetaPayload,
  Ke as decodeProbeTimestamp,
  Ae as decodeProxyFrame,
  ie as encodeChunk,
  ze as encodeMetaChunk,
  Je as encodeProbe,
  Xe as encodeRequest,
  me as splitIntoChunks
};
