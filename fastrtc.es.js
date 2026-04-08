class K {
  /**
   * @param {RTCPeerConnection} pc
   * @param {object} opts
   * @param {number} [opts.channelCount=4]
   * @param {boolean} [opts.ordered=false]
   * @param {string} [opts.protocol='fastrtc']
   */
  constructor(e, { channelCount: s = 4, ordered: t = !1, protocol: n = "fastrtc" } = {}) {
    this.pc = e, this.channelCount = s, this.ordered = t, this.protocol = n, this.channels = [], this.openChannels = /* @__PURE__ */ new Set(), this._rrIndex = 0, this._openArray = [], this._openArrayDirty = !0, this._onMessage = null, this._onOpen = null, this._onClose = null;
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
      const s = `fastrtc-${e}`, t = this.pc.createDataChannel(s, {
        ordered: this.ordered,
        protocol: this.protocol,
        id: e,
        negotiated: !0
        // both sides create with same id
      });
      t.binaryType = "arraybuffer", this._bindEvents(t, e), this.channels.push(t);
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
    const s = await this._pickChannel();
    return this.channels[s].send(e), s;
  }
  /**
   * Fast-path send: skip backpressure check for small payloads (<64KB).
   * Falls back to normal send if all channels are congested.
   * @param {ArrayBuffer} data
   * @returns {number} channel index used, or -1 if fell back to async
   */
  sendImmediate(e) {
    const s = this._getOpenArray();
    if (s.length === 0) return -1;
    for (let t = 0; t < s.length; t++) {
      const n = s[this._rrIndex % s.length];
      this._rrIndex = (this._rrIndex + 1) % s.length;
      const i = this.channels[n];
      if (i.bufferedAmount < 524288)
        return i.send(e), n;
    }
    return -1;
  }
  /**
   * Send on a specific channel index.
   */
  async sendOnChannel(e, s) {
    await this._waitForBuffer(e), this.channels[e].send(s);
  }
  /**
   * Check if any channel is available for sending.
   */
  hasAvailableChannel() {
    for (const e of this.openChannels)
      if (this.channels[e].bufferedAmount < 524288)
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
  _getOpenArray() {
    return this._openArrayDirty && (this._openArray = [...this.openChannels], this._openArrayDirty = !1), this._openArray;
  }
  _bindEvents(e, s) {
    e.onopen = () => {
      this.openChannels.add(s), this._openArrayDirty = !0, this._onOpen && this._onOpen(s);
    }, e.onclose = () => {
      this.openChannels.delete(s), this._openArrayDirty = !0, this._onClose && this._onClose(s);
    }, e.onmessage = (t) => {
      this._onMessage && this._onMessage(s, t.data);
    }, e.bufferedAmountLowThreshold = 131072;
  }
  async _pickChannel() {
    const e = this._getOpenArray();
    if (e.length === 0)
      return await new Promise((t) => {
        const n = this._onOpen;
        this._onOpen = (i) => {
          this._onOpen = n, n && n(i), t();
        };
      }), this._pickChannel();
    for (let t = 0; t < e.length; t++) {
      const n = e[this._rrIndex % e.length];
      if (this._rrIndex = (this._rrIndex + 1) % e.length, this.channels[n].bufferedAmount < 524288)
        return n;
    }
    const s = e[0];
    return await this._waitForBuffer(s), s;
  }
  _waitForBuffer(e) {
    return new Promise((s) => {
      const t = this.channels[e];
      if (!t || t.bufferedAmount < 524288) {
        s();
        return;
      }
      const n = () => {
        t.removeEventListener("bufferedamountlow", n), s();
      };
      t.addEventListener("bufferedamountlow", n), setTimeout(() => {
        t.removeEventListener("bufferedamountlow", n), s();
      }, 1500);
    });
  }
}
class J {
  constructor(e, s, t = null) {
    this.roomCode = e, this.isOfferer = s;
    const n = Array.from("FRTC" + e).map((i) => i.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    this.infoHash = n.padEnd(40, "0"), this.peerId = Array.from(crypto.getRandomValues(new Uint8Array(20))).map((i) => i.toString(16).padStart(2, "0")).join(""), this.urls = t && t.length > 0 ? [...t] : [
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
    ], this.sockets = [], this.remotePeerId = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this._announceInterval = null;
  }
  connect() {
    let e = !1;
    for (const s of this.urls)
      try {
        const t = new WebSocket(s);
        this.sockets.push(t), t.onopen = () => {
          e || (e = !0, this.onOpen && this.onOpen(0), this._startAnnouncing());
        }, t.onmessage = (n) => this._handleMessage(n.data, t), t.onclose = () => {
          this.sockets = this.sockets.filter((n) => n !== t), this.sockets.length === 0 && (this._stopAnnouncing(), this.onClose && this.onClose(0));
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
    const s = JSON.stringify(e), t = {
      action: "announce",
      info_hash: this.infoHash,
      peer_id: this.peerId
    };
    this.remotePeerId ? (t.to_peer_id = this.remotePeerId, t.answer = { type: "answer", sdp: s }, t.offer_id = "fastrtc-relay") : this.isOfferer && (t.numwant = 1, t.offers = [{
      offer_id: "fastrtc-relay",
      offer: { type: "offer", sdp: s }
    }]);
    const n = JSON.stringify(t);
    for (const i of this.sockets)
      i.readyState === WebSocket.OPEN && i.send(n);
  }
  _startAnnouncing() {
    if (this.isOfferer) {
      const e = () => {
        const s = JSON.stringify({
          action: "announce",
          info_hash: this.infoHash,
          peer_id: this.peerId,
          numwant: 1
        });
        for (const t of this.sockets)
          t.readyState === WebSocket.OPEN && t.send(s);
      };
      e(), this._announceInterval = setInterval(e, 2e3);
    } else {
      const e = JSON.stringify({
        action: "announce",
        info_hash: this.infoHash,
        peer_id: this.peerId,
        numwant: 1
      });
      for (const s of this.sockets)
        s.readyState === WebSocket.OPEN && s.send(e);
    }
  }
  _stopAnnouncing() {
    this._announceInterval && (clearInterval(this._announceInterval), this._announceInterval = null);
  }
  _handleMessage(e, s) {
    let t;
    try {
      t = JSON.parse(e);
    } catch {
      return;
    }
    if (t.answer && t.answer.sdp && (this._stopAnnouncing(), this.remotePeerId = t.peer_id, this.onMessage))
      try {
        const n = JSON.parse(t.answer.sdp);
        this.onMessage(n);
      } catch {
      }
    if (t.offer && t.offer.sdp) {
      if (this._stopAnnouncing(), this.remotePeerId = t.peer_id, this.onMessage)
        try {
          const n = JSON.parse(t.offer.sdp);
          this.onMessage(n);
        } catch {
        }
      s.send(JSON.stringify({
        action: "announce",
        info_hash: this.infoHash,
        peer_id: this.peerId,
        to_peer_id: this.remotePeerId,
        offer_id: t.offer_id,
        answer: { type: "answer", sdp: JSON.stringify({ type: "peer-joined" }) }
      }));
    }
    t.action === "announce" && t.peer_id && t.peer_id !== this.peerId && this.isOfferer && !this.remotePeerId && (this.remotePeerId = t.peer_id, this._stopAnnouncing(), this.onMessage && this.onMessage({ type: "peer-joined" }));
  }
}
const I = "https://oauth2.googleapis.com/token", M = "https://www.googleapis.com/auth/spreadsheets", V = "https://accounts.google.com/gsi/client";
let P = !1, b = null;
class _ {
  /**
   * @param {string} roomCode — Room / swarm identifier
   * @param {boolean} isOfferer — true if this peer creates the room
   * @param {object} driveConfig — Google Sheets configuration
   * @param {string} driveConfig.spreadsheetId — The Google Spreadsheet ID
   * @param {object} [driveConfig.raw] — Raw request mode config (zero OAuth, uses browser cookies)
   * @param {string} driveConfig.raw.token — CSRF token from the spreadsheet's save request URL (extract from DevTools)
   * @param {string} [driveConfig.raw.ouid] — Google user ID (from the save URL; optional)
   * @param {number} [driveConfig.raw.gid=0] — Sheet tab gid (0 = first sheet)
   * @param {number} [driveConfig.raw.rev=1] — Starting document revision
   * @param {string} [driveConfig.accessToken] — Direct OAuth2 token (temporary)
   * @param {string} [driveConfig.apiKey] — API key (read-only fallback)
   * @param {string} [driveConfig.clientId] — OAuth2 client ID. If provided WITHOUT clientSecret, uses browser-only popup auth (no server needed).
   * @param {string} [driveConfig.clientSecret] — OAuth2 client secret (only for refresh token flow; omit for client-only mode)
   * @param {string} [driveConfig.refreshToken] — Long-lived refresh token (requires clientId + clientSecret)
   * @param {object} [driveConfig.serviceAccount] — GCP service account credentials
   * @param {string} driveConfig.serviceAccount.client_email — Service account email
   * @param {string} driveConfig.serviceAccount.private_key — PEM private key (RS256)
   * @param {number} [driveConfig.pollInterval=1500] — How often to poll (ms)
   * @param {string} [driveConfig.sheetName] — Sheet tab name (defaults to roomCode)
   */
  constructor(e, s, t = {}) {
    if (this.roomCode = e, this.isOfferer = s, this.spreadsheetId = t.spreadsheetId, this.pollInterval = t.pollInterval || 1500, this.sheetName = t.sheetName || e, !this.spreadsheetId)
      throw new Error("DriveSignal requires a spreadsheetId");
    if (this._authMode = null, this._accessToken = null, this._tokenExpiry = 0, this._apiKey = t.apiKey || null, this._rawToken = null, this._rawOuid = "", this._rawGid = "0", this._rawSid = null, this._rawRev = 1, this._rawReqId = 0, this._myWriteRow = 1, this._lastRawValues = null, this._clientId = t.clientId || null, this._clientSecret = t.clientSecret || null, this._refreshToken = t.refreshToken || null, this._serviceAccount = t.serviceAccount || null, this._signingKey = null, this._gisTokenClient = null, this._gisResolve = null, t.raw && t.raw.token)
      this._authMode = "raw", this._rawToken = t.raw.token, this._rawOuid = t.raw.ouid || "", this._rawGid = String(t.raw.gid ?? 0), this._rawRev = t.raw.rev ?? 1, this._rawSid = Array.from(
        crypto.getRandomValues(new Uint8Array(8)),
        (n) => n.toString(16).padStart(2, "0")
      ).join("");
    else if (t.clientId && !t.clientSecret && !t.refreshToken)
      this._authMode = "client";
    else if (t.refreshToken && t.clientId && t.clientSecret)
      this._authMode = "refresh";
    else if (t.serviceAccount && t.serviceAccount.client_email && t.serviceAccount.private_key)
      this._authMode = "service";
    else if (t.accessToken)
      this._authMode = "static", this._accessToken = t.accessToken, this._tokenExpiry = Date.now() + 3300 * 1e3;
    else if (t.apiKey)
      this._authMode = "apikey";
    else
      throw new Error(
        "DriveSignal requires one of: raw ({ token }), clientId (client-only), accessToken, refreshToken (+ clientId/clientSecret), serviceAccount, or apiKey"
      );
    this.peerId = _._generatePeerId(), this.remotePeerId = null, this.onMessage = null, this.onOpen = null, this.onClose = null, this.connected = !1, this._pollTimer = null, this._myColumn = null, this._remoteColIndex = null, this._readCursor = 1, this._destroyed = !1, this._baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
  }
  // ── Public interface (matches TorrentSignal) ─────────────────────────
  async connect() {
    try {
      if (this._authMode === "raw") {
        if (await this._registerColumn(), this._lastRawValues && this._myColumn) {
          const e = _._colIndex(this._myColumn);
          let s = 0;
          for (let t = 0; t < this._lastRawValues.length; t++)
            this._lastRawValues[t] && this._lastRawValues[t][e] && (s = t + 1);
          this._myWriteRow = s;
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
    const s = JSON.stringify(e);
    this._appendToColumn(this._myColumn, s).catch((t) => {
      console.error("[DriveSignal] send error:", t);
    });
  }
  /**
   * Remove this peer's message rows from the sheet (keep header for audit).
   * Call before disconnect for a clean room.
   */
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
  // ── Internal: Initialization ─────────────────────────────────────────
  /**
   * Create the room sheet tab if it doesn't exist yet.
   */
  async _ensureSheet() {
    const e = `${this.sheetName}!A1`;
    try {
      await this._sheetsRequest(
        `/${this.spreadsheetId}/values/${encodeURIComponent(e)}`,
        "GET"
      );
    } catch (s) {
      if (s.status === 400 || s.status === 404)
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
        throw s;
    }
  }
  /**
   * Claim the next available column by writing our peerId into row 1.
   */
  async _registerColumn() {
    const e = await this._readHeaders(), s = e.indexOf(this.peerId);
    if (s >= 0) {
      this._myColumn = _._colLetter(s);
      return;
    }
    const t = e.length;
    this._myColumn = _._colLetter(t), await this._writeCell(`${this.sheetName}!${this._myColumn}1`, this.peerId);
  }
  // ── Internal: Polling loop ───────────────────────────────────────────
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
        const s = e[0];
        for (let t = 0; t < s.length; t++) {
          const n = s[t];
          if (!(!n || n === this.peerId) && (this.remotePeerId || (this.remotePeerId = n, this._remoteColIndex = t, this.onMessage && this.onMessage({ type: "peer-joined" })), n === this.remotePeerId)) {
            for (let i = this._readCursor; i < e.length; i++) {
              const r = e[i] ? e[i][t] : null;
              if (r)
                try {
                  const h = JSON.parse(r);
                  this.onMessage && this.onMessage(h);
                } catch {
                }
            }
            e.length > this._readCursor && (this._readCursor = e.length);
          }
        }
        if (this._authMode === "raw" && this._myColumn) {
          const t = _._colIndex(this._myColumn);
          let n = 0;
          for (let i = 0; i < e.length; i++)
            e[i] && e[i][t] && (n = i + 1);
          n >= this._myWriteRow && (this._myWriteRow = n);
        }
      } catch {
      }
  }
  // ── Internal: Sheets API helpers ─────────────────────────────────────
  /**
   * Unified Sheets API caller. Returns parsed JSON body.
   * Auto-refreshes the access token before each request if needed.
   * Throws an object with `.status` on HTTP errors.
   */
  async _sheetsRequest(e, s, t) {
    await this._ensureToken();
    const n = e.includes("?") ? "&" : "?", i = !this._accessToken && this._apiKey ? `${n}key=${encodeURIComponent(this._apiKey)}` : "", r = `${this._baseUrl}${e}${i}`, h = { "Content-Type": "application/json" };
    this._accessToken && (h.Authorization = `Bearer ${this._accessToken}`);
    const o = { method: s, headers: h };
    t && (o.body = JSON.stringify(t));
    let c = await fetch(r, o);
    if (c.status === 401 && this._authMode !== "static" && this._authMode !== "apikey" && (this._tokenExpiry = 0, await this._ensureToken(), this._accessToken && (o.headers.Authorization = `Bearer ${this._accessToken}`), c = await fetch(r, o)), !c.ok) {
      const u = new Error(`Sheets API ${s} ${e} → ${c.status}`);
      throw u.status = c.status, u;
    }
    const l = await c.text();
    return l ? JSON.parse(l) : {};
  }
  // ── Internal: Token management ───────────────────────────────────────
  /**
   * Ensure we have a valid (non-expired) access token.
   * Mints or refreshes automatically based on auth mode.
   */
  async _ensureToken() {
    this._authMode !== "apikey" && (this._accessToken && Date.now() < this._tokenExpiry - 5e3 || (this._authMode === "refresh" ? await this._refreshAccessToken() : this._authMode === "service" ? await this._mintServiceAccountToken() : this._authMode === "client" && await this._requestClientToken()));
  }
  /**
   * Exchange a refresh token for a new access token.
   */
  async _refreshAccessToken() {
    const e = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this._clientId,
      client_secret: this._clientSecret,
      refresh_token: this._refreshToken
    }), s = await fetch(I, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: e.toString()
    });
    if (!s.ok)
      throw new Error(`[DriveSignal] refresh token exchange failed: ${s.status}`);
    const t = await s.json();
    this._accessToken = t.access_token, this._tokenExpiry = Date.now() + (t.expires_in ? t.expires_in * 1e3 - 3e5 : 3300 * 1e3);
  }
  /**
   * Mint an access token from a GCP service account key using JWT + RS256.
   * Works entirely in the browser via Web Crypto API — no server needed.
   */
  async _mintServiceAccountToken() {
    const e = Math.floor(Date.now() / 1e3), s = {
      iss: this._serviceAccount.client_email,
      scope: M,
      aud: I,
      iat: e,
      exp: e + 3600
    }, t = await _._signJwt(s, this._serviceAccount.private_key, this), n = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: t
    }), i = await fetch(I, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: n.toString()
    });
    if (!i.ok)
      throw new Error(`[DriveSignal] service account token mint failed: ${i.status}`);
    const r = await i.json();
    this._accessToken = r.access_token, this._tokenExpiry = Date.now() + (r.expires_in ? r.expires_in * 1e3 - 3e5 : 3300 * 1e3);
  }
  /**
   * Client-only browser OAuth via Google Identity Services.
   * Loads the GIS script once, then uses a TokenClient to get tokens.
   * First call triggers user consent popup; subsequent calls refresh silently.
   */
  async _requestClientToken() {
    return await _._loadGisScript(), this._gisTokenClient || (this._gisTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this._clientId,
      scope: M,
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
  /**
   * Load the Google Identity Services script (once, shared across instances).
   */
  static _loadGisScript() {
    return P && typeof google < "u" && google.accounts ? Promise.resolve() : b || (b = new Promise((e, s) => {
      const t = document.createElement("script");
      t.src = V, t.async = !0, t.onload = () => {
        P = !0, e();
      }, t.onerror = () => s(new Error("[DriveSignal] Failed to load Google Identity Services script")), document.head.appendChild(t);
    }), b);
  }
  async _readHeaders() {
    if (this._authMode === "raw")
      return this._lastRawValues = await this._rawReadSheet(), this._lastRawValues.length > 0 ? this._lastRawValues[0] : [];
    const e = `${this.sheetName}!1:1`;
    try {
      const s = await this._sheetsRequest(
        `/${this.spreadsheetId}/values/${encodeURIComponent(e)}`,
        "GET"
      );
      return s.values ? s.values[0] : [];
    } catch {
      return [];
    }
  }
  async _writeCell(e, s) {
    if (this._authMode === "raw") {
      const { row: t, col: n } = _._parseRange(e);
      return this._rawWriteCell(t, n, s);
    }
    await this._sheetsRequest(
      `/${this.spreadsheetId}/values/${encodeURIComponent(e)}?valueInputOption=RAW`,
      "PUT",
      { values: [[s]] }
    );
  }
  async _appendToColumn(e, s) {
    if (this._authMode === "raw") {
      const i = _._colIndex(e), r = this._myWriteRow;
      return this._myWriteRow++, this._rawWriteCell(r, i, s);
    }
    const t = this._myWriteRow;
    this._myWriteRow++;
    const n = `${this.sheetName}!${e}${t}`;
    await this._sheetsRequest(
      `/${this.spreadsheetId}/values/${encodeURIComponent(n)}?valueInputOption=RAW`,
      "PUT",
      { values: [[s]] }
    );
  }
  // ── Internal: Raw request mode (zero-auth) ────────────────────────────
  /**
   * Write a cell value via the internal Google Sheets save endpoint.
   * Uses `credentials: 'include'` to piggyback the user's Google session cookies.
   * Sends as `multipart/form-data` with `mode: 'no-cors'` (fire-and-forget).
   * @param {number} row — 0-based row index
   * @param {number} col — 0-based column index
   * @param {string} value — cell value to write
   */
  async _rawWriteCell(e, s, t) {
    this._rawReqId++;
    const n = Math.floor(Math.random() * 2147483647), i = Math.floor(Math.random() * 2147483647), r = JSON.stringify([
      [this._rawGid, e, s, e, s],
      [n, 3, [2, t], null, null, 0],
      [null, [[null, 513, [0], null, null, null, null, null, null, null, null, 0]]]
    ]), h = JSON.stringify([{
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
    }), c = `https://docs.google.com/spreadsheets/u/0/d/${this.spreadsheetId}/save?${o}`, l = new FormData();
    l.append("rev", String(this._rawRev)), l.append("bundles", h);
    try {
      await fetch(c, {
        method: "POST",
        body: l,
        credentials: "include",
        mode: "no-cors"
      });
    } catch {
    }
    this._rawRev++;
  }
  /**
   * Read entire sheet via the public Google Visualization JSONP endpoint.
   * Sheet must be shared as "Anyone with the link can view" (or edit).
   * Returns a 2D array of cell values (same shape as Sheets API v4 `values`).
   */
  async _rawReadSheet() {
    return new Promise((e) => {
      const s = `_ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, t = setTimeout(() => {
        delete window[s], e([]);
      }, 8e3);
      window[s] = (i) => {
        clearTimeout(t), delete window[s], e(_._parseGvizTable(i));
      };
      const n = document.createElement("script");
      n.src = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=responseHandler:${s}&gid=${this._rawGid}&headers=0&tq=${encodeURIComponent("SELECT *")}`, n.onerror = () => {
        clearTimeout(t), delete window[s], e([]);
      }, document.head.appendChild(n), n.addEventListener("load", () => n.remove());
    });
  }
  /**
   * Parse a Google Visualization Query response into a 2D array.
   */
  static _parseGvizTable(e) {
    return !e || e.status !== "ok" || !e.table ? [] : (e.table.rows || []).map((t) => (t.c || []).map((i) => i && i.v != null ? String(i.v) : ""));
  }
  /**
   * Convert a column letter to a 0-based index. A→0, B→1, Z→25, AA→26.
   */
  static _colIndex(e) {
    let s = 0;
    for (let t = 0; t < e.length; t++)
      s = s * 26 + (e.charCodeAt(t) - 64);
    return s - 1;
  }
  /**
   * Parse a Sheets A1 range string like "SheetName!B3" into {row, col} (0-based).
   */
  static _parseRange(e) {
    const t = (e.includes("!") ? e.split("!")[1] : e).match(/^([A-Z]+)(\d+)$/);
    return t ? {
      col: _._colIndex(t[1]),
      row: parseInt(t[2], 10) - 1
    } : { row: 0, col: 0 };
  }
  // ── Static helpers ───────────────────────────────────────────────────
  /**
   * Generate a 9-character alphanumeric peer ID (e.g. "439ARWI38").
   */
  static _generatePeerId() {
    const e = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", s = crypto.getRandomValues(new Uint8Array(9));
    return Array.from(s, (t) => e[t % e.length]).join("");
  }
  /**
   * Convert a 0-based column index to a spreadsheet letter (0→A, 25→Z, 26→AA …).
   */
  static _colLetter(e) {
    let s = "", t = e;
    for (; t >= 0; )
      s = String.fromCharCode(65 + t % 26) + s, t = Math.floor(t / 26) - 1;
    return s;
  }
  /**
   * Sign a JWT claim set with an RS256 PEM private key using Web Crypto API.
   * Returns the compact JWT string (header.payload.signature).
   * @param {object} claim — JWT payload (iss, scope, aud, iat, exp)
   * @param {string} pemKey — PEM-encoded RSA private key
   * @param {DriveSignal} instance — instance to cache the CryptoKey on
   */
  static async _signJwt(e, s, t) {
    t._signingKey || (t._signingKey = await _._importPem(s));
    const n = { alg: "RS256", typ: "JWT" }, i = [
      _._b64url(JSON.stringify(n)),
      _._b64url(JSON.stringify(e))
    ], r = new TextEncoder().encode(i.join(".")), h = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      t._signingKey,
      r
    );
    return i.push(_._b64urlBuf(h)), i.join(".");
  }
  /**
   * Import a PEM RSA private key into a Web Crypto CryptoKey.
   */
  static async _importPem(e) {
    const s = e.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "").replace(/-----END (?:RSA )?PRIVATE KEY-----/, "").replace(/\s/g, ""), t = atob(s), n = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i++) n[i] = t.charCodeAt(i);
    return crypto.subtle.importKey(
      "pkcs8",
      n.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      !1,
      ["sign"]
    );
  }
  /** Base64url-encode a string. */
  static _b64url(e) {
    return btoa(e).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  /** Base64url-encode an ArrayBuffer. */
  static _b64urlBuf(e) {
    const s = new Uint8Array(e);
    let t = "";
    for (let n = 0; n < s.length; n++) t += String.fromCharCode(s[n]);
    return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
}
class $ {
  /**
   * @param {object} opts
   * @param {number} [opts.probeIntervalMs=2000] — how often to probe
   * @param {number} [opts.emaAlpha=0.3] — smoothing factor for EMA (higher = more responsive)
   */
  constructor({ probeIntervalMs: e = 2e3, emaAlpha: s = 0.3 } = {}) {
    this.probeIntervalMs = e, this.emaAlpha = s, this.links = /* @__PURE__ */ new Map(), this._probeTimer = null, this._onQualityUpdate = null;
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
    const s = this.links.get(e);
    s && (s.probesSent++, s.lastProbeTime = performance.now());
  }
  /**
   * Record a probe response (the RTT).
   */
  recordProbeResponse(e, s) {
    const t = this.links.get(e);
    t && (t.probesReceived++, t.latency = this._ema(t.latency, s), this._recalcScore(t));
  }
  /**
   * Record bytes sent on a link (for throughput calculation).
   */
  recordBytesSent(e, s) {
    const t = this.links.get(e);
    t && (t.bytesSent += s, t.bytesInWindow += s);
  }
  /**
   * Calculate throughput for all links (call periodically).
   */
  updateThroughput() {
    const e = performance.now();
    for (const s of this.links.values()) {
      const t = (e - s.windowStart) / 1e3;
      if (t > 0.1) {
        const n = s.bytesInWindow / t;
        s.throughput = this._ema(s.throughput, n), s.bytesInWindow = 0, s.windowStart = e, this._recalcScore(s);
      }
    }
  }
  /**
   * Calculate packet loss for all links.
   */
  updatePacketLoss() {
    for (const e of this.links.values())
      if (e.probesSent > 0) {
        const s = 1 - e.probesReceived / e.probesSent;
        e.packetLoss = this._ema(e.packetLoss, Math.max(0, s)), this._recalcScore(e);
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
    return [...this.links.values()].sort((e, s) => s.score - e.score).map((e) => e.id);
  }
  /**
   * Get the weight (0..1) for a link, normalized across all links.
   * Higher score → higher weight.
   * @returns {Map<string, number>}
   */
  getWeights() {
    const e = /* @__PURE__ */ new Map();
    let s = 0;
    for (const t of this.links.values())
      s += t.score;
    if (s === 0) {
      const t = 1 / Math.max(1, this.links.size);
      for (const n of this.links.values())
        e.set(n.id, t);
    } else
      for (const t of this.links.values())
        e.set(t.id, t.score / s);
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
  _ema(e, s) {
    return e === 0 ? s : this.emaAlpha * s + (1 - this.emaAlpha) * e;
  }
  _recalcScore(e) {
    const s = 1 / (1 + e.latency / 100), t = 1 - e.packetLoss, n = Math.min(1, Math.log10(1 + e.throughput / 1e4) / 4);
    e.score = Math.max(0.01, s * 0.4 + t * 0.35 + n * 0.25);
  }
}
class z {
  /**
   * @param {object} opts
   * @param {function[]} opts.senders — array of async send functions: (data: ArrayBuffer) => Promise<void>
   * @param {string[]} opts.linkIds — matching array of link IDs for the monitor
   * @param {ConnectionMonitor} [opts.monitor] — optional external monitor
   */
  constructor({ senders: e = [], linkIds: s = [], monitor: t = null } = {}) {
    this.senders = e, this.linkIds = s, this.monitor = t || new $();
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
  updatePaths(e, s) {
    this.senders = e, this.linkIds = s;
    for (const t of s)
      this.monitor.links.has(t) || this.monitor.addLink(t);
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
    const s = this._buildSendPlan(e.length), t = [];
    for (let n = 0; n < e.length; n++) {
      const i = s[n], r = e[n], h = this.linkIds[i];
      t.push(
        this.senders[i](r).then(() => {
          this.monitor.recordBytesSent(h, r.byteLength);
        })
      );
    }
    await Promise.all(t);
  }
  /**
   * Send a single chunk on the best available path.
   * Optimized: caches best sender index and only refreshes weights periodically.
   */
  async sendSingle(e) {
    if (this.senders.length === 1) {
      await this.senders[0](e), this.monitor.recordBytesSent(this.linkIds[0], e.byteLength);
      return;
    }
    this._rrSingleIdx || (this._rrSingleIdx = 0), this._rrSingleIdx = (this._rrSingleIdx + 1) % this.senders.length;
    const s = this._rrSingleIdx;
    await this.senders[s](e), this.monitor.recordBytesSent(this.linkIds[s], e.byteLength);
  }
  // ── Receiving / Reassembly ──
  /**
   * Feed a received chunk into the reassembly buffer.
   * @param {object} decoded — decoded chunk from ChunkProtocol.decodeChunk()
   */
  receiveChunk(e) {
    const { transferId: s, chunkIndex: t, totalChunks: n, payload: i } = e;
    this._onChunkReceived && this._onChunkReceived(e), this._reassembly.has(s) || this._reassembly.set(s, {
      totalChunks: n,
      received: /* @__PURE__ */ new Map()
    });
    const r = this._reassembly.get(s);
    if (r.received.set(t, i), this._onProgress && this._onProgress({
      transferId: s,
      received: r.received.size,
      total: r.totalChunks,
      percent: r.received.size / r.totalChunks * 100
    }), r.received.size === r.totalChunks) {
      const h = this._assemble(r);
      this._reassembly.delete(s), this._onComplete && this._onComplete({ transferId: s, data: h });
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
    const s = new Array(e), t = this._wrr.weights, n = /* @__PURE__ */ new Map();
    let i = 0;
    for (let o = 0; o < this.linkIds.length; o++) {
      const c = this.linkIds[o], l = t.get(c) || 1 / this.linkIds.length, u = Math.round(l * e);
      n.set(o, u), i += u;
    }
    if (i < e) {
      const o = this._pickBestSender();
      n.set(o, (n.get(o) || 0) + (e - i));
    } else if (i > e)
      for (let o = this.linkIds.length - 1; o >= 0 && i > e; o--) {
        const c = n.get(o) || 0, l = Math.min(c, i - e);
        n.set(o, c - l), i -= l;
      }
    let r = 0;
    const h = new Map(n);
    for (; r < e; )
      for (let o = 0; o < this.linkIds.length && r < e; o++) {
        const c = h.get(o) || 0;
        c > 0 && (s[r++] = o, h.set(o, c - 1));
      }
    return s;
  }
  _pickBestSender() {
    const e = this.monitor.getRankedLinks();
    for (const s of e) {
      const t = this.linkIds.indexOf(s);
      if (t >= 0) return t;
    }
    return 0;
  }
  /**
   * Assemble all received chunks into a single ArrayBuffer.
   */
  _assemble(e) {
    let s = 0;
    for (let i = 0; i < e.totalChunks; i++) {
      const r = e.received.get(i);
      r && (s += r.byteLength);
    }
    const t = new Uint8Array(s);
    let n = 0;
    for (let i = 0; i < e.totalChunks; i++) {
      const r = e.received.get(i);
      r && (t.set(r, n), n += r.byteLength);
    }
    return t.buffer;
  }
}
const C = 13, H = 64 * 1024, w = {
  DATA: 1,
  ACK: 2,
  FIN: 4,
  PROBE: 8,
  META: 16
};
function E({ transferId: a, chunkIndex: e, totalChunks: s, flags: t, payload: n }) {
  const i = n ? n instanceof Uint8Array ? n : new Uint8Array(n) : new Uint8Array(0), r = new ArrayBuffer(C + i.byteLength), h = new DataView(r);
  return h.setUint32(0, a, !0), h.setUint32(4, e, !0), h.setUint32(8, s, !0), h.setUint8(12, t), i.byteLength > 0 && new Uint8Array(r, C).set(i), r;
}
function Y(a) {
  const e = new DataView(a);
  return {
    transferId: e.getUint32(0, !0),
    chunkIndex: e.getUint32(4, !0),
    totalChunks: e.getUint32(8, !0),
    flags: e.getUint8(12),
    payload: a.byteLength > C ? new Uint8Array(a, C) : null
  };
}
function U(a, e, s = H) {
  const t = new Uint8Array(a), n = Math.ceil(t.byteLength / s), i = [];
  for (let r = 0; r < n; r++) {
    const h = r * s, o = Math.min(h + s, t.byteLength), c = t.slice(h, o);
    i.push(
      E({
        transferId: e,
        chunkIndex: r,
        totalChunks: n,
        flags: w.DATA,
        payload: c
      })
    );
  }
  return i;
}
function Q(a, e) {
  const s = JSON.stringify(e), n = new TextEncoder().encode(s);
  return E({
    transferId: a,
    chunkIndex: 0,
    totalChunks: 0,
    flags: w.META,
    payload: n
  });
}
function X(a) {
  const e = new TextDecoder();
  return JSON.parse(e.decode(a));
}
function Z(a) {
  const e = new Uint8Array(8);
  return new DataView(e.buffer).setFloat64(0, a, !0), E({
    transferId: 0,
    chunkIndex: 0,
    totalChunks: 0,
    flags: w.PROBE,
    payload: e
  });
}
function ee(a) {
  return new DataView(a.buffer, a.byteOffset, a.byteLength).getFloat64(0, !0);
}
const O = 1, v = 2, te = new TextEncoder(), se = new TextDecoder();
class ne {
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
  on(e, s) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(s);
  }
  off(e, s) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((t) => t !== s));
  }
  _emit(e, ...s) {
    if (this._listeners[e])
      for (const t of this._listeners[e])
        try {
          t(...s);
        } catch (n) {
          console.error("Messenger error:", n);
        }
  }
  /**
   * Send a text message.
   * @param {string} text
   */
  async send(e) {
    const s = te.encode(e), t = new ArrayBuffer(1 + s.length);
    new Uint8Array(t)[0] = O, new Uint8Array(t, 1).set(s), await this._send(t);
  }
  /**
   * Send binary data.
   * @param {ArrayBuffer|Uint8Array} data
   */
  async sendBinary(e) {
    const s = new Uint8Array(e), t = new ArrayBuffer(1 + s.length);
    new Uint8Array(t)[0] = v, new Uint8Array(t, 1).set(s), await this._send(t);
  }
  /**
   * Handle incoming message frame (called by FastRTC internals).
   * @param {ArrayBuffer} buffer
   */
  handleIncoming(e) {
    const s = new Uint8Array(e), t = s[0];
    if (t === O) {
      const n = se.decode(s.slice(1));
      this._emit("text", n);
    } else t === v && this._emit("binary", e.slice(1));
  }
}
const f = {
  REQUEST: 1,
  RESPONSE: 2,
  BODY: 3,
  END: 4,
  ERROR: 5
}, k = new TextEncoder(), y = new TextDecoder();
function ie(a, e, s, t = {}, n = null) {
  const i = k.encode(e), r = k.encode(s), h = k.encode(JSON.stringify(t)), o = n ? new Uint8Array(n) : new Uint8Array(0), c = 6 + i.length + 2 + r.length + 4 + h.length + o.length, l = new ArrayBuffer(c), u = new DataView(l), p = new Uint8Array(l);
  let d = 0;
  return u.setUint8(d, f.REQUEST), d += 1, u.setUint32(d, a, !0), d += 4, u.setUint8(d, i.length), d += 1, p.set(i, d), d += i.length, u.setUint16(d, r.length, !0), d += 2, p.set(r, d), d += r.length, u.setUint32(d, h.length, !0), d += 4, p.set(h, d), d += h.length, o.length > 0 && p.set(o, d), l;
}
function re(a, e, s = {}) {
  const t = k.encode(JSON.stringify(s)), n = 11 + t.length, i = new ArrayBuffer(n), r = new DataView(i), h = new Uint8Array(i);
  let o = 0;
  return r.setUint8(o, f.RESPONSE), o += 1, r.setUint32(o, a, !0), o += 4, r.setUint16(o, e, !0), o += 2, r.setUint32(o, t.length, !0), o += 4, h.set(t, o), i;
}
function oe(a, e) {
  const s = new Uint8Array(e), t = new ArrayBuffer(5 + s.length), n = new DataView(t);
  return new Uint8Array(t).set(s, 5), n.setUint8(0, f.BODY), n.setUint32(1, a, !0), t;
}
function ae(a) {
  const e = new ArrayBuffer(5), s = new DataView(e);
  return s.setUint8(0, f.END), s.setUint32(1, a, !0), e;
}
function R(a, e) {
  const s = k.encode(e), t = new ArrayBuffer(5 + s.length), n = new DataView(t);
  return new Uint8Array(t).set(s, 5), n.setUint8(0, f.ERROR), n.setUint32(1, a, !0), t;
}
function W(a) {
  const e = new DataView(a), s = new Uint8Array(a), t = e.getUint8(0), n = e.getUint32(1, !0);
  switch (t) {
    case f.REQUEST: {
      let i = 5;
      const r = e.getUint8(i);
      i += 1;
      const h = y.decode(s.slice(i, i + r));
      i += r;
      const o = e.getUint16(i, !0);
      i += 2;
      const c = y.decode(s.slice(i, i + o));
      i += o;
      const l = e.getUint32(i, !0);
      i += 4;
      const u = JSON.parse(y.decode(s.slice(i, i + l)));
      i += l;
      const p = i < a.byteLength ? a.slice(i) : null;
      return { type: t, requestId: n, method: h, url: c, headers: u, body: p };
    }
    case f.RESPONSE: {
      let i = 5;
      const r = e.getUint16(i, !0);
      i += 2;
      const h = e.getUint32(i, !0);
      i += 4;
      const o = JSON.parse(y.decode(s.slice(i, i + h)));
      return { type: t, requestId: n, status: r, headers: o };
    }
    case f.BODY:
      return { type: t, requestId: n, data: a.slice(5) };
    case f.END:
      return { type: t, requestId: n };
    case f.ERROR:
      return { type: t, requestId: n, message: y.decode(s.slice(5)) };
    default:
      return { type: t, requestId: n };
  }
}
let he = 1;
class ce {
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
  async fetch(e, s = {}) {
    const t = he++, n = (s.method || "GET").toUpperCase(), i = s.headers || {};
    let r = null;
    s.body && (typeof s.body == "string" ? r = new TextEncoder().encode(s.body).buffer : s.body instanceof ArrayBuffer ? r = s.body : s.body instanceof Uint8Array && (r = s.body.buffer));
    const h = ie(t, n, e, i, r);
    return new Promise((o, c) => {
      const l = setTimeout(() => {
        this._pending.delete(t), c(new Error(`Proxy request timed out: ${n} ${e}`));
      }, 15e3);
      this._pending.set(t, {
        resolve: o,
        reject: c,
        timeout: l,
        status: 0,
        headers: {},
        bodyChunks: [],
        totalBodySize: 0
      }), this._send(h).catch(c);
    });
  }
  /**
   * Handle incoming proxy frame (called by FastRTC internals).
   * @param {ArrayBuffer} buffer
   */
  handleIncoming(e) {
    const s = W(e), t = this._pending.get(s.requestId);
    if (t)
      switch (s.type) {
        case f.RESPONSE:
          t.status = s.status, t.headers = s.headers;
          break;
        case f.BODY:
          t.bodyChunks.push(new Uint8Array(s.data)), t.totalBodySize += s.data.byteLength;
          break;
        case f.END: {
          clearTimeout(t.timeout), this._pending.delete(s.requestId);
          const n = new Uint8Array(t.totalBodySize);
          let i = 0;
          for (const r of t.bodyChunks)
            n.set(r, i), i += r.length;
          t.resolve(new le(t.status, t.headers, n.buffer));
          break;
        }
        case f.ERROR:
          clearTimeout(t.timeout), this._pending.delete(s.requestId), t.reject(new Error(s.message || "Proxy error"));
          break;
      }
  }
}
class le {
  constructor(e, s, t) {
    this.status = e, this.ok = e >= 200 && e < 300, this.headers = s, this._body = t;
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
const L = 128 * 1024;
class de {
  /**
   * @param {function} sendFn — async (data: ArrayBuffer) => void
   * @param {object} [opts]
   * @param {string[]} [opts.allowList] — glob patterns for allowed domains (empty = allow all)
   * @param {string[]} [opts.blockList] — glob patterns for blocked domains
   */
  constructor(e, s = {}) {
    this._send = e, this._allowList = s.allowList || [], this._blockList = s.blockList || [], this._active = !1;
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
    const s = W(e);
    if (s.type !== f.REQUEST) return;
    if (!this._active) {
      await this._send(R(s.requestId, "Proxy server not active"));
      return;
    }
    const { requestId: t, method: n, url: i, headers: r, body: h } = s;
    if (!this._isDomainAllowed(i)) {
      await this._send(R(t, "Domain not allowed"));
      return;
    }
    try {
      const o = { method: n, headers: r };
      h && n !== "GET" && n !== "HEAD" && (o.body = h);
      const c = await fetch(i, o), l = {};
      if (c.headers.forEach((u, p) => {
        l[p] = u;
      }), await this._send(re(t, c.status, l)), c.body) {
        const u = c.body.getReader();
        let p = [];
        for (; ; ) {
          const { done: d, value: q } = await u.read();
          if (d) break;
          const x = q;
          for (let S = 0; S < x.length; S += L) {
            const G = x.slice(S, S + L);
            p.push(this._send(oe(t, G))), p.length >= 4 && (await Promise.all(p), p = []);
          }
        }
        p.length > 0 && await Promise.all(p);
      }
      await this._send(ae(t));
    } catch (o) {
      await this._send(R(t, o.message || "Proxy fetch failed"));
    }
  }
  _isDomainAllowed(e) {
    try {
      const s = new URL(e).hostname;
      if (this._blockList.length > 0) {
        for (const t of this._blockList)
          if (this._matchGlob(s, t)) return !1;
      }
      if (this._allowList.length === 0) return !0;
      for (const t of this._allowList)
        if (this._matchGlob(s, t)) return !0;
      return !1;
    } catch {
      return !1;
    }
  }
  _matchGlob(e, s) {
    return new RegExp(
      "^" + s.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
      "i"
    ).test(e);
  }
}
class ue {
  /**
   * @param {RTCPeerConnection} pc
   * @param {function} renegotiateFn — async () => void — triggers SDP renegotiation
   */
  constructor(e, s) {
    this.pc = e, this._renegotiate = s, this.localStream = null, this.remoteStream = null, this._senders = [], this._listeners = {}, this.pc.ontrack = (t) => {
      this.remoteStream || (this.remoteStream = new MediaStream()), this.remoteStream.addTrack(t.track), this._emit("remoteStream", this.remoteStream), this._emit("track", t.track, t.streams);
    };
  }
  // ── Events ──
  on(e, s) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(s);
  }
  off(e, s) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((t) => t !== s));
  }
  _emit(e, ...s) {
    if (this._listeners[e])
      for (const t of this._listeners[e])
        try {
          t(...s);
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
    var s;
    return this.localStream = await navigator.mediaDevices.getDisplayMedia(e), this._addTracks(this.localStream), this._emit("localStream", this.localStream), (s = this.localStream.getVideoTracks()[0]) == null || s.addEventListener("ended", () => {
      this.stop(), this._emit("screenShareEnded");
    }), this.localStream;
  }
  // ── Replace Track (e.g. switch camera) ──
  /**
   * Replace a track type (video/audio) without renegotiation.
   * @param {MediaStreamTrack} newTrack
   */
  async replaceTrack(e) {
    const s = this._senders.find((t) => {
      var n;
      return ((n = t.track) == null ? void 0 : n.kind) === e.kind;
    });
    s && await s.replaceTrack(e);
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
    for (const s of e.getTracks()) {
      const t = this.pc.addTrack(s, e);
      this._senders.push(t);
    }
    this._renegotiate();
  }
}
const B = 1, F = 2, j = 3, T = new TextEncoder(), A = new TextDecoder();
class _e {
  /**
   * @param {function} sendFn — async (data: ArrayBuffer) => void
   */
  constructor(e) {
    this._send = e, this._streams = /* @__PURE__ */ new Map(), this._listeners = {};
  }
  // ── Events ──
  on(e, s) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(s);
  }
  off(e, s) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((t) => t !== s));
  }
  _emit(e, ...s) {
    if (this._listeners[e])
      for (const t of this._listeners[e])
        try {
          t(...s);
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
    const s = new D(e, this._send);
    this._streams.set(e, s);
    const t = T.encode(e), n = new ArrayBuffer(2 + t.length), i = new Uint8Array(n);
    return i[0] = B, i[1] = t.length, i.set(t, 2), this._send(n), s;
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
    const s = new Uint8Array(e), t = s[0];
    if (t === B) {
      const n = s[1], i = A.decode(s.slice(2, 2 + n)), r = new D(i, this._send);
      this._streams.set(i, r), this._emit("incoming", r);
      return;
    }
    if (t === F) {
      const n = s[1], i = A.decode(s.slice(2, 2 + n)), r = e.slice(2 + n), h = this._streams.get(i);
      h && h._handleData(r);
      return;
    }
    if (t === j) {
      const n = s[1], i = A.decode(s.slice(2, 2 + n)), r = this._streams.get(i);
      r && (r._handleClose(), this._streams.delete(i));
    }
  }
}
class D {
  constructor(e, s) {
    this.name = e, this._send = s, this._listeners = {}, this._closed = !1;
  }
  on(e, s) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(s);
  }
  off(e, s) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((t) => t !== s));
  }
  _emit(e, ...s) {
    if (this._listeners[e])
      for (const t of this._listeners[e])
        try {
          t(...s);
        } catch {
        }
  }
  /**
   * Write data to the stream.
   * @param {ArrayBuffer|Uint8Array} data
   */
  async write(e) {
    if (this._closed) throw new Error("Stream closed");
    const s = new Uint8Array(e), t = T.encode(this.name), n = new ArrayBuffer(2 + t.length + s.length), i = new Uint8Array(n);
    i[0] = F, i[1] = t.length, i.set(t, 2), i.set(s, 2 + t.length), await this._send(n);
  }
  /**
   * Close the stream.
   */
  async close() {
    if (this._closed) return;
    this._closed = !0;
    const e = T.encode(this.name), s = new ArrayBuffer(2 + e.length), t = new Uint8Array(s);
    t[0] = j, t[1] = e.length, t.set(e, 2), await this._send(s), this._emit("close");
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
const m = {
  CHUNK: 240,
  // File transfer / bonding chunks (ChunkProtocol)
  MESSAGE: 241,
  // Messenger
  PROXY: 242,
  // Proxy (client + server)
  STREAM: 243
  // StreamChannel
}, fe = [
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
let N = 1;
function g(a, e) {
  const s = new Uint8Array(e), t = new ArrayBuffer(1 + s.length), n = new Uint8Array(t);
  return n[0] = a, n.set(s, 1), t;
}
class pe {
  /**
   * @param {object} opts
   * @param {RTCIceServer[]} [opts.iceServers] — override STUN/TURN servers
   * @param {number} [opts.dataChannels=32] — number of parallel P2P data channels
   * @param {number} [opts.chunkSize=65536] — chunk size in bytes
   * @param {object} [opts.proxy] — proxy server options (allowList, blockList)
   * @param {boolean} [opts.isHost=false] — advertise this peer as a proxy/service host
   * @param {boolean} [opts.requireRoomCode=false] — use private 6-digit secure room codes instead of the public network
   * @param {string[]} [opts.trackerUrls] — custom WebTorrent tracker URLs (overrides built-in public trackers)
   * @param {object} [opts.driveSignal] — use Google Sheets signaling instead of WebTorrent trackers (alpha)
   * @param {string} opts.driveSignal.spreadsheetId — Google Spreadsheet ID
   * @param {string} opts.driveSignal.accessToken — OAuth2 access token
   * @param {string} [opts.driveSignal.apiKey] — API key (read-only fallback)
   * @param {number} [opts.driveSignal.pollInterval=1500] — polling interval in ms
   * @param {boolean} [opts.serverMode=false] — optimize for dedicated client-to-server proxy connections (reduces probing, uses ordered channels, tighter buffers)
   */
  constructor({
    iceServers: e = fe,
    dataChannels: s = 32,
    chunkSize: t = H,
    proxy: n = {},
    isHost: i = !1,
    requireRoomCode: r = !1,
    trackerUrls: h = null,
    driveSignal: o = null,
    serverMode: c = !1
  } = {}) {
    this.iceServers = e, this.dataChannelCount = s, this.chunkSize = t, this.isHost = i, this.requireRoomCode = r, this.trackerUrls = h, this.driveSignalConfig = o, this.serverMode = c, this.remoteIsHost = !1, this.pc = null, this.signaling = null, this.pool = null, this.bonding = null, this.monitor = new $(), this.roomCode = null, this.isOfferer = !1, this._listeners = {}, this._pendingMeta = /* @__PURE__ */ new Map(), this._probeTimers = /* @__PURE__ */ new Map(), this._negotiationState = "idle", this._pcCreated = !1, this._proxyOpts = n, this.message = null, this._proxyClient = null, this._proxyServer = null, this.proxy = null, this.media = null, this.stream = null;
  }
  // ── Event system ──
  getVersion() {
    return "0.0.2";
  }
  on(e, s) {
    this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(s);
  }
  off(e, s) {
    this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((t) => t !== s));
  }
  _emit(e, ...s) {
    if (this._listeners[e])
      for (const t of this._listeners[e])
        try {
          t(...s);
        } catch (n) {
          console.error("FastRTC event error:", n);
        }
  }
  // ── Room management ──
  async createRoom(e = null) {
    return this.isOfferer = !0, e ? this.roomCode = e : this.requireRoomCode ? this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase() : this.roomCode = "FASTRTC-PUBLIC-SWARM", new Promise((s, t) => {
      this.signaling = this._createSignaling(!0), this.signaling.onOpen = () => {
        this._emit("wss-open", 0), this._emit("room-created", this.roomCode), s(this.roomCode);
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
    return new Promise((s, t) => {
      this._joinResolver = s, this.signaling = this._createSignaling(!1), this.signaling.onOpen = () => {
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
    const s = N++, n = U(e, s, this.chunkSize).map((i) => g(m.CHUNK, i));
    await this.bonding.sendChunks(n);
  }
  async sendFile(e) {
    if (!this.bonding) throw new Error("Not connected");
    const s = N++, t = await e.arrayBuffer(), n = { name: e.name, size: e.size, type: e.type }, i = g(m.CHUNK, Q(s, n));
    for (const o of this.bonding.senders)
      try {
        await o(i);
      } catch {
      }
    await new Promise((o) => setTimeout(o, 50));
    const r = U(t, s, this.chunkSize), h = r.map((o) => g(m.CHUNK, o));
    this._emit("send-start", { transferId: s, name: e.name, totalChunks: r.length }), await this.bonding.sendChunks(h), this._emit("send-complete", { transferId: s, name: e.name });
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
  // ── Internal: Signaling factory ──
  /**
   * Create the appropriate signaling transport.
   * Uses DriveSignal when driveSignalConfig is set, otherwise TorrentSignal.
   */
  _createSignaling(e) {
    return this.driveSignalConfig ? new _(this.roomCode, e, this.driveSignalConfig) : new J(this.roomCode, e, this.trackerUrls);
  }
  /**
   * Check if the signaling transport is ready to send messages.
   * Works for both TorrentSignal (WebSocket-based) and DriveSignal (HTTP-based).
   */
  _isSignalingReady() {
    return this.signaling ? this.signaling.connected !== void 0 ? this.signaling.connected : this.signaling.sockets ? this.signaling.sockets.some((e) => e.readyState === WebSocket.OPEN) : !1 : !1;
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
      e.candidate && this._isSignalingReady() && this.signaling.send({
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
    }, this.pool = new K(this.pc, {
      channelCount: this.dataChannelCount,
      ordered: this.serverMode
    }), this.pool.onOpen((e) => {
      this._emit("channel-open", e), this._updateBondingPaths();
    }), this.pool.onClose((e) => {
      this._emit("channel-close", e);
    }), this.pool.onMessage((e, s) => {
      this._routeIncoming(s, `dc-${e}`);
    }), this.pool.createChannels(), this.media = new ue(this.pc, () => this._renegotiate()));
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
    const s = await this.pc.createAnswer();
    await this.pc.setLocalDescription(s), this.signaling.send({
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
    if (!this.pc || !this._isSignalingReady()) return;
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
    }, s = this.serverMode ? async (t) => {
      const n = g(m.PROXY, t);
      this.pool.sendImmediate(n) === -1 && await this.pool.send(n);
    } : async (t) => {
      await e(g(m.PROXY, t));
    };
    this.message = new ne(async (t) => {
      await e(g(m.MESSAGE, t));
    }), this._proxyClient = new ce(s), this._proxyServer = new de(s, this._proxyOpts), this.proxy = {
      /** Fetch a URL through the P2P tunnel. */
      fetch: (t, n) => this._proxyClient.fetch(t, n),
      /** Start serving as an exit node for proxy requests. */
      serve: (t) => {
        t && (this._proxyServer._allowList = t.allowList || [], this._proxyServer._blockList = t.blockList || []), this._proxyServer.serve();
      },
      /** Stop serving proxy requests. */
      stop: () => this._proxyServer.stop()
    }, this.stream = new _e(async (t) => {
      await e(g(m.STREAM, t));
    });
  }
  _updateBondingPaths() {
    const e = [], s = [];
    for (const t of this.pool.openChannels) {
      const n = `dc-${t}`;
      s.push(n), e.push(async (i) => {
        await this.pool.sendOnChannel(t, i);
      });
    }
    this.bonding ? this.bonding.updatePaths(e, s) : (this.bonding = new z({
      senders: e,
      linkIds: s,
      monitor: this.monitor
    }), this.bonding.onProgress((t) => {
      this._emit("progress", t);
    }), this.bonding.onComplete(({ transferId: t, data: n }) => {
      const i = this._pendingMeta.get(t);
      i ? (this._pendingMeta.delete(t), this._emit("file", { ...i, data: n, transferId: t })) : this._emit("data", { data: n, transferId: t });
    }));
  }
  // ── Internal: Message routing ──
  /**
   * Route incoming binary data to the correct subsystem based on channel type prefix.
   */
  _routeIncoming(e, s) {
    const t = new Uint8Array(e);
    if (t.length < 1) return;
    const n = t[0], i = e.slice(1);
    switch (n) {
      case m.CHUNK:
        this._handleChunkData(i, s);
        break;
      case m.MESSAGE:
        this.message && this.message.handleIncoming(i);
        break;
      case m.PROXY:
        this._handleProxyData(i);
        break;
      case m.STREAM:
        this.stream && this.stream.handleIncoming(i);
        break;
      default:
        this._handleChunkData(e, s);
        break;
    }
  }
  _handleChunkData(e, s) {
    const t = Y(e);
    if (t.flags & w.PROBE) {
      this._handleProbe(t, s);
      return;
    }
    if (t.flags & w.META) {
      const n = X(t.payload);
      this._pendingMeta.set(t.transferId, n), this._emit("file-incoming", { transferId: t.transferId, ...n });
      return;
    }
    t.flags & w.DATA && this.bonding && this.bonding.receiveChunk(t);
  }
  _handleProxyData(e) {
    new DataView(e).getUint8(0) === f.REQUEST ? this._proxyServer && this._proxyServer.handleIncoming(e) : this._proxyClient && this._proxyClient.handleIncoming(e);
  }
  // ── Internal: Probing ──
  _startProbing() {
    const e = this.serverMode ? 8e3 : 3e3;
    for (const s of this.pool.openChannels) {
      const t = `dc-${s}`;
      this.monitor.addLink(t);
      const n = setInterval(async () => {
        const i = Z(performance.now());
        try {
          await this.pool.sendOnChannel(s, g(m.CHUNK, i)), this.monitor.recordProbeSent(t);
        } catch {
        }
      }, e);
      this._probeTimers.set(t, n);
    }
  }
  _handleProbe(e, s) {
    if (e.payload) {
      const t = ee(e.payload), n = performance.now() - t;
      n > 0 && n < 3e4 && this.monitor.recordProbeResponse(s, n);
    }
  }
}
export {
  z as BondingEngine,
  $ as ConnectionMonitor,
  H as DEFAULT_CHUNK_SIZE,
  K as DataChannelPool,
  _ as DriveSignal,
  pe as FastRTC,
  w as Flags,
  C as HEADER_SIZE,
  ue as MediaManager,
  ne as Messenger,
  ce as ProxyClient,
  f as ProxyFrameType,
  de as ProxyServer,
  D as Stream,
  _e as StreamManager,
  Y as decodeChunk,
  X as decodeMetaPayload,
  ee as decodeProbeTimestamp,
  W as decodeProxyFrame,
  E as encodeChunk,
  Q as encodeMetaChunk,
  Z as encodeProbe,
  ie as encodeRequest,
  U as splitIntoChunks
};
