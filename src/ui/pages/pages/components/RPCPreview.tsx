import { React, ReactNative as RN } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { plugin } from "@vendetta";
import { getStorage } from "../../Settings";

export default function RPCPreview() {
    useProxy(plugin.storage);
    const [previewTrack, setPreviewTrack] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [currentProgress, setCurrentProgress] = React.useState(0);

    const fallbackTrack = {
        name: "Bohemian Rhapsody",
        artist: "Queen",
        album: "A Night at the Opera",
        image: null,
        nowPlaying: true,
        duration: 354,
        startTime: Math.floor(Date.now() / 1000) - 120,
    };

    React.useEffect(() => {
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
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                };
                if (token) headers["Authorization"] = `Token ${token}`;

                // Try playing now first
                let trackData: any = null;
                try {
                    const playingNowRes = await fetch(
                        `https://api.listenbrainz.org/1/user/${encodeURIComponent(username)}/playing-now`,
                        { headers },
                    );
                    const playingNowData = await playingNowRes.json();
                    const listens =
            playingNowData?.listens ||
            playingNowData?.payload?.listens ||
            playingNowData?.data?.listens;
                    if (listens && listens.length > 0) {
                        trackData = listens[0];
                        trackData.playing_now = true;
                    }
                } catch (e) {
                    // ignore
                }

                // Fallback to recent listens
                if (!trackData) {
                    const recentRes = await fetch(
                        `https://api.listenbrainz.org/1/user/${encodeURIComponent(username)}/listens?count=1`,
                        { headers },
                    );
                    const recentData = await recentRes.json();
                    const listens =
            recentData?.listens ||
            recentData?.payload?.listens ||
            recentData?.data?.listens;
                    if (listens && listens.length > 0) {
                        trackData = listens[0];
                    }
                }

                if (trackData) {
                    const meta = trackData.track_metadata;
                    const duration = meta.additional_info?.duration_ms
                        ? Math.floor(meta.additional_info.duration_ms / 1000)
                        : 180;

                    let image: string | null = null;
                    if (meta.additional_info?.release_mbid) {
                        try {
                            const coverUrl = `https://coverartarchive.org/release/${meta.additional_info.release_mbid}/front`;
                            const coverRes = await fetch(coverUrl, {
                                method: "HEAD",
                                redirect: "follow",
                            });
                            if (coverRes.ok) image = coverUrl;
                        } catch (e) {
                            // ignore
                        }
                    }

                    setPreviewTrack({
                        name: meta.track_name || "Unknown Track",
                        artist: meta.artist_name || "Unknown Artist",
                        album: meta.release_name || "",
                        image,
                        nowPlaying: Boolean(trackData.playing_now),
                        duration,
                        startTime: trackData.playing_now
                            ? Math.floor(Date.now() / 1000) - 60
                            : null,
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

    React.useEffect(() => {
        if (!previewTrack?.nowPlaying || !previewTrack.duration) {
            return;
        }

        const interval = setInterval(() => {
            if (previewTrack.startTime && previewTrack.duration) {
                const now = Math.floor(Date.now() / 1000);
                const elapsed = now - previewTrack.startTime;
                const progress = Math.min(elapsed / previewTrack.duration, 1);
                setCurrentProgress(progress);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [previewTrack]);

    const formatTime = (seconds: number) => {
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
                progress: currentProgress,
            };
        } else {
            return {
                current: previewTrack.duration * 0.3,
                total: previewTrack.duration,
                progress: 0.3,
            };
        }
    };

    const activityType = getStorage("listeningTo") ? "Listening to" : "Playing";
    const appName = getStorage("appName") || "Music";
    const showLargeText = getStorage("showLargeText", true);
    const showTimestamp = getStorage("showTimestamp", false);
    const hasDuration = Boolean(previewTrack?.duration);

    if (isLoading) {
        return (
            <RN.View style={styles.container}>
                <RN.View style={styles.loadingContent}>
                    <RN.View style={styles.loadingSpinner} />
                    <RN.Text style={styles.loadingText}>Loading preview...</RN.Text>
                </RN.View>
            </RN.View>
        );
    }

    if (!previewTrack) {
        return (
            <RN.View style={styles.container}>
                <RN.Text style={styles.centeredText}>Unable to load preview</RN.Text>
            </RN.View>
        );
    }

    const progressData = getCurrentProgressData();
    const previewText = getPreviewText();

    return (
        <RN.View style={styles.previewContainer}>
            <RN.View style={styles.header}>
                <RN.Text style={styles.activityType}>
                    {activityType} {appName}
                </RN.Text>
                <RN.Text style={styles.rpcPreviewText} numberOfLines={1}>
          RPC Preview
                </RN.Text>
            </RN.View>

            <RN.View style={styles.content}>
                {previewTrack.image ? (
                    <RN.View style={styles.albumArt}>
                        <RN.Image
                            source={{ uri: previewTrack.image }}
                            style={styles.albumImage}
                            resizeMode="cover"
                        />
                    </RN.View>
                ) : null}

                <RN.View style={styles.trackInfo}>
                    <RN.Text style={styles.trackName} numberOfLines={1}>
                        {previewTrack.name}
                    </RN.Text>
                    <RN.Text style={styles.artistName} numberOfLines={1}>
                        {previewTrack.artist}
                    </RN.Text>
                    {showLargeText && previewText && (
                        <RN.Text style={styles.tooltipText} numberOfLines={1}>
                            {previewText}
                        </RN.Text>
                    )}

                    {showTimestamp && hasDuration ? (
                        <RN.View style={styles.progressContainer}>
                            <RN.Text style={styles.timeText}>
                                {formatTime(progressData.current)}
                            </RN.Text>
                            <RN.View style={styles.progressBar}>
                                <RN.View
                                    style={[
                                        styles.progressFill,
                                        { width: `${progressData.progress * 100}%` },
                                    ]}
                                />
                            </RN.View>
                            <RN.Text style={styles.timeText}>
                                {formatTime(progressData.total)}
                            </RN.Text>
                        </RN.View>
                    ) : null}
                </RN.View>
            </RN.View>
        </RN.View>
    );
}

const styles = RN.StyleSheet.create({
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
        minHeight: 120,
    },
    loadingContent: {
        alignItems: "center",
        justifyContent: "center",
    },
    loadingSpinner: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: "#5865f2",
        borderTopColor: "transparent",
        marginBottom: 8,
    },
    previewContainer: {
        backgroundColor: "#1e1f22",
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#3a3c41",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        gap: 8,
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
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
        flexShrink: 0,
    },
    trackInfo: {
        flex: 1,
        minWidth: 0,
    },
    progressContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 6,
    },
    progressBar: {
        flex: 1,
        height: 2,
        backgroundColor: "#2b2d31",
        borderRadius: 3,
        overflow: "hidden",
    },
    progressFill: {
        height: 2,
        backgroundColor: "#5865f2",
        borderRadius: 3,
    },
    loadingText: {
        color: "#949ba4",
        fontSize: 14,
        fontWeight: "500",
    },
    centeredText: {
        color: "#949ba4",
        fontSize: 14,
        fontWeight: "500",
        textAlign: "center",
    },
    activityType: {
        color: "#dbdee1",
        fontSize: 14,
        fontWeight: "600",
        flex: 1,
    },
    rpcPreviewText: {
        color: "#80848e",
        fontSize: 12,
        fontStyle: "italic",
        flexShrink: 0,
    },
    albumImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
    },
    trackName: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 4,
    },
    artistName: {
        color: "#b5bac1",
        fontSize: 14,
        fontWeight: "500",
        marginBottom: 4,
    },
    tooltipText: {
        color: "#80848e",
        fontSize: 12,
        fontStyle: "italic",
        marginBottom: 6,
    },
    timeText: {
        color: "#80848e",
        fontSize: 11,
        fontWeight: "500",
        minWidth: 35,
        textAlign: "center",
    },
});
