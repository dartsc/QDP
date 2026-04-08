class Ce {
  constructor(e, { channelCount: t = 4, ordered: s = !1, protocol: n = "fastrtc" } = {}) {
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
      const t = `fastrtc-${e}`, s = this.pc.createDataChannel(t, {
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
const re = 0.3, Re = 2e4, Te = 8e3, Ie = 8e3, Ae = 4;
class xe {
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
      }, Ie);
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
      this.ws.onclose = null, this.ws.onerror = null, this.ws.onmessage = null;
      try {
        this.ws.close();
      } catch {
      }
      this.ws = null;
    }
  }
  _handleRaw(e) {
    if (this._awaitingResponse && this._lastSentAt > 0) {
      const s = performance.now() - this._lastSentAt;
      this._awaitingResponse = !1, this.latency = this.latency === 0 ? s : re * s + (1 - re) * this.latency;
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
class Ee {
  constructor(e) {
    this.nodes = e.map((t) => new xe(t)), this._active = [], this._primary = null, this._pingTimer = null, this._rebalanceTimer = null, this.onMessage = null, this.onRebalance = null;
  }
  get connected() {
    return this._active.some((e) => e.connected);
  }
  get sockets() {
    return this._active.filter((e) => e.ws).map((e) => e.ws);
  }
  async connect() {
    const e = await Promise.allSettled(
      this.nodes.map((t) => (t._onMessage = (s, n) => this._onRawMessage(s, n), t.connect()))
    );
    if (this._active = e.filter((t) => t.status === "fulfilled").map((t) => t.value).slice(0, Ae), this._active.length === 0)
      throw new Error("SignalManager: all trackers failed to connect");
    return this._primary = this._best(), this._startTimers(), this._active.length;
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
    this._stopTimers();
    for (const e of this._active) e.close();
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
    }, Te), this._rebalanceTimer = setInterval(() => {
      this._rebalance();
    }, Re);
  }
  _stopTimers() {
    clearInterval(this._pingTimer), clearInterval(this._rebalanceTimer), this._pingTimer = null, this._rebalanceTimer = null;
  }
  _onRawMessage(e, t) {
    this.onMessage && this.onMessage(e, t);
  }
}
class Ue {
  constructor(e, t, s = null) {
    this.roomCode = e, this.isOfferer = t;
    const n = Array.from("FRTC" + e).map((r) => r.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    this.infoHash = n.padEnd(40, "0"), this.peerId = Array.from(crypto.getRandomValues(new Uint8Array(20))).map((r) => r.toString(16).padStart(2, "0")).join("");
    const i = s != null && s.length ? [...s] : [
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
    this._manager = new Ee(i), this.remotePeerId = null, this._preferredNodeUrl = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this._announceInterval = null;
  }
  get sockets() {
    return this._manager.sockets;
  }
  connect() {
    this._manager.onMessage = (e, t) => this._handleMessage(e, t), this._manager.onRebalance = (e, t) => {
      !this.remotePeerId && this.isOfferer && this._announce(!1);
    }, this._manager.connect().then(() => {
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
      s.to_peer_id = this.remotePeerId, s.answer = { type: "answer", sdp: t }, s.offer_id = "fastrtc-relay";
      const n = JSON.stringify(s);
      this._preferredNodeUrl ? this._manager.sendTo(this._preferredNodeUrl, n) || this._manager.send(n) : this._manager.send(n);
    } else this.isOfferer && (s.numwant = 1, s.offers = [{
      offer_id: "fastrtc-relay",
      offer: { type: "offer", sdp: t }
    }], this._manager.broadcast(JSON.stringify(s)));
  }
  _announce(e = !0) {
    const t = JSON.stringify({
      action: "announce",
      info_hash: this.infoHash,
      peer_id: this.peerId,
      numwant: 1
    });
    e ? this._manager.broadcast(t) : this._manager.send(t);
  }
  _startAnnouncing() {
    this.isOfferer ? (this._announce(), this._announceInterval = setInterval(() => this._announce(), 2e3)) : this._announce();
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
    s.action === "announce" && s.peer_id && s.peer_id !== this.peerId && this.isOfferer && !this.remotePeerId && (this.remotePeerId = s.peer_id, this._preferredNodeUrl = t.url, this._stopAnnouncing(), this.onMessage && this.onMessage({ type: "peer-joined" }));
  }
}
const V = "https://oauth2.googleapis.com/token", oe = "https://www.googleapis.com/auth/spreadsheets", Me = "https://accounts.google.com/gsi/client";
let ae = !1, G = null;
class g {
  constructor(e, t, s = {}) {
    if (this.roomCode = e, this.isOfferer = t, this.spreadsheetId = s.spreadsheetId, this.pollInterval = s.pollInterval || 1500, this.sheetName = s.sheetName || e, !this.spreadsheetId)
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
    this.peerId = g._generatePeerId(), this.remotePeerId = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this.connected = !1, this._pollTimer = null, this._myColumn = null, this._remoteColIndex = null, this._readCursor = 1, this._destroyed = !1, this._baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
  }
  async connect() {
    try {
      if (this._authMode === "raw") {
        if (await this._registerColumn(), this._lastRawValues && this._myColumn) {
          const e = g._colIndex(this._myColumn);
          let t = 0;
          for (let s = 0; s < this._lastRawValues.length; s++)
            this._lastRawValues[s] && this._lastRawValues[s][e] && (t = s + 1);
          this._myWriteRow = t;
        }
      } else
        await this._ensureToken(), await this._ensureSheet(), await this._registerColumn(), this._myWriteRow = 2;
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
  async _ensureSheet() {
    const e = `${this.sheetName}!A1`;
    try {
      await this._sheetsRequest(
        `/${this.spreadsheetId}/values/${encodeURIComponent(e)}`,
        "GET"
      );
    } catch (t) {
      if (t.status === 400 || t.status === 404)
        await this._sheetsRequest(
          `/${this.spreadsheetId}:batchUpdate`,
          "POST",
          {
            requests: [{
              addSheet: { properties: { title: this.sheetName } }
            }]
          }
        );
      else
        throw t;
    }
  }
  async _registerColumn() {
    const e = await this._readHeaders(), t = e.indexOf(this.peerId);
    if (t >= 0) {
      this._myColumn = g._colLetter(t);
      return;
    }
    const s = e.length;
    this._myColumn = g._colLetter(s), await this._writeCell(`${this.sheetName}!${this._myColumn}1`, this.peerId);
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
          const s = g._colIndex(this._myColumn);
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
    const h = await a.text();
    return h ? JSON.parse(h) : {};
  }
  async _ensureToken() {
    this._authMode !== "apikey" && (this._accessToken && Date.now() < this._tokenExpiry - 5e3 || (this._authMode === "refresh" ? await this._refreshAccessToken() : this._authMode === "service" ? await this._mintServiceAccountToken() : this._authMode === "client" && await this._requestClientToken()));
  }
  async _refreshAccessToken() {
    const e = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this._clientId,
      client_secret: this._clientSecret,
      refresh_token: this._refreshToken
    }), t = await fetch(V, {
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
      scope: oe,
      aud: V,
      iat: e,
      exp: e + 3600
    }, s = await g._signJwt(t, this._serviceAccount.private_key, this), n = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: s
    }), i = await fetch(V, {
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
    return await g._loadGisScript(), this._gisTokenClient || (this._gisTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this._clientId,
      scope: oe,
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
    return ae && typeof google < "u" && google.accounts ? Promise.resolve() : G || (G = new Promise((e, t) => {
      const s = document.createElement("script");
      s.src = Me, s.async = !0, s.onload = () => {
        ae = !0, e();
      }, s.onerror = () => t(new Error("[DriveSignal] Failed to load Google Identity Services script")), document.head.appendChild(s);
    }), G);
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
      const { row: s, col: n } = g._parseRange(e);
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
      const i = g._colIndex(e), r = this._myWriteRow;
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
    }), a = `https://docs.google.com/spreadsheets/u/0/d/${this.spreadsheetId}/save?${o}`, h = new FormData();
    h.append("rev", String(this._rawRev)), h.append("bundles", c);
    try {
      await fetch(a, {
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
      window[t] = (i) => {
        clearTimeout(s), delete window[t], e(g._parseGvizTable(i));
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
      col: g._colIndex(s[1]),
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
    s._signingKey || (s._signingKey = await g._importPem(t));
    const n = { alg: "RS256", typ: "JWT" }, i = [
      g._b64url(JSON.stringify(n)),
      g._b64url(JSON.stringify(e))
    ], r = new TextEncoder().encode(i.join(".")), c = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      s._signingKey,
      r
    );
    return i.push(g._b64urlBuf(c)), i.join(".");
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
class me {
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
class ve {
  constructor({ senders: e = [], linkIds: t = [], monitor: s = null } = {}) {
    this.senders = e, this.linkIds = t, this.monitor = s || new me();
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
      const a = this.linkIds[o], h = s.get(a) || 1 / this.linkIds.length, d = Math.round(h * e);
      n.set(o, d), i += d;
    }
    if (i < e) {
      const o = this._pickBestSender();
      n.set(o, (n.get(o) || 0) + (e - i));
    } else if (i > e)
      for (let o = this.linkIds.length - 1; o >= 0 && i > e; o--) {
        const a = n.get(o) || 0, h = Math.min(a, i - e);
        n.set(o, a - h), i -= h;
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
const K = 13, ge = 64 * 1024, L = {
  DATA: 1,
  ACK: 2,
  FIN: 4,
  PROBE: 8,
  META: 16
};
function ee({ transferId: l, chunkIndex: e, totalChunks: t, flags: s, payload: n }) {
  const i = n ? n instanceof Uint8Array ? n : new Uint8Array(n) : new Uint8Array(0), r = new ArrayBuffer(K + i.byteLength), c = new DataView(r);
  return c.setUint32(0, l, !0), c.setUint32(4, e, !0), c.setUint32(8, t, !0), c.setUint8(12, s), i.byteLength > 0 && new Uint8Array(r, K).set(i), r;
}
function Pe(l) {
  const e = new DataView(l);
  return {
    transferId: e.getUint32(0, !0),
    chunkIndex: e.getUint32(4, !0),
    totalChunks: e.getUint32(8, !0),
    flags: e.getUint8(12),
    payload: l.byteLength > K ? new Uint8Array(l, K) : null
  };
}
function ce(l, e, t = ge) {
  const s = new Uint8Array(l), n = Math.ceil(s.byteLength / t), i = [];
  for (let r = 0; r < n; r++) {
    const c = r * t, o = Math.min(c + t, s.byteLength), a = s.slice(c, o);
    i.push(
      ee({
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
function Oe(l, e) {
  const t = JSON.stringify(e), n = new TextEncoder().encode(t);
  return ee({
    transferId: l,
    chunkIndex: 0,
    totalChunks: 0,
    flags: L.META,
    payload: n
  });
}
function Le(l) {
  const e = new TextDecoder();
  return JSON.parse(e.decode(l));
}
function De(l) {
  const e = new Uint8Array(8);
  return new DataView(e.buffer).setFloat64(0, l, !0), ee({
    transferId: 0,
    chunkIndex: 0,
    totalChunks: 0,
    flags: L.PROBE,
    payload: e
  });
}
function Ne(l) {
  return new DataView(l.buffer, l.byteOffset, l.byteLength).getFloat64(0, !0);
}
const he = 1, le = 2, Be = new TextEncoder(), $e = new TextDecoder();
class We {
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
    const t = Be.encode(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = he, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  async sendBinary(e) {
    const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length);
    new Uint8Array(s)[0] = le, new Uint8Array(s, 1).set(t), await this._send(s);
  }
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === he) {
      const n = $e.decode(t.slice(1));
      this._emit("text", n);
    } else s === le && this._emit("binary", e.slice(1));
  }
}
const y = {
  REQUEST: 1,
  RESPONSE: 2,
  BODY: 3,
  END: 4,
  ERROR: 5
}, W = new TextEncoder(), B = new TextDecoder();
function qe(l, e, t, s = {}, n = null) {
  const i = W.encode(e), r = W.encode(t), c = W.encode(JSON.stringify(s)), o = n ? new Uint8Array(n) : new Uint8Array(0), a = 6 + i.length + 2 + r.length + 4 + c.length + o.length, h = new ArrayBuffer(a), d = new DataView(h), f = new Uint8Array(h);
  let u = 0;
  return d.setUint8(u, y.REQUEST), u += 1, d.setUint32(u, l, !0), u += 4, d.setUint8(u, i.length), u += 1, f.set(i, u), u += i.length, d.setUint16(u, r.length, !0), u += 2, f.set(r, u), u += r.length, d.setUint32(u, c.length, !0), u += 4, f.set(c, u), u += c.length, o.length > 0 && f.set(o, u), h;
}
function de(l, e, t = {}) {
  const s = W.encode(JSON.stringify(t)), n = 11 + s.length, i = new ArrayBuffer(n), r = new DataView(i), c = new Uint8Array(i);
  let o = 0;
  return r.setUint8(o, y.RESPONSE), o += 1, r.setUint32(o, l, !0), o += 4, r.setUint16(o, e, !0), o += 2, r.setUint32(o, s.length, !0), o += 4, c.set(s, o), i;
}
function Y(l, e, t) {
  const s = new Uint8Array(t), n = new ArrayBuffer(9 + s.length), i = new DataView(n);
  return new Uint8Array(n).set(s, 9), i.setUint8(0, y.BODY), i.setUint32(1, l, !0), i.setUint32(5, e, !0), n;
}
function ue(l, e = 0) {
  const t = new ArrayBuffer(9), s = new DataView(t);
  return s.setUint8(0, y.END), s.setUint32(1, l, !0), s.setUint32(5, e, !0), t;
}
function Q(l, e) {
  const t = W.encode(e), s = new ArrayBuffer(5 + t.length), n = new DataView(s);
  return new Uint8Array(s).set(t, 5), n.setUint8(0, y.ERROR), n.setUint32(1, l, !0), s;
}
function we(l) {
  const e = new DataView(l), t = new Uint8Array(l), s = e.getUint8(0), n = e.getUint32(1, !0);
  switch (s) {
    case y.REQUEST: {
      let i = 5;
      const r = e.getUint8(i);
      i += 1;
      const c = B.decode(t.slice(i, i + r));
      i += r;
      const o = e.getUint16(i, !0);
      i += 2;
      const a = B.decode(t.slice(i, i + o));
      i += o;
      const h = e.getUint32(i, !0);
      i += 4;
      const d = JSON.parse(B.decode(t.slice(i, i + h)));
      i += h;
      const f = i < l.byteLength ? l.slice(i) : null;
      return { type: s, requestId: n, method: c, url: a, headers: d, body: f };
    }
    case y.RESPONSE: {
      let i = 5;
      const r = e.getUint16(i, !0);
      i += 2;
      const c = e.getUint32(i, !0);
      i += 4;
      const o = JSON.parse(B.decode(t.slice(i, i + c)));
      return { type: s, requestId: n, status: r, headers: o };
    }
    case y.BODY: {
      const i = e.getUint32(5, !0);
      return { type: s, requestId: n, seqNum: i, data: l.slice(9) };
    }
    case y.END:
      return { type: s, requestId: n, seqCount: l.byteLength >= 9 ? e.getUint32(5, !0) : 0 };
    case y.ERROR:
      return { type: s, requestId: n, message: B.decode(t.slice(5)) };
    default:
      return { type: s, requestId: n };
  }
}
class He {
  constructor(e) {
    this._map = {}, this._internal = /* @__PURE__ */ new Set();
    for (const [t, s] of Object.entries(e)) {
      const n = t.toLowerCase();
      this._map[n] = s, n.startsWith("x-fastrtc-") && this._internal.add(n);
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
let Fe = 1;
class je {
  constructor() {
    this._cookies = [];
  }
  store(e, t) {
    if (!t) return;
    const s = Array.isArray(t) ? t : [t], n = this._parseOrigin(e), i = Date.now();
    for (const r of s) {
      const c = r.split(";").map((_) => _.trim()), [o] = c, a = o.indexOf("=");
      if (a < 0) continue;
      const h = o.slice(0, a).trim(), d = o.slice(a + 1).trim();
      let f = n.hostname, u = "/", m = null, C = !1, U = n.protocol === "https:";
      for (let _ = 1; _ < c.length; _++) {
        const [M, S = ""] = c[_].split("=").map((A) => A.trim()), p = M.toLowerCase();
        p === "domain" ? f = S.replace(/^\./, "") : p === "path" ? u = S || "/" : p === "expires" ? m = new Date(S).getTime() : p === "max-age" ? m = i + parseInt(S, 10) * 1e3 : p === "httponly" ? C = !0 : p === "secure" && (U = !0);
      }
      if (m !== null && m < i) {
        this._cookies = this._cookies.filter((_) => !(_.name === h && _.domain === f && _.path === u));
        continue;
      }
      const R = this._cookies.findIndex((_) => _.name === h && _.domain === f && _.path === u), T = { name: h, value: d, domain: f, path: u, expires: m, httpOnly: C, secure: U };
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
class ze {
  constructor(e) {
    this._send = e, this._pending = /* @__PURE__ */ new Map(), this.cookieJar = new je();
  }
  async fetch(e, t = {}) {
    const s = Fe++, n = (t.method || "GET").toUpperCase(), i = Object.assign({}, t.headers || {});
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
        const a = t.body.getReader(), h = [];
        let d = 0;
        for (; ; ) {
          const { done: m, value: C } = await a.read();
          if (m) break;
          h.push(C), d += C.byteLength;
        }
        const f = new Uint8Array(d);
        let u = 0;
        for (const m of h)
          f.set(m, u), u += m.byteLength;
        r = f.buffer;
      }
    }
    t.redirect && (i["x-proxy-opt-redirect"] = t.redirect), t.cache && (i["x-proxy-opt-cache"] = t.cache), t.mode && (i["x-proxy-opt-mode"] = t.mode), t.referrer && (i["x-proxy-opt-referrer"] = t.referrer), t.referrerPolicy && (i["x-proxy-opt-referrerpolicy"] = t.referrerPolicy), t.credentials && (i["x-proxy-opt-credentials"] = t.credentials);
    try {
      const a = new URL(e).origin, h = this.cookieJar.get(e);
      h && !i.cookie && (i.cookie = h);
    } catch {
    }
    const c = t.timeout || 3e4, o = qe(s, n, e, i, r);
    return new Promise((a, h) => {
      const d = t.signal;
      let f = !1;
      const u = setTimeout(() => {
        f || (f = !0, this._pending.delete(s), h(new DOMException(`Proxy request timed out: ${n} ${e}`, "TimeoutError")));
      }, c), m = () => {
        f || (f = !0, clearTimeout(u), this._pending.delete(s), h(d.reason || new DOMException("The operation was aborted.", "AbortError")));
      };
      if (d) {
        if (d.aborted) {
          m();
          return;
        }
        d.addEventListener("abort", m, { once: !0 });
      }
      this._pending.set(s, {
        resolve: (C) => {
          d && d.removeEventListener("abort", m), a(C);
        },
        reject: (C) => {
          d && d.removeEventListener("abort", m), h(C);
        },
        timeout: u,
        url: e,
        status: 0,
        headers: {},
        bodyChunks: [],
        totalBodySize: 0,
        seqCount: -1,
        endReceived: !1
      }), this._send(o).catch(h);
    });
  }
  handleIncoming(e) {
    const t = we(e), s = this._pending.get(t.requestId);
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
    const i = new He(t.headers), r = i.get("x-fastrtc-compressed") === "gzip", c = i.get("x-fastrtc-set-cookie");
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
      let h = 0;
      for (const d of c)
        a.set(d, h), h += d.byteLength;
      t.resolve(new O(t.status, s, a.buffer));
    } catch {
      t.resolve(new O(t.status, s, e));
    }
  }
}
class O {
  constructor(e, t, s) {
    this.status = e, this.statusText = t.get("x-fastrtc-status-text") || "", this.url = t.get("x-fastrtc-url") || "", this.redirected = t.get("x-fastrtc-redirected") === "1", this.ok = e >= 200 && e < 300, this.type = "basic", this.headers = t, this._body = s, this.bodyUsed = !1, this.body = typeof ReadableStream < "u" ? new ReadableStream({
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
const Ge = 16 * 1024, $ = /* @__PURE__ */ new Map(), Ke = 200, Je = /* @__PURE__ */ new Set([200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501]), Ve = /* @__PURE__ */ new Set([
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
]), Ye = /* @__PURE__ */ new Set([
  "host",
  "origin",
  "referer"
]), Qe = /* @__PURE__ */ new Set([
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
class Xe {
  constructor(e, t = {}) {
    this._send = e, this._allowList = t.allowList || [], this._blockList = t.blockList || [], this._chunkSize = t.chunkSize || Ge, this._compress = t.compress || !1, this._active = !1;
  }
  serve(e) {
    e && (e.chunkSize != null && (this._chunkSize = e.chunkSize), e.compress != null && (this._compress = e.compress), e.allowList != null && (this._allowList = e.allowList), e.blockList != null && (this._blockList = e.blockList)), this._active = !0;
  }
  stop() {
    this._active = !1;
  }
  async handleIncoming(e) {
    const t = we(e);
    if (t.type !== y.REQUEST) return;
    if (!this._active) {
      await this._send(Q(t.requestId, "Proxy server not active"));
      return;
    }
    const { requestId: s, method: n, url: i, headers: r, body: c } = t;
    let o = 0;
    if (!this._isDomainAllowed(i)) {
      await this._send(Q(s, "Domain not allowed"));
      return;
    }
    try {
      const a = {}, h = {};
      for (const [w, I] of Object.entries(r))
        w.startsWith("x-proxy-opt-") ? h[w.slice(12)] = I : a[w] = I;
      const d = { method: n, headers: a };
      c && n !== "GET" && n !== "HEAD" && (d.body = c), h.redirect && (d.redirect = h.redirect), h.cache && (d.cache = h.cache), h.mode && (d.mode = h.mode), h.referrer && (d.referrer = h.referrer), h.referrerpolicy && (d.referrerPolicy = h.referrerpolicy), h.credentials && (d.credentials = h.credentials);
      const f = new URL(i), u = f.origin, m = f.host, C = a.origin || "";
      let U;
      try {
        const w = new URL(C);
        U = w.origin === u ? "same-origin" : w.hostname.endsWith("." + m) || m.endsWith("." + w.hostname) ? "same-site" : "cross-site";
      } catch {
        U = "none";
      }
      const R = (a.accept || "").toLowerCase();
      let T, _;
      R.includes("text/html") ? (T = "document", _ = "navigate") : R.includes("application/json") || R.startsWith("*/*") ? (T = "empty", _ = "cors") : R.includes("image/") ? (T = "image", _ = "no-cors") : R.includes("text/css") ? (T = "style", _ = "cors") : R.includes("application/javascript") || R.includes("text/javascript") ? (T = "script", _ = "no-cors") : R.includes("font/") ? (T = "font", _ = "cors") : (T = "empty", _ = "cors");
      for (const w of Ye) delete a[w];
      a.host = m, a.origin || (a.origin = u), a.referer || (a.referer = f.href), a["user-agent"] || (a["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"), a.accept || (a.accept = "*/*"), a["accept-language"] || (a["accept-language"] = "en-US,en;q=0.9"), a["accept-encoding"] = "identity", a["sec-fetch-site"] = U, a["sec-fetch-mode"] = _, a["sec-fetch-dest"] = T, a["sec-ch-ua"] = '"Google Chrome";v="124", "Chromium";v="124", "Not-A.Brand";v="99"', a["sec-ch-ua-mobile"] = "?0", a["sec-ch-ua-platform"] = '"Windows"', c && (a["content-length"] = String(c.byteLength || 0));
      const M = n === "GET" || n === "HEAD" ? `${n}:${i}` : null, S = M ? $.get(M) : null;
      if (S) {
        const w = a["if-none-match"], I = a["if-modified-since"];
        if (w && w === S.etag || I && S.lastModified && new Date(I) >= new Date(S.lastModified)) {
          await this._send(de(s, 304, { etag: S.etag || "", "last-modified": S.lastModified || "" })), await this._send(ue(s));
          return;
        }
        S.etag && (a["if-none-match"] = S.etag), S.lastModified && (a["if-modified-since"] = S.lastModified);
      }
      const p = await fetch(i, d), A = {}, J = [];
      p.headers.forEach((w, I) => {
        const D = I.toLowerCase();
        if (!Ve.has(D) && !Qe.has(D)) {
          if (D === "set-cookie") {
            J.push(w);
            return;
          }
          A[I] = w;
        }
      }), J.length > 0 && (A["x-fastrtc-set-cookie"] = JSON.stringify(J));
      const te = p.headers.get("etag"), se = p.headers.get("last-modified"), ne = p.headers.get("cache-control") || "", be = ne.includes("no-store") || ne.includes("no-cache");
      if (M && !be && Je.has(p.status) && (te || se) && ($.size >= Ke && $.delete($.keys().next().value), $.set(M, { etag: te, lastModified: se })), A["x-fastrtc-status-text"] = p.statusText, A["x-fastrtc-url"] = p.url, p.redirected && (A["x-fastrtc-redirected"] = "1"), this._compress && (A["x-fastrtc-compressed"] = "gzip"), await this._send(de(s, p.status, A)), p.body) {
        const I = (p.headers.get("content-type") || "").toLowerCase().includes("text/css"), D = p.url || i;
        let q = p.body;
        if (I) {
          const H = await new Response(q).arrayBuffer(), F = this._rewriteCssUrls(new TextDecoder().decode(H), D), v = new TextEncoder().encode(F), P = this._chunkSize;
          let x = 0;
          if (this._compress && typeof CompressionStream < "u") {
            const b = new CompressionStream("gzip"), j = b.writable.getWriter();
            j.write(v), j.close();
            const ie = b.readable.getReader();
            try {
              for (; ; ) {
                const { done: ke, value: N } = await ie.read();
                if (ke) break;
                if (N != null && N.length)
                  for (let z = 0; z < N.length; z += P)
                    await this._send(Y(s, x++, N.subarray(z, z + P)));
              }
            } finally {
              ie.cancel().catch(() => {
              });
            }
          } else
            for (let b = 0; b < v.length; b += P)
              await this._send(Y(s, x++, v.subarray(b, b + P)));
          o = x;
        } else {
          this._compress && typeof CompressionStream < "u" && (q = q.pipeThrough(new CompressionStream("gzip")));
          const H = q.getReader();
          let F = 0;
          const v = this._chunkSize;
          try {
            for (; ; ) {
              const { done: P, value: x } = await H.read();
              if (P) break;
              if (x != null && x.length)
                for (let b = 0; b < x.length; b += v) {
                  const j = x.subarray(b, b + v);
                  await this._send(Y(s, F++, j));
                }
            }
          } finally {
            H.cancel().catch(() => {
            });
          }
          o = F;
        }
      }
      await this._send(ue(s, o));
    } catch (a) {
      await this._send(Q(s, a.message || "Proxy fetch failed"));
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
class Ze {
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
const fe = 1, ye = 2, Se = 3, Z = new TextEncoder(), X = new TextDecoder();
class et {
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
    const t = new _e(e, this._send);
    this._streams.set(e, t);
    const s = Z.encode(e), n = new ArrayBuffer(2 + s.length), i = new Uint8Array(n);
    return i[0] = fe, i[1] = s.length, i.set(s, 2), this._send(n), t;
  }
  get(e) {
    return this._streams.get(e);
  }
  handleIncoming(e) {
    const t = new Uint8Array(e), s = t[0];
    if (s === fe) {
      const n = t[1], i = X.decode(t.slice(2, 2 + n)), r = new _e(i, this._send);
      this._streams.set(i, r), this._emit("incoming", r);
      return;
    }
    if (s === ye) {
      const n = t[1], i = X.decode(t.slice(2, 2 + n)), r = e.slice(2 + n), c = this._streams.get(i);
      c && c._handleData(r);
      return;
    }
    if (s === Se) {
      const n = t[1], i = X.decode(t.slice(2, 2 + n)), r = this._streams.get(i);
      r && (r._handleClose(), this._streams.delete(i));
    }
  }
}
class _e {
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
    const t = new Uint8Array(e), s = Z.encode(this.name), n = new ArrayBuffer(2 + s.length + t.length), i = new Uint8Array(n);
    i[0] = ye, i[1] = s.length, i.set(s, 2), i.set(t, 2 + s.length), await this._send(n);
  }
  async close() {
    if (this._closed) return;
    this._closed = !0;
    const e = Z.encode(this.name), t = new ArrayBuffer(2 + e.length), s = new Uint8Array(t);
    s[0] = Se, s[1] = e.length, s.set(e, 2), await this._send(t), this._emit("close");
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
}, tt = [
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
let pe = 1;
function E(l, e) {
  const t = new Uint8Array(e), s = new ArrayBuffer(1 + t.length), n = new Uint8Array(s);
  return n[0] = l, n.set(t, 1), s;
}
class st {
  constructor({
    iceServers: e = tt,
    dataChannels: t = 32,
    chunkSize: s = ge,
    proxy: n = {},
    isHost: i = !1,
    requireRoomCode: r = !1,
    trackerUrls: c = null,
    driveSignal: o = null,
    serverMode: a = !1,
    iceTransportPolicy: h = "all",
    iceCandidatePoolSize: d = 10
  } = {}) {
    this.iceServers = e, this.iceTransportPolicy = h, this.iceCandidatePoolSize = d, this.dataChannelCount = t, this.chunkSize = s, this.isHost = i, this.requireRoomCode = r, this.trackerUrls = c, this.driveSignalConfig = o, this.serverMode = a, this.remoteIsHost = !1, this.pc = null, this.signaling = null, this.pool = null, this.bonding = null, this.monitor = new me(), this.roomCode = null, this.isOfferer = !1, this._listeners = {}, this._pendingMeta = /* @__PURE__ */ new Map(), this._probeTimers = /* @__PURE__ */ new Map(), this._negotiationState = "idle", this._pcCreated = !1, this._iceRestartPending = !1, this._proxyOpts = n, this.message = null, this._proxyClient = null, this._proxyServer = null, this.proxy = null, this.media = null, this.stream = null;
  }
  warmup() {
    this._pcCreated || this._createPeerConnection();
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
          console.error("FastRTC event error:", n);
        }
  }
  async createRoom(e = null) {
    return this.isOfferer = !0, e ? this.roomCode = e : this.requireRoomCode ? this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase() : this.roomCode = "FASTRTC-PUBLIC-SWARM", new Promise((t, s) => {
      this.signaling = this._createSignaling(!0), this.signaling.onOpen = () => {
        this._pcCreated || this._createPeerConnection(), this._emit("wss-open", 0), this._emit("room-created", this.roomCode), t(this.roomCode);
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
      this._joinResolver = t, this.signaling = this._createSignaling(!1), this.signaling.onOpen = () => {
        this._pcCreated || this._createPeerConnection(), this._emit("wss-open", 0);
      }, this.signaling.onMessage = (n) => {
        this._onSignalingMessage(n);
      }, this.signaling.onClose = () => {
        this._emit("wss-close", 0);
      }, this.signaling.connect();
    });
  }
  async send(e) {
    if (!this.bonding) throw new Error("Not connected");
    const t = pe++, n = ce(e, t, this.chunkSize).map((i) => E(k.CHUNK, i));
    await this.bonding.sendChunks(n);
  }
  async sendFile(e) {
    if (!this.bonding) throw new Error("Not connected");
    const t = pe++, s = await e.arrayBuffer(), n = { name: e.name, size: e.size, type: e.type }, i = E(k.CHUNK, Oe(t, n));
    for (const o of this.bonding.senders)
      try {
        await o(i);
      } catch {
      }
    await new Promise((o) => setTimeout(o, 50));
    const r = ce(s, t, this.chunkSize), c = r.map((o) => E(k.CHUNK, o));
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
    this._probeTimers.clear(), this.media && this.media.stop(), this.pool && this.pool.close(), this.pc && this.pc.close(), this.signaling && this.signaling.close(), this.pc = null, this.pool = null, this.bonding = null, this.signaling = null, this.message = null, this.proxy = null, this.media = null, this.stream = null;
  }
  _createSignaling(e) {
    return this.driveSignalConfig ? new g(this.roomCode, e, this.driveSignalConfig) : new Ue(this.roomCode, e, this.trackerUrls);
  }
  _isSignalingReady() {
    return this.signaling ? this.signaling.connected !== void 0 ? this.signaling.connected : this.signaling.sockets ? this.signaling.sockets.some((e) => e.readyState === WebSocket.OPEN) : !1 : !1;
  }
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
  _createPeerConnection() {
    this._pcCreated || (this._pcCreated = !0, this.pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy: this.iceTransportPolicy,
      iceCandidatePoolSize: this.iceCandidatePoolSize,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require"
    }), this.pc.onicecandidate = (e) => {
      this.driveSignalConfig || e.candidate && this._isSignalingReady() && this.signaling.send({
        type: "ice-candidate",
        candidate: e.candidate,
        roomCode: this.roomCode
      });
    }, this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const e = this.pc.connectionState;
      this._emit("connection-state", e), e === "connected" ? (this._iceRestartPending = !1, this._onPeerConnected()) : (e === "disconnected" || e === "failed") && (e === "failed" && !this._iceRestartPending ? (this._iceRestartPending = !0, this._restartIce()) : this._emit("disconnected"));
    }, this.pc.oniceconnectionstatechange = () => {
      this.pc && this._emit("ice-state", this.pc.iceConnectionState);
    }, this.pool = new Ce(this.pc, {
      channelCount: this.dataChannelCount,
      ordered: this.serverMode
    }), this.pool.onOpen((e) => {
      this._emit("channel-open", e), this._updateBondingPaths();
    }), this.pool.onClose((e) => {
      this._emit("channel-close", e);
    }), this.pool.onMessage((e, t) => {
      this._routeIncoming(t, `dc-${e}`);
    }), this.pool.createChannels(), this.media = new Ze(this.pc, () => this._renegotiate()));
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
    await this.pc.setRemoteDescription(new RTCSessionDescription(e));
    const t = await this.pc.createAnswer();
    await this.pc.setLocalDescription(t), this.driveSignalConfig && await this._waitForIceGathering(), this.signaling.send({
      type: "answer",
      sdp: this.pc.localDescription,
      roomCode: this.roomCode,
      isHost: this.isHost
    }), this._joinResolver && (this._joinResolver(), this._joinResolver = null);
  }
  async _handleAnswer(e) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(e));
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
    if (this.pc && e)
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(e));
      } catch {
      }
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
    this.message = new We(async (s) => {
      await e(E(k.MESSAGE, s));
    }), this._proxyClient = new ze(t), this._proxyServer = new Xe(t, this._proxyOpts), this.proxy = {
      fetch: (s, n) => this._proxyClient.fetch(s, n),
      serve: (s) => {
        s && (s.allowList != null && (this._proxyServer._allowList = s.allowList), s.blockList != null && (this._proxyServer._blockList = s.blockList), s.chunkSize != null && (this._proxyServer._chunkSize = s.chunkSize), s.compress != null && (this._proxyServer._compress = s.compress)), this._proxyServer.serve();
      },
      stop: () => this._proxyServer.stop()
    }, this.stream = new et(async (s) => {
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
    this.bonding ? this.bonding.updatePaths(e, t) : (this.bonding = new ve({
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
    const s = Pe(e);
    if (s.flags & L.PROBE) {
      this._handleProbe(s, t);
      return;
    }
    if (s.flags & L.META) {
      const n = Le(s.payload);
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
        const i = De(performance.now());
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
      const s = Ne(e.payload), n = performance.now() - s;
      n > 0 && n < 3e4 && this.monitor.recordProbeResponse(t, n);
    }
  }
}
export {
  ve as BondingEngine,
  me as ConnectionMonitor,
  ge as DEFAULT_CHUNK_SIZE,
  Ce as DataChannelPool,
  g as DriveSignal,
  st as FastRTC,
  L as Flags,
  K as HEADER_SIZE,
  Ze as MediaManager,
  We as Messenger,
  ze as ProxyClient,
  y as ProxyFrameType,
  Xe as ProxyServer,
  Ee as SignalManager,
  _e as Stream,
  et as StreamManager,
  Pe as decodeChunk,
  Le as decodeMetaPayload,
  Ne as decodeProbeTimestamp,
  we as decodeProxyFrame,
  ee as encodeChunk,
  Oe as encodeMetaChunk,
  De as encodeProbe,
  qe as encodeRequest,
  ce as splitIntoChunks
};
