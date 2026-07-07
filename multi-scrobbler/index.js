(function(Y,p,r,x,Pt,D,re,k,R,Q,Qe,ne){// src/index.tsx
  var import_vendetta11 = p;
  var import_common12 = r;

  // src/constants.ts
  var Constants = {
    DEFAULT_APP_NAME: "Music",
    DEFAULT_TIME_INTERVAL: 5,
    // Discord application ID
    APPLICATION_ID: "1368513179272871956",
    // Don't check more than once every 3 seconds to avoid getting rate limited
    MIN_UPDATE_INTERVAL: 3,
    // How many times to retry failed API calls
    MAX_RETRY_ATTEMPTS: 3,
    // Wait 5 seconds between retries
    RETRY_DELAY: 5e3,
    // Configuration for each supported service
    SERVICES: {
      lastfm: {
        name: "Last.fm",
        baseUrl: "https://ws.audioscrobbler.com/2.0",
        requiresApiKey: true,
        requiresToken: false
      },
      listenbrainz: {
        name: "ListenBrainz",
        baseUrl: "https://api.listenbrainz.org/1",
        requiresApiKey: true,
        requiresToken: true
      }
    },
    // Default request headers. Avoid setting a custom User-Agent here to prevent exposing
    // environment or build details; the runtime should manage safe headers.
    DEFAULT_HEADERS: {},
    // Default album cover hashes
    DEFAULT_COVER_HASHES: ["2a96cbd8b46e442fc41c2b86b821562f"],
    // Plugin defaults
    DEFAULT_SETTINGS: {
      username: "",
      apiKey: "",
      appName: "Music",
      timeInterval: 5,
      showTimestamp: true,
      listeningTo: true,
      showLargeText: true,
      ignoreYouTubeMusic: false,
      verboseLogging: false,
      service: void 0,
      listenbrainzUsername: "",
      listenbrainzToken: ""
    },
    // ListenBrainz API error codes
    API_ERROR_CODES: {
      2: "Invalid service",
      3: "Invalid method",
      4: "Invalid format",
      5: "Invalid parameters",
      6: "Invalid resource specified",
      7: "Invalid session key",
      8: "Invalid API key",
      9: "Invalid session",
      10: "Invalid API signature",
      11: "Service offline",
      13: "Invalid method signature supplied",
      16: "Service temporarily unavailable",
      26: "Suspended API key",
      29: "Rate limit exceeded"
    }
  };
  var constants_default = Constants;

  // src/modules.ts
  var import_metro = x;
  var { SET_ACTIVITY } = (0, import_metro.findByProps)("SET_ACTIVITY");
  var AssetManager = (0, import_metro.findByProps)("getAssetIds");
  var SelfPresenceStore = (0, import_metro.findByStoreName)("SelfPresenceStore");
  var UserStore = (0, import_metro.findByStoreName)("UserStore");

  // src/utils/activity.ts
  var import_common = r;
  function clearActivity() {
    return sendRequest(null);
  }
  function sendRequest(activity) {
    if (pluginState.pluginStopped) {
      stop();
      activity = null;
    }
    pluginState.lastActivity = activity;
    import_common.FluxDispatcher.dispatch({
      type: "LOCAL_ACTIVITY_UPDATE",
      activity,
      pid: 2312,
      socketId: "Multi-Scrobbler@Vendetta"
    });
  }
  async function fetchAsset(asset, appId = constants_default.APPLICATION_ID) {
    if (!asset?.length) return [];
    try {
      return await AssetManager.fetchAssetIds(appId, asset);
    } catch (error) {
      console.error("[Multi-Scrobbler] Failed to fetch assets:", error);
      return [];
    }
  }

  // src/utils/debug.ts
  var import_react = Qe;
  var __forceUpdate;
  var debugInfo = {};
  debugInfo.componentMountErrors = [];
  debugInfo.componentMountCount = 0;
  debugInfo.settingsLoadAttempts = 0;
  debugInfo.serviceErrors = { lastfm: [], listenbrainz: [] };
  debugInfo.apiCallCount = 0;
  debugInfo.connectionAttempts = 0;
  debugInfo.lastCredentialValidation = {
    lastfm: false,
    listenbrainz: false
  };
  var log = (...args) => console.log("[Debug]", ...args);
  var logError = (...args) => console.error("[Debug] Error:", ...args);
  function setDebugInfo(key, value) {
    debugInfo[key] = value;
    if (key === "lastError" && value) {
      logError("Error recorded:", value.message);
    } else if (key === "lastTrack" && value) {
      log(
        "Track updated:",
        `${value.artist} - ${value.name}`
      );
    } else if (key === "currentService" && value) {
      log("Service changed to:", value);
    }
    __forceUpdate?.();
  }
  function incrementApiCall() {
    debugInfo.apiCallCount = (debugInfo.apiCallCount || 0) + 1;
    log(`API call count: ${debugInfo.apiCallCount}`);
  }
  function recordServiceError(service, error) {
    debugInfo.serviceErrors = debugInfo.serviceErrors || {
      lastfm: [],
      listenbrainz: []
    };
    debugInfo.serviceErrors[service] = debugInfo.serviceErrors[service] || [];
    debugInfo.serviceErrors[service].push(
      `${(/* @__PURE__ */ new Date()).toISOString()}: ${error}`
    );
    if (debugInfo.serviceErrors[service].length > 10) {
      debugInfo.serviceErrors[service] = debugInfo.serviceErrors[service].slice(-10);
    }
    logError(`${service} error:`, error);
    __forceUpdate?.();
  }
  function recordSuccessfulUpdate() {
    debugInfo.lastSuccessfulUpdate = (/* @__PURE__ */ new Date()).toISOString();
    log("Successful update recorded at:", debugInfo.lastSuccessfulUpdate);
    __forceUpdate?.();
  }

  // src/services/BaseService.ts
  var BaseService = class {
    retryCount = 0;
    lastError = 0;
    log(...args) {
      console.log(`[${this.getServiceName()}]`, ...args);
    }
    logError(...args) {
      console.error(`[${this.getServiceName()}] Error:`, ...args);
    }
    logVerbose(...args) {
      console.log(`[${this.getServiceName()}] Verbose:`, ...args);
    }
    async handleError(error) {
      this.lastError = error.error || 0;
      const errorMessage = this.getErrorMessage(error);
      this.logError(errorMessage);
      recordServiceError(
        this.getServiceName().toLowerCase(),
        errorMessage
      );
      throw new Error(`${this.getServiceName()} API Error: ${errorMessage}`);
    }
    getErrorMessage(error) {
      if (error.error && constants_default.API_ERROR_CODES[error.error]) {
        return constants_default.API_ERROR_CODES[error.error];
      }
      return error.message || error.toString() || "Unknown error";
    }
    async makeRequest(url, options = {}) {
      try {
        this.logVerbose(`Making request to: ${url}`);
        incrementApiCall();
        const response = await fetch(url, {
          ...options,
          headers: {
            "User-Agent": "Vendetta Multi-Service Scrobbler/3.0.0",
            ...options.headers
          }
        });
        if (!response.ok) {
          const error = new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
          recordServiceError(
            this.getServiceName().toLowerCase(),
            error.message
          );
          throw error;
        }
        const data = await response.json();
        if (data.error) {
          await this.handleError(data);
        }
        this.retryCount = 0;
        return data;
      } catch (error) {
        this.retryCount++;
        if (this.retryCount > constants_default.MAX_RETRY_ATTEMPTS) {
          this.retryCount = 0;
          recordServiceError(
            this.getServiceName().toLowerCase(),
            `Max retries exceeded: ${error.message}`
          );
          throw error;
        }
        this.logVerbose(
          `Request failed, retrying (${this.retryCount}/${constants_default.MAX_RETRY_ATTEMPTS})`
        );
        await new Promise(
          (resolve) => setTimeout(resolve, constants_default.RETRY_DELAY)
        );
        return this.makeRequest(url, options);
      }
    }
    isDefaultCover(cover) {
      if (!cover) return true;
      return constants_default.DEFAULT_COVER_HASHES.some((hash) => cover.includes(hash));
    }
    processAlbumArt(cover) {
      if (!cover || this.isDefaultCover(cover)) {
        return null;
      }
      return cover;
    }
    getLastError() {
      return this.lastError;
    }
    resetRetryCount() {
      this.retryCount = 0;
    }
  };

  // src/services/LastFmService.ts
  var LastFmService = class extends BaseService {
    getServiceName() {
      return "Last.fm";
    }
    logVerbose(...args) {
      if (currentSettings.verboseLogging) {
        console.log(`[${this.getServiceName()}] Verbose:`, ...args);
      }
    }
    async validateCredentials() {
      try {
        if (!currentSettings.username || !currentSettings.apiKey) {
          throw new Error("Username or API key not set");
        }
        const params = new URLSearchParams({
          method: "user.getinfo",
          user: currentSettings.username,
          api_key: currentSettings.apiKey,
          format: "json"
        });
        const url = `${constants_default.SERVICES.lastfm.baseUrl}?${params}`;
        await this.makeRequest(url);
        this.log("Credentials validation successful");
        return true;
      } catch (error) {
        this.logError("Credentials validation failed:", error);
        return false;
      }
    }
    async fetchLatestScrobble() {
      try {
        if (!currentSettings.username || !currentSettings.apiKey) {
          throw new Error("Username or API key not set");
        }
        this.logVerbose(
          "Fetching latest scrobble for user:",
          currentSettings.username
        );
        const params = new URLSearchParams({
          method: "user.getrecenttracks",
          user: currentSettings.username,
          api_key: currentSettings.apiKey,
          limit: "1",
          extended: "1",
          format: "json"
        });
        const url = `${constants_default.SERVICES.lastfm.baseUrl}?${params}`;
        const data = await this.makeRequest(url);
        const lastTrack = data?.recenttracks?.track?.[0];
        if (!lastTrack) {
          throw new Error("No tracks found");
        }
        this.logVerbose("Raw track data:", lastTrack);
        const isNowPlaying = Boolean(lastTrack["@attr"]?.nowplaying);
        const trackTimestamp = lastTrack.date?.uts ? parseInt(lastTrack.date.uts) : Math.floor(Date.now() / 1e3);
        const resolveField = (v, altKey = "name") => {
          if (!v) return "";
          if (typeof v === "string") return v;
          return v["#text"] ?? v[altKey] ?? "";
        };
        let duration = null;
        let endTime = null;
        if (isNowPlaying) {
          try {
            const trackInfoParams = new URLSearchParams({
              method: "track.getInfo",
              track: lastTrack.name,
              artist: resolveField(lastTrack.artist),
              api_key: currentSettings.apiKey,
              format: "json"
            });
            const trackInfoUrl = `${constants_default.SERVICES.lastfm.baseUrl}?${trackInfoParams}`;
            const trackInfo = await this.makeRequest(trackInfoUrl);
            if (trackInfo?.track?.duration) {
              duration = parseInt(trackInfo.track.duration);
              if (duration > 0) {
                duration = Math.floor(duration / 1e3);
                endTime = trackTimestamp + duration;
              }
            }
          } catch (error) {
            this.logVerbose("Failed to fetch track duration:", error);
          }
        }
        const albumArt = this.processAlbumArt(
          lastTrack.image?.find((img) => img.size === "large")?.["#text"]
        );
        const track = {
          name: lastTrack.name,
          artist: resolveField(lastTrack.artist),
          album: resolveField(lastTrack.album, "title"),
          albumArt,
          url: lastTrack.url,
          date: lastTrack.date?.["#text"] ?? "now",
          nowPlaying: isNowPlaying,
          loved: lastTrack.loved === "1",
          from: trackTimestamp,
          to: endTime,
          duration
        };
        this.logVerbose("Processed track:", track);
        this.log(
          `${isNowPlaying ? "Now playing" : "Last played"}:`,
          `${track.artist} - ${track.name}`
        );
        return track;
      } catch (error) {
        this.logError("Failed to fetch latest scrobble:", error);
        throw error;
      }
    }
  };

  // src/services/ListenBrainzService.ts
  var ListenBrainzService = class extends BaseService {
    getServiceName() {
      return "ListenBrainz";
    }
    logVerbose(...args) {
      if (currentSettings.verboseLogging) {
        console.log(`[${this.getServiceName()}] Verbose:`, ...args);
      }
    }
    async validateCredentials() {
      try {
        const username = currentSettings.listenbrainzUsername;
        const token = currentSettings.listenbrainzToken;
        if (!username) {
          throw new Error("Username not set for ListenBrainz");
        }
        const url = `${constants_default.SERVICES.listenbrainz.baseUrl}/user/${encodeURIComponent(username)}/listens?count=1`;
        const headers = {};
        if (token) {
          headers["Authorization"] = `Token ${token}`;
        }
        await this.makeRequest(url, { headers });
        this.log("Credentials validation successful");
        return true;
      } catch (error) {
        this.logError("Credentials validation failed:", error);
        return false;
      }
    }
    async fetchLatestScrobble() {
      try {
        const username = currentSettings.listenbrainzUsername;
        const token = currentSettings.listenbrainzToken;
        if (!username) {
          throw new Error("Username not set for ListenBrainz");
        }
        this.logVerbose("Fetching latest scrobble for user:", username);
        let currentlyPlaying = null;
        const extractListens = (resp) => {
          if (!resp) return void 0;
          if (Array.isArray(resp.listens)) return resp.listens;
          if (resp.payload && Array.isArray(resp.payload.listens))
            return resp.payload.listens;
          if (resp.data && Array.isArray(resp.data.listens))
            return resp.data.listens;
          return void 0;
        };
        try {
          const playingNowUrl = `${constants_default.SERVICES.listenbrainz.baseUrl}/user/${encodeURIComponent(username)}/playing-now`;
          const headers = {};
          if (token) {
            headers["Authorization"] = `Token ${token}`;
          }
          const playingNowRaw = await this.makeRequest(playingNowUrl, {
            headers
          });
          const playingNowListens = extractListens(playingNowRaw);
          if (playingNowListens && playingNowListens.length > 0) {
            currentlyPlaying = playingNowListens[0];
            currentlyPlaying.playing_now = true;
          }
        } catch (error) {
          this.logVerbose(
            "No currently playing track or failed to fetch:",
            error
          );
        }
        let latestListen;
        if (currentlyPlaying) {
          latestListen = currentlyPlaying;
          this.logVerbose("Using currently playing track");
        } else {
          const url = `${constants_default.SERVICES.listenbrainz.baseUrl}/user/${encodeURIComponent(username)}/listens?count=1`;
          const headers = {};
          if (token) {
            headers["Authorization"] = `Token ${token}`;
          }
          const dataRaw = await this.makeRequest(url, {
            headers
          });
          const recentListens = (() => {
            if (!dataRaw) return void 0;
            if (Array.isArray(dataRaw.listens)) return dataRaw.listens;
            if (dataRaw.payload && Array.isArray(dataRaw.payload.listens))
              return dataRaw.payload.listens;
            if (dataRaw.data && Array.isArray(dataRaw.data.listens))
              return dataRaw.data.listens;
            return void 0;
          })();
          if (!recentListens || recentListens.length === 0) {
            throw new Error("No listens found");
          }
          latestListen = recentListens[0];
          this.logVerbose("Using latest completed listen");
        }
        this.logVerbose("Raw listen data:", latestListen);
        const isNowPlaying = Boolean(latestListen.playing_now);
        const trackTimestamp = latestListen.listened_at || Math.floor(Date.now() / 1e3);
        let duration = null;
        let endTime = null;
        if (latestListen.track_metadata.additional_info?.duration_ms) {
          duration = Math.floor(
            latestListen.track_metadata.additional_info.duration_ms / 1e3
          );
          if (isNowPlaying && duration > 0) {
            endTime = trackTimestamp + duration;
          }
        }
        let albumArt = null;
        if (latestListen.track_metadata.additional_info?.release_mbid) {
          try {
            const coverUrl = `https://coverartarchive.org/release/${latestListen.track_metadata.additional_info.release_mbid}/front`;
            const coverResponse = await fetch(coverUrl, { method: "HEAD", redirect: "follow" });
            if (coverResponse.ok) {
              albumArt = coverUrl;
              this.logVerbose("Found album art from Cover Art Archive");
            }
          } catch (error) {
            this.logVerbose("Failed to fetch album art from Cover Art Archive:", error);
          }
        }
        const track = {
          name: latestListen.track_metadata.track_name,
          artist: latestListen.track_metadata.artist_name,
          album: latestListen.track_metadata.release_name || "",
          albumArt,
          url: latestListen.track_metadata.additional_info?.origin_url || `https://listenbrainz.org/player/${latestListen.track_metadata.additional_info?.recording_mbid || `${encodeURIComponent(latestListen.track_metadata.artist_name)}/${encodeURIComponent(latestListen.track_metadata.track_name)}`}`,
          date: isNowPlaying ? "now" : new Date(trackTimestamp * 1e3).toISOString(),
          nowPlaying: isNowPlaying,
          loved: false,
          from: trackTimestamp,
          to: endTime,
          duration
        };
        this.logVerbose("Processed track:", track);
        this.log(
          `${isNowPlaying ? "Now playing" : "Last played"}:`,
          `${track.artist} - ${track.name}`
        );
        return track;
      } catch (error) {
        this.logError("Failed to fetch latest listen:", error);
        throw error;
      }
    }
    getErrorMessage(error) {
      if (error.error) {
        return error.error;
      }
      if (error.message) {
        return error.message;
      }
      return error.toString() || "Unknown error";
    }
  };

  // src/services/ServiceFactory.ts
  var ServiceFactory = class _ServiceFactory {
    static instance;
    serviceInstances;
    constructor() {
      this.serviceInstances = /* @__PURE__ */ new Map();
    }
    static getInstance() {
      if (!_ServiceFactory.instance) {
        _ServiceFactory.instance = new _ServiceFactory();
      }
      return _ServiceFactory.instance;
    }
    getService(serviceType) {
      if (!this.serviceInstances) {
        this.serviceInstances = /* @__PURE__ */ new Map();
      }
      const type = serviceType || currentSettings.service;
      if (!type) {
        throw new Error(
          "[ServiceFactory] No service type specified and no default service configured"
        );
      }
      if (!this.serviceInstances.has(type)) {
        this.serviceInstances.set(type, this.createService(type));
      }
      return this.serviceInstances.get(type);
    }
    getCurrentService() {
      return this.getService(currentSettings.service);
    }
    createService(serviceType) {
      switch (serviceType) {
        case "lastfm":
          return new LastFmService();
        case "listenbrainz":
          return new ListenBrainzService();
        default:
          throw new Error(
            `[ServiceFactory] Unknown service type: ${serviceType}`
          );
      }
    }
    clearCache() {
      if (this.serviceInstances) {
        this.serviceInstances.clear();
      } else {
        this.serviceInstances = /* @__PURE__ */ new Map();
      }
    }
    validateCurrentService() {
      return this.getCurrentService().validateCredentials();
    }
    async testService(serviceType) {
      try {
        const service = this.getService(serviceType);
        return await service.validateCredentials();
      } catch (error) {
        console.error(`[ServiceFactory] Failed to test ${serviceType}:`, error);
        return false;
      }
    }
    getSupportedServices() {
      return ["lastfm", "listenbrainz"];
    }
    getServiceDisplayName(serviceType) {
      const service = this.getService(serviceType);
      return service.getServiceName();
    }
  };
  var serviceFactory = ServiceFactory.getInstance();

  // src/utils/time.ts
  function formatDuration(seconds) {
    if (!seconds || seconds < 0) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  function getCurrentTimestamp() {
    return Math.floor(Date.now() / 1e3);
  }

  // src/manager.ts
  var log2 = (...message) => console.log("[Scrobble Plugin]", ...message);
  var logError2 = (...message) => console.error("[Scrobble Plugin] Error:", ...message);
  var logVerbose = (...message) => currentSettings.verboseLogging && console.log("[Scrobble Plugin] Verbose:", ...message);
  var PluginManager = class _PluginManager {
    static instance;
    updateTimer;
    reconnectTimer;
    consecutiveFailures = 0;
    isReconnecting = false;
    currentActivity;
    lastUpdateTime = 0;
    constructor() {
    }
    static getInstance() {
      if (!_PluginManager.instance) {
        _PluginManager.instance = new _PluginManager();
      }
      return _PluginManager.instance;
    }
    // Check for new tracks and update Discord status when something changes
    async updateActivity() {
      if (pluginState.pluginStopped) {
        log2("Plugin is stopped; skipping activity updates and clearing timers");
        logVerbose("Plugin is stopped, skipping update");
        try {
          this.stopUpdates();
          logVerbose("Update timers cleared due to stopped plugin");
        } catch (e) {
          logError2("Error while stopping updates for stopped plugin:", e);
        }
        return;
      }
      const serviceName = serviceFactory.getCurrentService().getServiceName();
      logVerbose(`Fetching latest track from ${serviceName}...`);
      let willUpdateRPC = false;
      try {
        if (currentSettings.ignoreList && currentSettings.ignoreList.length > 0) {
          const ignoredActivity = SelfPresenceStore.findActivity((act) => {
            if (!act.name) return false;
            return currentSettings.ignoreList.some(
              (ignoredApp) => act.name.toLowerCase().includes(ignoredApp.toLowerCase())
            );
          });
          if (ignoredActivity) {
            log2(`Ignored app (${ignoredActivity.name}) is currently active; clearing activity and skipping updates`);
            logVerbose(
              `Ignored app (${ignoredActivity.name}) is currently playing, clearing activity`
            );
            try {
              setDebugInfo("ignoredActivity", ignoredActivity.name);
            } catch (e) {
              logVerbose("Failed to set debug info for ignored activity:", e);
            }
            clearActivity();
            return;
          }
        }
        incrementApiCall();
        const lastTrack = await serviceFactory.getCurrentService().fetchLatestScrobble();
        setDebugInfo("lastTrack", lastTrack);
        if (!lastTrack.nowPlaying) {
          log2("No currently playing track reported by service; clearing activity and skipping RPC update");
          logVerbose("Track is not currently playing");
          try {
            setDebugInfo("lastTrack_nowPlaying", false);
          } catch (e) {
            logVerbose("Failed to set debug info for nowPlaying:", e);
          }
          clearActivity();
          return;
        }
        if (pluginState.lastTrackUrl === lastTrack.url) {
          log2("Track unchanged; skipping Discord RPC update");
          logVerbose("Track hasn't changed");
          recordSuccessfulUpdate();
          this.consecutiveFailures = 0;
          return;
        }
        willUpdateRPC = true;
        log2(`\u{1F3B5} Track changed: ${lastTrack.artist} - ${lastTrack.name}`);
        let activityTimestamps;
        if (lastTrack.nowPlaying && currentSettings.showTimestamp && lastTrack.from && lastTrack.duration && lastTrack.duration > 0) {
          const now = getCurrentTimestamp();
          let startTime = lastTrack.from;
          if (startTime < now - 3600) {
            if (lastTrack.duration && lastTrack.duration > 0) {
              const estimatedElapsed = Math.min(lastTrack.duration * 0.1, 30);
              startTime = now - estimatedElapsed;
            } else {
              startTime = now;
            }
            logVerbose("had to estimate start time");
          }
          activityTimestamps = {
            start: startTime * 1e3
          };
          if (lastTrack.to) {
            activityTimestamps.end = lastTrack.to * 1e3;
          }
        }
        logVerbose(
          `\u{1F3AF} Preparing RPC update for: ${lastTrack.artist} - ${lastTrack.name}`
        );
        const activity = {
          name: currentSettings.appName || constants_default.DEFAULT_APP_NAME,
          flags: 0,
          type: currentSettings.listeningTo ? 2 /* LISTENING */ : 0 /* PLAYING */,
          details: lastTrack.name,
          state: `${lastTrack.artist}`,
          status_display_type: 1,
          application_id: constants_default.APPLICATION_ID
        };
        if (activity.name.includes("{{")) {
          const variables = {
            artist: lastTrack.artist,
            name: lastTrack.name,
            album: lastTrack.album,
            service: serviceName
          };
          for (const [key, value] of Object.entries(variables)) {
            activity.name = activity.name.replace(
              new RegExp(`{{${key}}}`, "g"),
              value || ""
            );
          }
        }
        if (activityTimestamps) {
          activity.timestamps = activityTimestamps;
          logVerbose("Timestamps set:", {
            start: new Date(activityTimestamps.start).toISOString(),
            end: activityTimestamps.end ? new Date(activityTimestamps.end).toISOString() : "none",
            duration: lastTrack.duration ? formatDuration(lastTrack.duration) : "unknown"
          });
        }
        if (lastTrack.album || lastTrack.albumArt) {
          let largeImageAsset = lastTrack.albumArt || null;
          if (largeImageAsset) {
            try {
              const assets = await fetchAsset([largeImageAsset]);
              if (assets?.[0]) {
                largeImageAsset = assets[0];
              }
            } catch (e) {
            }
          }
          if (largeImageAsset) {
            activity.assets = {
              large_image: largeImageAsset
            };
            if (currentSettings.showLargeText) {
              let largeText = "";
              if (currentSettings.showAlbumInTooltip && lastTrack.album) {
                largeText += `on ${lastTrack.album}`;
              }
              if (currentSettings.showDurationInTooltip && lastTrack.duration) {
                const durationText = formatDuration(lastTrack.duration);
                if (largeText) {
                  largeText += ` \u2022 ${durationText}`;
                } else {
                  largeText = durationText;
                }
              }
              if (largeText) {
                activity.assets.large_text = largeText;
              }
            }
            logVerbose("Album art set:", largeImageAsset);
            if (activity.assets.large_text) {
              logVerbose("Tooltip text set:", activity.assets.large_text);
            }
          } else if (lastTrack.album && currentSettings.showLargeText && currentSettings.showAlbumInTooltip) {
            activity.assets = {
              large_text: `on ${lastTrack.album}`
            };
          }
        }
        logVerbose("Setting Discord activity:", activity);
        setDebugInfo("lastActivity", activity);
        await sendRequest(activity);
        pluginState.lastTrackUrl = lastTrack.url;
        this.currentActivity = activity;
        pluginState.lastActivity = activity;
        this.consecutiveFailures = 0;
        this.lastUpdateTime = getCurrentTimestamp();
        recordSuccessfulUpdate();
        log2(
          `\u2705 RPC updated successfully: ${lastTrack.artist} - ${lastTrack.name}`
        );
      } catch (error) {
        logError2("Update failed:", error);
        try {
          recordServiceError(currentSettings.service, error.message);
        } catch (e) {
          logError2("Failed to record service error:", e);
        }
        try {
          setDebugInfo("lastUpdateError", {
            message: error.message,
            service: currentSettings.service,
            lastTrackUrl: pluginState.lastTrackUrl
          });
        } catch (e) {
          logVerbose("Failed to set debug info for last update error:", e);
        }
        this.handleError(error);
      }
    }
    handleError(error) {
      this.consecutiveFailures++;
      setDebugInfo("lastError", error);
      logError2(
        `Failure ${this.consecutiveFailures}/${constants_default.MAX_RETRY_ATTEMPTS}:`,
        error.message
      );
      if (this.consecutiveFailures >= constants_default.MAX_RETRY_ATTEMPTS) {
        logError2("Max retry attempts reached, initiating reconnection...");
        this.startReconnection();
      }
    }
    startReconnection() {
      if (this.isReconnecting) return;
      this.isReconnecting = true;
      this.stopUpdates();
      log2("Starting reconnection process...");
      this.reconnectTimer = setInterval(() => {
        log2("Attempting to reconnect...");
        this.initialize().then(() => {
          log2("Reconnection successful!");
          this.stopReconnection();
        }).catch((error) => {
          logError2("Reconnection attempt failed:", error.message);
        });
      }, constants_default.RETRY_DELAY);
    }
    stopReconnection() {
      try {
        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = void 0;
        }
        this.isReconnecting = false;
        this.consecutiveFailures = 0;
      } catch (error) {
        console.error("[Scrobble Plugin] Reconnection cleanup error:", error);
      }
    }
    // clean up all timers
    stopUpdates() {
      try {
        if (this.updateTimer) {
          clearInterval(this.updateTimer);
          this.updateTimer = void 0;
        }
      } catch (error) {
        console.error("[Scrobble Plugin] Timer cleanup error:", error);
      }
    }
    // start everything up
    async initialize() {
      if (pluginState.pluginStopped) {
        throw new Error("Plugin is stopped");
      }
      const serviceName = serviceFactory.getCurrentService().getServiceName();
      log2(`Initializing with ${serviceName}...`);
      try {
        const isValid = await serviceFactory.validateCurrentService();
        if (!isValid) {
          throw new Error(`Invalid credentials for ${serviceName}`);
        }
        log2(`${serviceName} credentials validated successfully`);
      } catch (error) {
        logError2(`Failed to validate ${serviceName} credentials:`, error);
        throw error;
      }
      this.stopUpdates();
      log2("\u{1F3B5} checking for already playing songs...");
      await this.updateActivity();
      const interval = Math.max(
        (Number(currentSettings.timeInterval) || constants_default.DEFAULT_SETTINGS.timeInterval) * 1e3,
        constants_default.MIN_UPDATE_INTERVAL * 1e3
      );
      this.updateTimer = setInterval(() => this.updateActivity(), interval);
      log2(
        `Update timer started with interval: ${interval}ms (${interval / 1e3}s)`
      );
    }
    // stop everything and clean up
    stop() {
      if (pluginState.pluginStopped) {
        return;
      }
      log2("Stopping plugin...");
      pluginState.pluginStopped = true;
      try {
        this.stopUpdates();
        this.stopReconnection();
        clearActivity();
        log2("Plugin stopped successfully");
      } catch (error) {
        console.error("[Scrobble Plugin] Stop error:", error);
      }
    }
    // change to a different scrobble service
    async switchService(newService) {
      if (pluginState.pluginStopped) {
        return;
      }
      log2(`Switching to ${newService}...`);
      const wasRunning = !pluginState.pluginStopped;
      this.stop();
      try {
        serviceFactory.clearCache();
        pluginState.lastTrackUrl = void 0;
        this.currentActivity = void 0;
        this.lastUpdateTime = 0;
        if (wasRunning) {
          pluginState.pluginStopped = false;
          await this.initialize();
        }
      } catch (error) {
        logError2("Failed to switch service:", error);
      }
    }
    // get info about what's currently happening
    getStatus() {
      const serviceName = serviceFactory.getCurrentService().getServiceName();
      return {
        running: !pluginState.pluginStopped,
        service: serviceName,
        consecutiveFailures: this.consecutiveFailures,
        isReconnecting: this.isReconnecting,
        lastTrackUrl: pluginState.lastTrackUrl,
        updateInterval: this.updateTimer ? "Active" : "Inactive"
      };
    }
  };
  var manager = PluginManager.getInstance();
  var initialize = () => manager.initialize();
  var stop = () => manager.stop();
  var switchService = (service) => manager.switchService(service);

  // src/ui/pages/Settings.tsx
  var import_vendetta8 = p;
  var import_storage8 = Pt;
  var import_common9 = r;
  var import_common10 = r;

  // src/ui/pages/pages/components/TableComponents.tsx
  var import_metro2 = x;
  var { ScrollView } = (0, import_metro2.findByProps)("ScrollView");
  var {
    TableRowGroup,
    TableSwitchRow,
    TableCheckboxRow,
    Stack,
    TableRow
  } = (0, import_metro2.findByProps)(
    "TableSwitchRow",
    "TableCheckboxRow",
    "TableRowGroup",
    "Stack",
    "TableRow"
  );
  var { TextInput } = (0, import_metro2.findByProps)("TextInput");

  // src/ui/pages/pages/LastFmSettingsPage.tsx
  var import_common2 = r;
  var import_storage = Pt;
  var import_react_native = ne;
  var import_toasts = D;
  var import_assets = re;
  var import_vendetta = p;
  function LastFmSettingsPage() {
    (0, import_storage.useProxy)(import_vendetta.plugin.storage);
    const [, forceUpdate] = import_common2.React.useReducer((x) => x + 1, 0);
    const testConnection = async () => {
      (0, import_toasts.showToast)("Testing Last.fm connection...", (0, import_assets.getAssetIDByName)("ClockIcon"));
      try {
        const isValid = await serviceFactory2.testService("lastfm");
        if (isValid) {
          (0, import_toasts.showToast)(
            "\u2705 Last.fm connection successful!",
            (0, import_assets.getAssetIDByName)("CheckIcon")
          );
        } else {
          (0, import_toasts.showToast)("\u274C Last.fm connection failed", (0, import_assets.getAssetIDByName)("XIcon"));
        }
      } catch (error) {
        (0, import_toasts.showToast)("\u274C Connection error", (0, import_assets.getAssetIDByName)("XIcon"));
      }
    };
    return /* @__PURE__ */ import_common2.React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 10 } }, /* @__PURE__ */ import_common2.React.createElement(Stack, { spacing: 8 }, /* @__PURE__ */ import_common2.React.createElement(TableRowGroup, { title: "Credentials" }, /* @__PURE__ */ import_common2.React.createElement(Stack, { spacing: 4 }, /* @__PURE__ */ import_common2.React.createElement(
      TextInput,
      {
        placeholder: "Last.fm Username",
        value: getStorage("username"),
        onChange: (v) => {
          setStorage("username", v);
          forceUpdate();
        },
        isClearable: true
      }
    ), /* @__PURE__ */ import_common2.React.createElement(
      TextInput,
      {
        placeholder: "Last.fm API Key",
        value: getStorage("apiKey"),
        onChange: (v) => {
          setStorage("apiKey", v);
          forceUpdate();
        },
        secureTextEntry: true,
        isClearable: true
      }
    ))), /* @__PURE__ */ import_common2.React.createElement(TableRowGroup, { title: "Actions" }, /* @__PURE__ */ import_common2.React.createElement(
      TableRow,
      {
        label: "Test Connection",
        subLabel: "Verify your Last.fm credentials",
        trailing: /* @__PURE__ */ import_common2.React.createElement(TableRow.Arrow, null),
        onPress: testConnection
      }
    ), /* @__PURE__ */ import_common2.React.createElement(
      TableRow,
      {
        label: "Get API Key",
        subLabel: "Create a Last.fm API key at last.fm/api/account/create",
        trailing: /* @__PURE__ */ import_common2.React.createElement(TableRow.Arrow, null),
        onPress: async () => {
          try {
            await import_react_native.Linking.openURL("https://www.last.fm/api/account/create");
          } catch (error) {
            console.error("Failed to open Last.fm API URL:", error);
            (0, import_toasts.showToast)(
              "Failed to open web browser. Please visit: https://www.last.fm/api/account/create",
              (0, import_assets.getAssetIDByName)("XIcon")
            );
          }
        }
      }
    ))));
  }

  // src/ui/pages/pages/ListenBrainzSettingsPage.tsx
  var import_common3 = r;
  var import_storage2 = Pt;
  var import_react_native2 = ne;
  var import_toasts2 = D;
  var import_assets2 = re;
  var import_vendetta2 = p;
  function ListenBrainzSettingsPage() {
    (0, import_storage2.useProxy)(import_vendetta2.plugin.storage);
    const [, forceUpdate] = import_common3.React.useReducer((x) => x + 1, 0);
    const testConnection = async () => {
      (0, import_toasts2.showToast)(
        "Testing ListenBrainz connection...",
        (0, import_assets2.getAssetIDByName)("ClockIcon")
      );
      try {
        const isValid = await serviceFactory2.testService("listenbrainz");
        if (isValid) {
          (0, import_toasts2.showToast)(
            "\u2705 ListenBrainz connection successful!",
            (0, import_assets2.getAssetIDByName)("CheckIcon")
          );
        } else {
          (0, import_toasts2.showToast)(
            "\u274C ListenBrainz connection failed",
            (0, import_assets2.getAssetIDByName)("XIcon")
          );
        }
      } catch (error) {
        (0, import_toasts2.showToast)("\u274C Connection error", (0, import_assets2.getAssetIDByName)("XIcon"));
      }
    };
    return /* @__PURE__ */ import_common3.React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 10 } }, /* @__PURE__ */ import_common3.React.createElement(Stack, { spacing: 8 }, /* @__PURE__ */ import_common3.React.createElement(TableRowGroup, { title: "Credentials" }, /* @__PURE__ */ import_common3.React.createElement(Stack, { spacing: 4 }, /* @__PURE__ */ import_common3.React.createElement(
      TextInput,
      {
        placeholder: "ListenBrainz Username",
        value: getStorage("listenbrainzUsername"),
        onChange: (v) => {
          setStorage("listenbrainzUsername", v);
          forceUpdate();
        },
        isClearable: true
      }
    ), /* @__PURE__ */ import_common3.React.createElement(
      TextInput,
      {
        placeholder: "ListenBrainz Token",
        value: getStorage("listenbrainzToken"),
        onChange: (v) => {
          setStorage("listenbrainzToken", v);
          forceUpdate();
        },
        secureTextEntry: true,
        isClearable: true
      }
    ))), /* @__PURE__ */ import_common3.React.createElement(TableRowGroup, { title: "Actions" }, /* @__PURE__ */ import_common3.React.createElement(
      TableRow,
      {
        label: "Test Connection",
        subLabel: "Verify your ListenBrainz credentials",
        trailing: /* @__PURE__ */ import_common3.React.createElement(TableRow.Arrow, null),
        onPress: testConnection
      }
    ), /* @__PURE__ */ import_common3.React.createElement(
      TableRow,
      {
        label: "Get User Token",
        subLabel: "Get your ListenBrainz user token at listenbrainz.org/settings/",
        trailing: /* @__PURE__ */ import_common3.React.createElement(TableRow.Arrow, null),
        onPress: async () => {
          try {
            await import_react_native2.Linking.openURL("https://listenbrainz.org/settings/");
          } catch (error) {
            console.error(
              "Failed to open ListenBrainz settings URL:",
              error
            );
            (0, import_toasts2.showToast)(
              "Failed to open web browser. Please visit: https://listenbrainz.org/settings/",
              (0, import_assets2.getAssetIDByName)("XIcon")
            );
          }
        }
      }
    ))));
  }

  // src/ui/pages/pages/DisplaySettingsPage.tsx
  var import_common4 = r;
  var import_storage3 = Pt;
  var import_vendetta3 = p;
  function DisplaySettingsPage() {
    (0, import_storage3.useProxy)(import_vendetta3.plugin.storage);
    const [, forceUpdate] = import_common4.React.useReducer((x) => x + 1, 0);
    return /* @__PURE__ */ import_common4.React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 10 } }, /* @__PURE__ */ import_common4.React.createElement(Stack, { spacing: 8 }, /* @__PURE__ */ import_common4.React.createElement(TableRowGroup, { title: "Activity Display" }, /* @__PURE__ */ import_common4.React.createElement(Stack, { spacing: 4 }, /* @__PURE__ */ import_common4.React.createElement(
      TextInput,
      {
        placeholder: `App Name (Default: ${constants_default.DEFAULT_SETTINGS.appName})`,
        value: getStorage("appName", constants_default.DEFAULT_SETTINGS.appName),
        onChange: (v) => {
          setStorage("appName", v);
          forceUpdate();
        },
        isClearable: true
      }
    ), /* @__PURE__ */ import_common4.React.createElement(
      TextInput,
      {
        placeholder: `Update Interval (Default: ${constants_default.DEFAULT_SETTINGS.timeInterval}s)`,
        value: String(
          getStorage(
            "timeInterval",
            constants_default.DEFAULT_SETTINGS.timeInterval
          )
        ),
        onChange: (v) => {
          const interval = Number(v);
          if (interval >= constants_default.MIN_UPDATE_INTERVAL) {
            setStorage("timeInterval", interval);
            forceUpdate();
          }
        },
        keyboardType: "numeric",
        isClearable: true
      }
    ))), /* @__PURE__ */ import_common4.React.createElement(TableRowGroup, { title: "About Display Settings" }, /* @__PURE__ */ import_common4.React.createElement(
      TableRow,
      {
        label: "App Name",
        subLabel: "The name shown in Discord for your activity"
      }
    ), /* @__PURE__ */ import_common4.React.createElement(
      TableRow,
      {
        label: "Update Interval",
        subLabel: "How often the plugin checks for new tracks (in seconds)"
      }
    ), /* @__PURE__ */ import_common4.React.createElement(
      TableRow,
      {
        label: "Minimum Interval",
        subLabel: `The plugin will never check more frequently than ${constants_default.MIN_UPDATE_INTERVAL} seconds`
      }
    ))));
  }

  // src/ui/pages/pages/RPCCustomizationSettingsPage.tsx
  var import_common6 = r;
  var import_storage5 = Pt;
  var import_vendetta5 = p;

  // src/ui/pages/pages/components/RPCPreview.tsx
  var import_common5 = r;
  var import_storage4 = Pt;
  var import_vendetta4 = p;
  function RPCPreview() {
    (0, import_storage4.useProxy)(import_vendetta4.plugin.storage);
    const [previewTrack, setPreviewTrack] = import_common5.React.useState(null);
    const [isLoading, setIsLoading] = import_common5.React.useState(true);
    const [currentProgress, setCurrentProgress] = import_common5.React.useState(0);
    const fallbackTrack = {
      name: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      image: null,
      nowPlaying: true,
      duration: 354,
      startTime: Math.floor(Date.now() / 1e3) - 120
    };
    import_common5.React.useEffect(() => {
      const fetchPreviewData = async () => {
        const username = getStorage("listenbrainzUsername");
        if (!username) {
          setPreviewTrack(fallbackTrack);
          setIsLoading(false);
          return;
        }
        try {
          setIsLoading(true);
          const token = getStorage("listenbrainzToken");
          const headers = {
            "Content-Type": "application/json"
          };
          if (token) headers["Authorization"] = `Token ${token}`;
          let trackData = null;
          try {
            const playingNowRes = await fetch(
              `https://api.listenbrainz.org/1/user/${encodeURIComponent(username)}/playing-now`,
              { headers }
            );
            const playingNowData = await playingNowRes.json();
            const listens = playingNowData?.listens || playingNowData?.payload?.listens || playingNowData?.data?.listens;
            if (listens && listens.length > 0) {
              trackData = listens[0];
              trackData.playing_now = true;
            }
          } catch (e) {
          }
          if (!trackData) {
            const recentRes = await fetch(
              `https://api.listenbrainz.org/1/user/${encodeURIComponent(username)}/listens?count=1`,
              { headers }
            );
            const recentData = await recentRes.json();
            const listens = recentData?.listens || recentData?.payload?.listens || recentData?.data?.listens;
            if (listens && listens.length > 0) {
              trackData = listens[0];
            }
          }
          if (trackData) {
            const meta = trackData.track_metadata;
            const duration = meta.additional_info?.duration_ms ? Math.floor(meta.additional_info.duration_ms / 1e3) : 180;
            let image = null;
            if (meta.additional_info?.release_mbid) {
              try {
                const coverUrl = `https://coverartarchive.org/release/${meta.additional_info.release_mbid}/front`;
                const coverRes = await fetch(coverUrl, {
                  method: "HEAD",
                  redirect: "follow"
                });
                if (coverRes.ok) image = coverUrl;
              } catch (e) {
              }
            }
            if (!image && getStorage("username") && getStorage("apiKey")) {
              try {
                const lfmRes = await fetch(
                  `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${getStorage("apiKey")}&artist=${encodeURIComponent(meta.artist_name)}&track=${encodeURIComponent(meta.track_name)}&format=json`
                );
                const lfmData = await lfmRes.json();
                const images = lfmData?.track?.album?.image;
                if (images && images.length > 0) {
                  for (let i = images.length - 1; i >= 0; i--) {
                    if (images[i]["#text"]) {
                      image = images[i]["#text"];
                      break;
                    }
                  }
                }
              } catch (e) {
              }
            }
            setPreviewTrack({
              name: meta.track_name || "Unknown Track",
              artist: meta.artist_name || "Unknown Artist",
              album: meta.release_name || "",
              image,
              nowPlaying: Boolean(trackData.playing_now),
              duration,
              startTime: trackData.playing_now ? Math.floor(Date.now() / 1e3) - 60 : null
            });
          } else {
            setPreviewTrack(fallbackTrack);
          }
        } catch (error) {
          console.error("Failed to fetch ListenBrainz preview:", error);
          setPreviewTrack(fallbackTrack);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPreviewData();
    }, [getStorage("listenbrainzUsername"), getStorage("listenbrainzToken")]);
    import_common5.React.useEffect(() => {
      if (!previewTrack?.nowPlaying || !previewTrack.duration) {
        return;
      }
      const interval = setInterval(() => {
        if (previewTrack.startTime && previewTrack.duration) {
          const now = Math.floor(Date.now() / 1e3);
          const elapsed = now - previewTrack.startTime;
          const progress = Math.min(elapsed / previewTrack.duration, 1);
          setCurrentProgress(progress);
        }
      }, 1e3);
      return () => clearInterval(interval);
    }, [previewTrack]);
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };
    const getPreviewText = () => {
      let text = "";
      if (getStorage("showAlbumInTooltip") && previewTrack?.album) {
        text += `on ${previewTrack.album}`;
      }
      if (getStorage("showDurationInTooltip") && previewTrack?.duration) {
        const durationText = ` \u2022 ${formatTime(previewTrack.duration)}`;
        if (text) {
          text += durationText;
        } else {
          text = formatTime(previewTrack.duration);
        }
      }
      return text || null;
    };
    const getCurrentProgressData = () => {
      if (!previewTrack?.duration) return { current: 0, total: 0, progress: 0 };
      if (previewTrack.nowPlaying) {
        const current = currentProgress * previewTrack.duration;
        return {
          current,
          total: previewTrack.duration,
          progress: currentProgress
        };
      } else {
        return {
          current: previewTrack.duration * 0.3,
          total: previewTrack.duration,
          progress: 0.3
        };
      }
    };
    const activityType = getStorage("listeningTo") ? "Listening to" : "Playing";
    const appName = getStorage("appName") || "Music";
    const showLargeText = getStorage("showLargeText", true);
    const showTimestamp = getStorage("showTimestamp", false);
    const hasDuration = Boolean(previewTrack?.duration);
    if (isLoading) {
      return /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.container }, /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.loadingContent }, /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.loadingSpinner }), /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.Text, { style: styles.loadingText }, "Loading preview...")));
    }
    if (!previewTrack) {
      return /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.container }, /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.Text, { style: styles.centeredText }, "Unable to load preview"));
    }
    const progressData = getCurrentProgressData();
    const previewText = getPreviewText();
    return /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.previewContainer }, /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.header }, /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.Text, { style: styles.activityType }, activityType, " ", appName), /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.Text, { style: styles.rpcPreviewText, numberOfLines: 1 }, "RPC Preview")), /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.content }, previewTrack.image ? /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.albumArt }, /* @__PURE__ */ import_common5.React.createElement(
      import_common5.ReactNative.Image,
      {
        source: { uri: previewTrack.image },
        style: styles.albumImage,
        resizeMode: "cover"
      }
    )) : null, /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.trackInfo }, /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.Text, { style: styles.trackName, numberOfLines: 1 }, previewTrack.name), /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.Text, { style: styles.artistName, numberOfLines: 1 }, previewTrack.artist), showLargeText && previewText && /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.Text, { style: styles.tooltipText, numberOfLines: 1 }, previewText), showTimestamp && hasDuration ? /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.progressContainer }, /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.Text, { style: styles.timeText }, formatTime(progressData.current)), /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.View, { style: styles.progressBar }, /* @__PURE__ */ import_common5.React.createElement(
      import_common5.ReactNative.View,
      {
        style: [
          styles.progressFill,
          { width: `${progressData.progress * 100}%` }
        ]
      }
    )), /* @__PURE__ */ import_common5.React.createElement(import_common5.ReactNative.Text, { style: styles.timeText }, formatTime(progressData.total))) : null)));
  }
  var styles = import_common5.ReactNative.StyleSheet.create({
    container: {
      backgroundColor: "#1e1f22",
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 10,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "#3a3c41",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 120
    },
    loadingContent: {
      alignItems: "center",
      justifyContent: "center"
    },
    loadingSpinner: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: "#5865f2",
      borderTopColor: "transparent",
      marginBottom: 8
    },
    previewContainer: {
      backgroundColor: "#1e1f22",
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 10,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "#3a3c41"
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      gap: 8
    },
    content: {
      flexDirection: "row",
      alignItems: "center"
    },
    albumArt: {
      width: 80,
      height: 80,
      backgroundColor: "#2b2d31",
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
      borderWidth: 1,
      borderColor: "#40444b",
      overflow: "hidden",
      flexShrink: 0
    },
    trackInfo: {
      flex: 1,
      minWidth: 0
    },
    progressContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 6
    },
    progressBar: {
      flex: 1,
      height: 2,
      backgroundColor: "#2b2d31",
      borderRadius: 3,
      overflow: "hidden"
    },
    progressFill: {
      height: 2,
      backgroundColor: "#5865f2",
      borderRadius: 3
    },
    loadingText: {
      color: "#949ba4",
      fontSize: 14,
      fontWeight: "500"
    },
    centeredText: {
      color: "#949ba4",
      fontSize: 14,
      fontWeight: "500",
      textAlign: "center"
    },
    activityType: {
      color: "#dbdee1",
      fontSize: 14,
      fontWeight: "600",
      flex: 1
    },
    rpcPreviewText: {
      color: "#80848e",
      fontSize: 12,
      fontStyle: "italic",
      flexShrink: 0
    },
    albumImage: {
      width: 80,
      height: 80,
      borderRadius: 12
    },
    trackName: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 4
    },
    artistName: {
      color: "#b5bac1",
      fontSize: 14,
      fontWeight: "500",
      marginBottom: 4
    },
    tooltipText: {
      color: "#80848e",
      fontSize: 12,
      fontStyle: "italic",
      marginBottom: 6
    },
    timeText: {
      color: "#80848e",
      fontSize: 11,
      fontWeight: "500",
      minWidth: 35,
      textAlign: "center"
    }
  });

  // src/ui/pages/pages/RPCCustomizationSettingsPage.tsx
  function RPCCustomizationSettingsPage() {
    (0, import_storage5.useProxy)(import_vendetta5.plugin.storage);
    const [, forceUpdate] = import_common6.React.useReducer((x) => x + 1, 0);
    const isListeningTo = getStorage(
      "listeningTo",
      constants_default.DEFAULT_SETTINGS.listeningTo
    );
    const showTimestamp = getStorage(
      "showTimestamp",
      constants_default.DEFAULT_SETTINGS.showTimestamp
    );
    const handleListeningToChange = () => {
      const newValue = !isListeningTo;
      setStorage("listeningTo", newValue);
      if (!newValue && showTimestamp) {
        setStorage("showTimestamp", false);
      }
      forceUpdate();
    };
    const handleTimestampChange = () => {
      if (!isListeningTo) return;
      setStorage("showTimestamp", !showTimestamp);
      forceUpdate();
    };
    return /* @__PURE__ */ import_common6.React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 10 } }, /* @__PURE__ */ import_common6.React.createElement(RPCPreview, null), /* @__PURE__ */ import_common6.React.createElement(Stack, { spacing: 8 }, /* @__PURE__ */ import_common6.React.createElement(TableRowGroup, { title: "RPC Display Options" }, /* @__PURE__ */ import_common6.React.createElement(
      TableCheckboxRow,
      {
        label: "Show as Listening",
        subLabel: "Display as 'Listening to' instead of 'Playing'",
        checked: isListeningTo,
        onPress: handleListeningToChange
      }
    ), /* @__PURE__ */ import_common6.React.createElement(
      TableCheckboxRow,
      {
        label: "Show Tooltip Text",
        subLabel: "Show album name and track duration in Discord activity tooltip",
        checked: getStorage("showLargeText", true),
        onPress: () => {
          const current = getStorage("showLargeText", true);
          setStorage("showLargeText", !current);
          forceUpdate();
        }
      }
    ), !isListeningTo && /* @__PURE__ */ import_common6.React.createElement(
      TableRow,
      {
        label: "Timestamp Unavailable",
        subLabel: "Enable 'Show as Listening' to use timestamp feature",
        disabled: true,
        dimmed: true
      }
    ), /* @__PURE__ */ import_common6.React.createElement(
      TableCheckboxRow,
      {
        label: "Show Timestamp",
        subLabel: "Display track progress (only shows when duration is available)",
        checked: showTimestamp,
        onPress: handleTimestampChange,
        disabled: !isListeningTo
      }
    ), /* @__PURE__ */ import_common6.React.createElement(
      TableCheckboxRow,
      {
        label: "Show Album in Tooltip",
        subLabel: "Include album name in the tooltip text",
        checked: getStorage("showAlbumInTooltip", true),
        onPress: () => {
          const current = getStorage("showAlbumInTooltip", true);
          setStorage("showAlbumInTooltip", !current);
          forceUpdate();
        }
      }
    ), /* @__PURE__ */ import_common6.React.createElement(
      TableCheckboxRow,
      {
        label: "Show Duration in Tooltip",
        subLabel: "Include track duration in the tooltip text",
        checked: getStorage("showDurationInTooltip", true),
        onPress: () => {
          const current = getStorage("showDurationInTooltip", true);
          setStorage("showDurationInTooltip", !current);
          forceUpdate();
        }
      }
    ))));
  }

  // src/ui/pages/pages/IgnoreListSettingsPage.tsx
  var import_common7 = r;
  var import_storage6 = Pt;
  var import_vendetta6 = p;
  var import_toasts3 = D;
  var import_assets3 = re;
  function IgnoreListSettingsPage() {
    (0, import_storage6.useProxy)(import_vendetta6.plugin.storage);
    const [, forceUpdate] = import_common7.React.useReducer((x) => x + 1, 0);
    const [newAppName, setNewAppName] = import_common7.React.useState("");
    const addAppToIgnoreList = () => {
      if (!newAppName.trim()) {
        (0, import_toasts3.showToast)("Please enter an app name", (0, import_assets3.getAssetIDByName)("Small"));
        return;
      }
      const ignoreList = getStorage("ignoreList", []);
      if (!ignoreList.includes(newAppName.trim())) {
        setStorage("ignoreList", [...ignoreList, newAppName.trim()]);
        setNewAppName("");
        forceUpdate();
        (0, import_toasts3.showToast)("App added to ignore list", (0, import_assets3.getAssetIDByName)("Check"));
      } else {
        (0, import_toasts3.showToast)("App already in ignore list", (0, import_assets3.getAssetIDByName)("Warning"));
      }
    };
    const removeAppFromIgnoreList = (appName) => {
      const ignoreList = getStorage("ignoreList", []);
      setStorage(
        "ignoreList",
        ignoreList.filter((app) => app !== appName)
      );
      forceUpdate();
      (0, import_toasts3.showToast)("App removed from ignore list", (0, import_assets3.getAssetIDByName)("Check"));
    };
    return /* @__PURE__ */ import_common7.React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 10 } }, /* @__PURE__ */ import_common7.React.createElement(Stack, { spacing: 8 }, /* @__PURE__ */ import_common7.React.createElement(TableRowGroup, { title: "Add App to Ignore" }, /* @__PURE__ */ import_common7.React.createElement(Stack, { spacing: 4 }, /* @__PURE__ */ import_common7.React.createElement(
      TextInput,
      {
        placeholder: "Enter app name",
        value: newAppName,
        onChange: setNewAppName,
        isClearable: true,
        onSubmitEditing: addAppToIgnoreList,
        returnKeyType: "done"
      }
    ))), /* @__PURE__ */ import_common7.React.createElement(TableRowGroup, null, /* @__PURE__ */ import_common7.React.createElement(
      TableRow,
      {
        label: "Add to Ignore List",
        subLabel: "Add the current app name to your ignore list",
        trailing: /* @__PURE__ */ import_common7.React.createElement(TableRow.Arrow, null),
        onPress: addAppToIgnoreList
      }
    )), getStorage("ignoreList", []).length > 0 && /* @__PURE__ */ import_common7.React.createElement(TableRowGroup, { title: "Ignored Apps" }, getStorage("ignoreList", []).map(
      (appName, index) => /* @__PURE__ */ import_common7.React.createElement(
        TableRow,
        {
          key: index,
          label: appName,
          trailing: /* @__PURE__ */ import_common7.React.createElement(
            import_common7.ReactNative.TouchableOpacity,
            {
              onPress: () => removeAppFromIgnoreList(appName),
              style: {
                padding: 8,
                backgroundColor: "#ff4d4d",
                borderRadius: 12,
                width: 24,
                height: 24,
                justifyContent: "center",
                alignItems: "center"
              }
            },
            /* @__PURE__ */ import_common7.React.createElement(
              import_common7.ReactNative.Image,
              {
                source: (0, import_assets3.getAssetIDByName)("TrashIcon"),
                style: { width: 14, height: 14, tintColor: "#ffffff" }
              }
            )
          )
        }
      )
    )), /* @__PURE__ */ import_common7.React.createElement(TableRowGroup, { title: "About Ignore List" }, /* @__PURE__ */ import_common7.React.createElement(
      TableRow,
      {
        label: "How it Works",
        subLabel: "When any app in your ignore list is active, your music status will be hidden"
      }
    ), /* @__PURE__ */ import_common7.React.createElement(
      TableRow,
      {
        label: "Detection",
        subLabel: "Apps are detected by their Discord activity name"
      }
    ), /* @__PURE__ */ import_common7.React.createElement(
      TableRow,
      {
        label: "Examples",
        subLabel: "Spotify, YouTube Music, Kizzy, Metrolist, echo"
      }
    ))));
  }

  // src/ui/pages/pages/LoggingSettingsPage.tsx
  var import_common8 = r;
  var import_storage7 = Pt;
  var import_vendetta7 = p;
  function LoggingSettingsPage() {
    (0, import_storage7.useProxy)(import_vendetta7.plugin.storage);
    const [, forceUpdate] = import_common8.React.useReducer((x) => x + 1, 0);
    return /* @__PURE__ */ import_common8.React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 10 } }, /* @__PURE__ */ import_common8.React.createElement(Stack, { spacing: 8 }, /* @__PURE__ */ import_common8.React.createElement(TableRowGroup, { title: "Logging Options" }, /* @__PURE__ */ import_common8.React.createElement(
      TableSwitchRow,
      {
        label: "Verbose Logging",
        subLabel: "Enable detailed console logging for debugging",
        value: getStorage(
          "verboseLogging",
          constants_default.DEFAULT_SETTINGS.verboseLogging
        ),
        onValueChange: (value) => {
          setStorage("verboseLogging", value);
          forceUpdate();
        }
      }
    )), /* @__PURE__ */ import_common8.React.createElement(TableRowGroup, { title: "Debug Information" }, /* @__PURE__ */ import_common8.React.createElement(
      TableRow,
      {
        label: "Console Logging",
        subLabel: "Logs are written to the browser/app console when verbose is enabled"
      }
    ), /* @__PURE__ */ import_common8.React.createElement(
      TableRow,
      {
        label: "Error Tracking",
        subLabel: "Connection errors and API failures are automatically logged"
      }
    )), /* @__PURE__ */ import_common8.React.createElement(TableRowGroup, { title: "Log Information" }, /* @__PURE__ */ import_common8.React.createElement(
      TableRow,
      {
        label: "API Calls",
        subLabel: "All API requests are logged when verbose is enabled"
      }
    ), /* @__PURE__ */ import_common8.React.createElement(
      TableRow,
      {
        label: "Track Updates",
        subLabel: "Song changes and RPC updates are logged"
      }
    ), /* @__PURE__ */ import_common8.React.createElement(
      TableRow,
      {
        label: "Error Details",
        subLabel: "Connection errors and retries are logged"
      }
    ))));
  }

  // src/ui/pages/Settings.tsx
  import_vendetta8.plugin.storage.username ??= "";
  import_vendetta8.plugin.storage.apiKey ??= "";
  import_vendetta8.plugin.storage.appName ??= "Music";
  import_vendetta8.plugin.storage.timeInterval ??= 5;
  import_vendetta8.plugin.storage.showTimestamp ??= true;
  import_vendetta8.plugin.storage.listeningTo ??= true;
  import_vendetta8.plugin.storage.verboseLogging ??= false;
  import_vendetta8.plugin.storage.service ??= "listenbrainz";
  import_vendetta8.plugin.storage.listenbrainzUsername ??= "";
  import_vendetta8.plugin.storage.listenbrainzToken ??= "";
  import_vendetta8.plugin.storage.addToSidebar ??= true;
  import_vendetta8.plugin.storage.showLargeText ??= true;
  import_vendetta8.plugin.storage.ignoreList ??= [];
  import_vendetta8.plugin.storage.showAlbumInTooltip ??= true;
  import_vendetta8.plugin.storage.showDurationInTooltip ??= true;
  var getStorage = (k, fallback) => import_vendetta8.plugin.storage[k] ?? fallback;
  var setStorage = (k, v) => import_vendetta8.plugin.storage[k] = v;
  var ServiceFactory2 = class {
    static getServiceDisplayName(service) {
      switch (service) {
        case "lastfm":
          return "Last.fm";
        case "listenbrainz":
          return "ListenBrainz";
        default:
          return "Unknown";
      }
    }
    static async testService(service) {
      try {
        switch (service) {
          case "lastfm":
            return await this.testLastFmConnection();
          case "listenbrainz":
            return await this.testListenBrainzConnection();
          default:
            return false;
        }
      } catch (error) {
        console.error(`Error testing ${service}:`, error);
        return false;
      }
    }
    static async testLastFmConnection() {
      const username = getStorage("username");
      const apiKey = getStorage("apiKey");
      if (!username || !apiKey) return false;
      try {
        const response = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${username}&api_key=${apiKey}&format=json`
        );
        const data = await response.json();
        return !data.error;
      } catch (error) {
        console.error("Last.fm connection test failed:", error);
        return false;
      }
    }
    static async testListenBrainzConnection() {
      const username = getStorage("listenbrainzUsername");
      const token = getStorage("listenbrainzToken");
      if (!username) return false;
      try {
        const headers = {
          "Content-Type": "application/json"
        };
        if (token) headers["Authorization"] = `Token ${token}`;
        const response = await fetch(
          `https://api.listenbrainz.org/1/user/${username}/listen-count`,
          { headers }
        );
        return response.status === 200;
      } catch (error) {
        console.error("ListenBrainz connection test failed:", error);
        return false;
      }
    }
  };
  var serviceFactory2 = ServiceFactory2;
  function Settings() {
    (0, import_storage8.useProxy)(import_vendetta8.plugin.storage);
    const navigation = import_common10.NavigationNative.useNavigation();
    const [, forceUpdate] = import_common9.React.useReducer((x) => x + 1, 0);
    const currentService = getStorage("service");
    const getCredentialStatus = (service) => {
      switch (service) {
        case "lastfm":
          return getStorage("username") && getStorage("apiKey") ? "Configured" : "Missing credentials";
        case "listenbrainz":
          return getStorage("listenbrainzUsername") ? "Configured" : "Missing username";
        default:
          return "Unknown";
      }
    };
    return /* @__PURE__ */ import_common9.React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 10 } }, /* @__PURE__ */ import_common9.React.createElement(Stack, { spacing: 8 }, /* @__PURE__ */ import_common9.React.createElement(TableRowGroup, { title: "Active Service" }, /* @__PURE__ */ import_common9.React.createElement(
      TableRow,
      {
        label: "Current Service",
        subLabel: currentService ? `Using: ${serviceFactory2.getServiceDisplayName(currentService)}` : "No service selected"
      }
    ), ["lastfm", "listenbrainz"].map(
      (service) => /* @__PURE__ */ import_common9.React.createElement(
        TableCheckboxRow,
        {
          key: service,
          label: serviceFactory2.getServiceDisplayName(service),
          subLabel: getCredentialStatus(service),
          checked: currentService === service,
          onPress: () => {
            if (service !== currentService) {
              setStorage("service", service);
              forceUpdate();
            }
          }
        }
      )
    )), /* @__PURE__ */ import_common9.React.createElement(TableRowGroup, { title: "Service Configuration" }, /* @__PURE__ */ import_common9.React.createElement(
      TableRow,
      {
        label: "Last.fm Settings",
        subLabel: "Configure Last.fm credentials and options",
        trailing: /* @__PURE__ */ import_common9.React.createElement(TableRow.Arrow, null),
        onPress: () => navigation.push("VendettaCustomPage", {
          title: "Last.fm Settings",
          render: LastFmSettingsPage
        })
      }
    ), /* @__PURE__ */ import_common9.React.createElement(
      TableRow,
      {
        label: "ListenBrainz Settings",
        subLabel: "Configure ListenBrainz credentials and options",
        trailing: /* @__PURE__ */ import_common9.React.createElement(TableRow.Arrow, null),
        onPress: () => navigation.push("VendettaCustomPage", {
          title: "ListenBrainz Settings",
          render: ListenBrainzSettingsPage
        })
      }
    )), /* @__PURE__ */ import_common9.React.createElement(TableRowGroup, { title: "Plugin Configuration" }, /* @__PURE__ */ import_common9.React.createElement(
      TableRow,
      {
        label: "Display Settings",
        subLabel: "Customize app name and update interval",
        trailing: /* @__PURE__ */ import_common9.React.createElement(TableRow.Arrow, null),
        onPress: () => navigation.push("VendettaCustomPage", {
          title: "Display Settings",
          render: DisplaySettingsPage
        })
      }
    ), /* @__PURE__ */ import_common9.React.createElement(
      TableRow,
      {
        label: "RPC Customization",
        subLabel: "Customize Discord rich presence display options",
        trailing: /* @__PURE__ */ import_common9.React.createElement(TableRow.Arrow, null),
        onPress: () => navigation.push("VendettaCustomPage", {
          title: "RPC Customization",
          render: RPCCustomizationSettingsPage
        })
      }
    ), /* @__PURE__ */ import_common9.React.createElement(
      TableRow,
      {
        label: "Ignore List",
        subLabel: "Configure apps that should hide your status",
        trailing: /* @__PURE__ */ import_common9.React.createElement(TableRow.Arrow, null),
        onPress: () => navigation.push("VendettaCustomPage", {
          title: "Ignore List Settings",
          render: IgnoreListSettingsPage
        })
      }
    ), /* @__PURE__ */ import_common9.React.createElement(
      TableRow,
      {
        label: "Logging Settings",
        subLabel: "Configure logging and debugging options",
        trailing: /* @__PURE__ */ import_common9.React.createElement(TableRow.Arrow, null),
        onPress: () => navigation.push("VendettaCustomPage", {
          title: "Logging Settings",
          render: LoggingSettingsPage
        })
      }
    ), /* @__PURE__ */ import_common9.React.createElement(
      TableSwitchRow,
      {
        label: "Add to Sidebar",
        subLabel: "Show plugin in Discord settings",
        value: getStorage("addToSidebar", false),
        onValueChange: (value) => {
          setStorage("addToSidebar", value);
          forceUpdate();
        }
      }
    )), /* @__PURE__ */ import_common9.React.createElement(TableRowGroup, { title: "About" }, /* @__PURE__ */ import_common9.React.createElement(
      TableRow,
      {
        label: "Multi Scrobbler",
        subLabel: "Show off your music status from multiple services"
      }
    ), /* @__PURE__ */ import_common9.React.createElement(TableRow, { label: "Author", subLabel: "kmmiio99o" }), /* @__PURE__ */ import_common9.React.createElement(TableRow, { label: "Version", subLabel: "1.3.2" }))));
  }

  // src/sidebar.tsx
  var import_vendetta9 = p;
  var import_common11 = r;
  var import_assets4 = re;
  var import_patcher = k;
  var import_components = R;
  var import_utils = Q;
  var import_metro3 = x;
  var import_vendetta10 = p;
  var { FormSection, FormRow } = import_components.Forms;
  var { TableRowIcon } = (0, import_metro3.findByProps)("TableRowIcon");
  var bunny = window.bunny;
  var tabsNavigationRef = bunny?.metro?.findByPropsLazy("getRootNavigationRef");
  var settingConstants = bunny?.metro?.findByPropsLazy(
    "SETTING_RENDERER_CONFIG"
  );
  var createListModule = bunny?.metro?.findByPropsLazy("createList");
  var SettingsOverviewScreen = bunny?.metro?.findByNameLazy(
    "SettingsOverviewScreen",
    false
  );
  function Section({ tabs }) {
    const navigation = import_common11.NavigationNative.useNavigation();
    return import_common11.React.createElement(FormRow, {
      label: tabs.title(),
      leading: import_common11.React.createElement(FormRow.Icon, { source: tabs.icon }),
      trailing: import_common11.React.createElement(import_common11.React.Fragment, {}, [
        tabs.trailing ? tabs.trailing() : null,
        import_common11.React.createElement(FormRow.Arrow, { key: "arrow" })
      ]),
      onPress: () => {
        const Component = tabs.page;
        navigation.navigate("VendettaCustomPage", {
          title: tabs.title(),
          render: () => import_common11.React.createElement(Component)
        });
      }
    });
  }
  function patchPanelUI(tabs, patches) {
    try {
      patches.push(
        (0, import_patcher.after)(
          "default",
          bunny?.metro?.findByPropsLazy(["renderTitle", "sections"], false),
          (_, ret) => {
            const UserSettingsOverview = (0, import_utils.findInReactTree)(
              ret.props.children,
              (n) => n.type?.name === "UserSettingsOverview"
            );
            if (UserSettingsOverview) {
              patches.push(
                (0, import_patcher.after)(
                  "render",
                  UserSettingsOverview.type.prototype,
                  (_args, res) => {
                    const sections = (0, import_utils.findInReactTree)(
                      res.props.children,
                      (n) => n?.children?.[1]?.type === FormSection
                    )?.children;
                    if (sections) {
                      const index = sections.findIndex(
                        (c) => ["BILLING_SETTINGS", "PREMIUM_SETTINGS"].includes(
                          c?.props?.label
                        )
                      );
                      sections.splice(
                        -~index || 4,
                        0,
                        import_common11.React.createElement(Section, { key: tabs.key, tabs })
                      );
                    }
                  }
                )
              );
            }
          },
          true
        )
      );
    } catch (error) {
      import_vendetta10.logger.info("Panel UI patch failed graciously \u{1F494}", error);
    }
  }
  function patchTabsUI(tabs, patches) {
    if (!settingConstants || !tabsNavigationRef) {
      console.warn("[RPC] Missing required constants for tabs UI patch");
      return;
    }
    const row = {
      [tabs.key]: {
        type: "pressable",
        useTitle: tabs.title,
        title: tabs.title,
        icon: tabs.icon,
        IconComponent: tabs.icon && (() => import_common11.React.createElement(TableRowIcon, { source: tabs.icon })),
        usePredicate: tabs.predicate,
        useTrailing: tabs.trailing,
        onPress: () => {
          const navigation = tabsNavigationRef.getRootNavigationRef();
          const Component = tabs.page;
          navigation.navigate("VendettaCustomPage", {
            title: tabs.title(),
            render: () => import_common11.React.createElement(Component)
          });
        },
        withArrow: true
      }
    };
    let rendererConfigValue = settingConstants.SETTING_RENDERER_CONFIG;
    Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
      enumerable: true,
      configurable: true,
      get: () => ({
        ...rendererConfigValue,
        ...row
      }),
      set: (v) => rendererConfigValue = v
    });
    const firstRender = /* @__PURE__ */ Symbol("pinToSettings meow meow");
    try {
      if (!createListModule) return;
      patches.push(
        (0, import_patcher.after)("createList", createListModule, function(args, ret) {
          if (!args[0][firstRender]) {
            args[0][firstRender] = true;
            const [config] = args;
            const sections = config.sections;
            const section = sections?.find(
              (x) => ["Bunny", "Revenge", "Kettu", "Vencore", "ShiggyCord"].some(
                (mod) => x.label === mod && x.title === mod
              )
            );
            if (section?.settings) {
              section.settings = [...section.settings, tabs.key];
            }
          }
        })
      );
    } catch {
      if (!SettingsOverviewScreen) return;
      patches.push(
        (0, import_patcher.after)("default", SettingsOverviewScreen, (args, ret) => {
          if (!args[0][firstRender]) {
            args[0][firstRender] = true;
            const { sections } = (0, import_utils.findInReactTree)(
              ret,
              (i) => i.props?.sections
            ).props;
            const section = sections?.find(
              (x) => ["Bunny", "Revenge", "Kettu", "Vencore", "ShiggyCord"].some(
                (mod) => x.label === mod && x.title === mod
              )
            );
            if (section?.settings) {
              section.settings = [...section.settings, tabs.key];
            }
          }
        })
      );
    }
  }
  function patchSettingsPin(tabs) {
    const patches = [];
    let disabled = false;
    const realPredicate = tabs.predicate || (() => true);
    tabs.predicate = () => disabled ? false : realPredicate();
    patchPanelUI(tabs, patches);
    patchTabsUI(tabs, patches);
    patches.push(() => disabled = true);
    return () => {
      for (const x of patches) {
        x();
      }
    };
  }
  function patchSidebar() {
    if (!import_vendetta9.plugin.storage.addToSidebar) {
      console.log("[RPC] Sidebar disabled in settings");
      return () => {
      };
    }
    console.log(
      "[RPC] Patching sidebar using custom patchSettingsPin..."
    );
    try {
      const unpatch = patchSettingsPin({
        key: "MultiScrobbler",
        icon: (0, import_assets4.getAssetIDByName)("MusicIcon"),
        title: () => "RPC",
        predicate: () => import_vendetta9.plugin.storage.addToSidebar === true,
        page: Settings
      });
      console.log("[RPC] Successfully patched sidebar");
      return unpatch;
    } catch (error) {
      console.error("[RPC] Failed to patch sidebar:", error);
      return () => {
      };
    }
  }

  // src/index.tsx
  var pluginState = {
    pluginStopped: false,
    lastActivity: void 0,
    updateInterval: void 0,
    lastTrackUrl: void 0
  };
  var sidebarUnpatch;
  var defaultSettings = constants_default.DEFAULT_SETTINGS;
  Object.keys(defaultSettings).forEach((key) => {
    import_vendetta11.plugin.storage[key] = import_vendetta11.plugin.storage[key] ?? defaultSettings[key];
  });
  import_vendetta11.plugin.storage.addToSidebar ??= false;
  var currentSettings = new Proxy(import_vendetta11.plugin.storage, {
    get(target, prop) {
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
  var connectionAttempts = 0;
  var MAX_CONNECTION_ATTEMPTS = 3;
  var RECONNECT_DELAY = 5e3;
  async function tryInitialize() {
    try {
      await initialize();
      connectionAttempts = 0;
      console.log("[RPC] Successfully connected");
    } catch (error) {
      console.error("[RPC] Initialization error:", error);
      connectionAttempts++;
      if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        console.log(
          `[RPC] Retrying connection... (attempt ${connectionAttempts})`
        );
        setTimeout(tryInitialize, RECONNECT_DELAY);
      } else {
        console.error(
          "[RPC] Failed to connect after multiple attempts"
        );
      }
    }
  }
  async function validateAndInitialize() {
    if (!currentSettings.service) {
      console.log("[RPC] No service selected. Please configure a service in settings.");
      return;
    }
    let serviceName = "Unknown";
    try {
      serviceName = serviceFactory.getCurrentService().getServiceName();
    } catch (e) {
      console.error("[RPC] Failed to determine current service name:", e);
    }
    const service = currentSettings.service;
    let hasCredentials = false;
    switch (service) {
      case "lastfm":
        hasCredentials = !!(currentSettings.username && currentSettings.apiKey);
        break;
      case "listenbrainz":
        hasCredentials = !!currentSettings.listenbrainzUsername;
        break;
    }
    if (!hasCredentials) {
      console.error(`[RPC] Missing credentials for ${serviceName}. Please configure in settings.`);
      return;
    }
    console.log(`[RPC] Starting with ${serviceName}...`);
    if (UserStore.getCurrentUser()) {
      tryInitialize();
    } else {
      const waitForUser = () => {
        if (UserStore.getCurrentUser()) {
          tryInitialize();
          import_common12.FluxDispatcher.unsubscribe("CONNECTION_OPEN", waitForUser);
        }
      };
      import_common12.FluxDispatcher.subscribe("CONNECTION_OPEN", waitForUser);
    }
  }
  var index_default = {
    onLoad() {
      console.log("[RPC] Loading...");
      pluginState.pluginStopped = false;
      if (currentSettings.addToSidebar !== false) {
        try {
          sidebarUnpatch = patchSidebar();
          console.log("[RPC] Sidebar patched successfully");
        } catch (error) {
          console.error("[RPC] Failed to patch sidebar:", error);
        }
      }
      validateAndInitialize();
    },
    onUnload() {
      console.log("[RPC] Unloading...");
      pluginState.pluginStopped = true;
      if (sidebarUnpatch) {
        try {
          sidebarUnpatch();
          sidebarUnpatch = void 0;
          console.log("[RPC] Sidebar unpatched");
        } catch (error) {
          console.error("[RPC] Failed to unpatch sidebar:", error);
        }
      }
      stop();
    },
    async onSettingsUpdate(newSettings) {
      const oldService = currentSettings.service;
      const newService = newSettings.service;
      const oldSidebar = currentSettings.addToSidebar;
      const newSidebar = newSettings.addToSidebar;
      Object.assign(currentSettings, newSettings);
      if (oldSidebar !== newSidebar) {
        if (newSidebar) {
          try {
            sidebarUnpatch = patchSidebar();
            console.log("[RPC] Sidebar enabled");
          } catch (error) {
            console.error("[RPC] Failed to enable sidebar:", error);
          }
        } else {
          if (sidebarUnpatch) {
            try {
              sidebarUnpatch();
            } catch (e) {
              console.error("[RPC] Failed to unpatch sidebar:", e);
            }
            sidebarUnpatch = void 0;
            console.log("[RPC] Sidebar disabled");
          }
        }
      }
      if (oldService !== newService && newService) {
        console.log(`[RPC] Service changed from ${oldService || "none"} to ${newService}`);
        try {
          await switchService(newService);
        } catch (e) {
          console.error("[RPC] Failed to switch service:", e);
        }
      } else if (!pluginState.pluginStopped && currentSettings.service) {
        tryInitialize();
      } else if (!currentSettings.service) {
        console.log("[RPC] Service unselected, stopping plugin...");
        try {
          stop();
        } catch (e) {
          console.error("[RPC] Error while stopping due to service unselected:", e);
        }
      }
    },
    onDiscordReconnect() {
      if (!pluginState.pluginStopped) {
        console.log("[RPC] Discord reconnected, reinitializing...");
        tryInitialize();
      }
    },
    settings: Settings
  };return Y.default=Y,Y})({},vendetta,vendetta.metro.common,vendetta.metro,window.React,vendetta.storage,vendetta.metro.common.ReactNative,vendetta.ui.toasts,vendetta.ui.assets,vendetta.patcher,vendetta.ui.components,vendetta.utils);