export type ServiceType = "lastfm" | "listenbrainz";

export interface Track {
    name: string;
    artist: string;
    album: string;
    albumArt: string | null;
    url: string;
    date: string;
    nowPlaying: boolean;
    loved: boolean;
    from: number;
    to: number | null;
    duration: number | null;
}

export interface Activity {
    name: string;
    type: number;
    details?: string;
    state?: string;
    status_display_type?: number;
    application_id?: string;
    flags?: number;
    timestamps?: {
        start?: number;
        end?: number;
    };
    assets?: {
        large_image?: string;
        large_text?: string;
        small_image?: string;
        small_text?: string;
    };
}

export interface ServiceClient {
    fetchLatestScrobble(): Promise<Track>;
    validateCredentials(): Promise<boolean>;
    getServiceName(): string;
}

export interface ServiceConfig {
    name: string;
    baseUrl: string;
    requiresApiKey: boolean;
    requiresToken: boolean;
}

export interface LFMSettings {
    username: string;
    apiKey: string;
    appName: string;
    timeInterval: number;
    showTimestamp: boolean;
    listeningTo: boolean;
    showLargeText: boolean;
    ignoreYouTubeMusic: boolean;
    verboseLogging: boolean;
    service: ServiceType | undefined;
    listenbrainzUsername: string;
    listenbrainzToken: string;
}
