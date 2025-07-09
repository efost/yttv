"use client";

import RemoteControl from "@/components/RemoteControl";
import TVScreen, { TVScreenRef } from "@/components/TVScreen";
import { apiCache } from "@/lib/cache";
import { sampleVideos } from "@/lib/sample-videos";
import { VideoItem } from "@/types/youtube";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

// Enhanced history item type
interface HistoryItem {
  video: VideoItem;
  timestamp: number; // When this video was watched
  lastPosition: number; // Last known position in seconds
  completed: boolean; // Whether the video was watched to completion
  duration?: number; // Video duration if available
}

export default function Home() {
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [videoHistory, setVideoHistory] = useState<HistoryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [availableVideos, setAvailableVideos] = useState<VideoItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [usingSampleVideos, setUsingSampleVideos] = useState(false);
  const [shouldRestorePosition, setShouldRestorePosition] = useState(false);
  const [watchedVideoIds, setWatchedVideoIds] = useState<string[]>([]);
  const [_, setIsLoadingNextVideo] = useState(false);
  const [prefetchedVideo, setPrefetchedVideo] = useState<VideoItem | null>(
    null
  );
  const [hasPrefetched, setHasPrefetched] = useState(false);
  const [currentVideoStartTime, setCurrentVideoStartTime] = useState<number>(0);
  // Track forward history - videos that come after current position
  const [forwardHistory, setForwardHistory] = useState<VideoItem[]>([]);

  const { data: session, status } = useSession();
  const tvScreenRef = useRef<TVScreenRef | null>(null);

  // Initialize cache cleanup routine on mount
  useEffect(() => {
    apiCache.initCleanupRoutine();
  }, []);

  // Load current video from localStorage on mount
  useEffect(() => {
    const savedVideo = localStorage.getItem("yttv-current-video");
    if (savedVideo) {
      try {
        const video = JSON.parse(savedVideo);
        setCurrentVideo(video);
        setShouldRestorePosition(true);
      } catch (error) {
        // Silently handle video parsing errors
      }
    }

    // Load watched video IDs
    const savedWatchedIds = localStorage.getItem("yttv-watched-ids");
    if (savedWatchedIds) {
      try {
        const ids = JSON.parse(savedWatchedIds);
        setWatchedVideoIds(ids);
      } catch (error) {
        // Silently handle watched IDs parsing errors
      }
    }

    // Load enhanced video history
    const savedHistory = sessionStorage.getItem("yttv-video-history");
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setVideoHistory(history.videoHistory || []);
        setCurrentIndex(history.currentIndex || -1);
        setPrefetchedVideo(history.prefetchedVideo || null);
        setForwardHistory(history.forwardHistory || []);
      } catch (error) {
        // Silently handle video history parsing errors
      }
    }
  }, []);

  // Save current video to localStorage whenever it changes
  useEffect(() => {
    if (currentVideo) {
      localStorage.setItem("yttv-current-video", JSON.stringify(currentVideo));
    }
  }, [currentVideo]);

  // Save watched video IDs to localStorage
  useEffect(() => {
    localStorage.setItem("yttv-watched-ids", JSON.stringify(watchedVideoIds));
  }, [watchedVideoIds]);

  // Save enhanced video history to sessionStorage
  useEffect(() => {
    const history = {
      videoHistory,
      currentIndex,
      prefetchedVideo,
      forwardHistory,
      timestamp: Date.now(),
    };
    sessionStorage.setItem("yttv-video-history", JSON.stringify(history));
  }, [videoHistory, currentIndex, prefetchedVideo, forwardHistory]);

  // Enhanced position tracking - save more frequently and track completion
  useEffect(() => {
    if (!currentVideo) return;

    const savePosition = () => {
      if (tvScreenRef.current) {
        const currentTime = tvScreenRef.current.getCurrentTime();
        const playerState = tvScreenRef.current.getPlayerState();

        if (currentTime > 0) {
          // Save position to localStorage
          localStorage.setItem(
            `yttv-position-${currentVideo.id}`,
            currentTime.toString()
          );

          // Update history item with current position
          setVideoHistory((prev) => {
            const newHistory = [...prev];
            const currentHistoryIndex = newHistory.findIndex(
              (item) => item.video.id === currentVideo.id
            );

            if (currentHistoryIndex !== -1) {
              // Check if video is near completion (within 10 seconds of end)
              const isNearEnd =
                currentTime >=
                (newHistory[currentHistoryIndex].duration || 0) - 10;
              newHistory[currentHistoryIndex] = {
                ...newHistory[currentHistoryIndex],
                lastPosition: currentTime,
                completed: isNearEnd || playerState === 0, // 0 = ENDED
              };
            }

            return newHistory;
          });
        }
      }
    };

    const interval = setInterval(savePosition, 2000); // Save every 2 seconds
    return () => clearInterval(interval);
  }, [currentVideo]);

  // Smart prefetching: Monitor video progress and prefetch next video at 30 seconds
  useEffect(() => {
    if (!currentVideo || hasPrefetched || usingSampleVideos) return;

    const checkPrefetchTrigger = () => {
      if (tvScreenRef.current) {
        const currentTime = tvScreenRef.current.getCurrentTime();
        const playerState = tvScreenRef.current.getPlayerState();

        // Prefetch when video has been playing for 30 seconds
        if (currentTime >= 30 && playerState === 1 && !hasPrefetched) {
          // PlayerState.PLAYING = 1
          prefetchNextVideo();
        }
      }
    };

    const interval = setInterval(checkPrefetchTrigger, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, [currentVideo, hasPrefetched, usingSampleVideos]);

  // Reset prefetch state when video changes
  useEffect(() => {
    if (currentVideo) {
      setHasPrefetched(false);
      setPrefetchedVideo(null);
    }
  }, [currentVideo?.id]);

  // Enhanced position restoration with completion logic
  useEffect(() => {
    if (currentVideo && tvScreenRef.current && shouldRestorePosition) {
      const savedPosition = localStorage.getItem(
        `yttv-position-${currentVideo.id}`
      );

      // Check if this video exists in history
      const historyItem = videoHistory.find(
        (item) => item.video.id === currentVideo.id
      );

      if (historyItem) {
        if (historyItem.completed) {
          // If video was completed, start from a random position
          const randomStart = Math.floor(Math.random() * 200); // Random start within first 200 seconds
          setTimeout(() => {
            tvScreenRef.current?.seekTo(randomStart);
            setCurrentVideoStartTime(randomStart);
          }, 1000);
        } else {
          // If video wasn't completed, restore the last position
          const position =
            historyItem.lastPosition || parseFloat(savedPosition || "0");
          if (position > 10) {
            setTimeout(() => {
              tvScreenRef.current?.seekTo(position);
              setCurrentVideoStartTime(position);
            }, 1000);
          }
        }
      } else if (savedPosition) {
        // Fallback to localStorage position
        const position = parseFloat(savedPosition);
        if (position > 10) {
          setTimeout(() => {
            tvScreenRef.current?.seekTo(position);
            setCurrentVideoStartTime(position);
          }, 1000);
        }
      }

      setShouldRestorePosition(false);
    }
  }, [currentVideo, shouldRestorePosition, videoHistory]);

  // Fetch next video from API
  const fetchNextVideo = async (): Promise<VideoItem | null> => {
    if (usingSampleVideos) {
      // Get recently watched videos (last 3) to avoid immediate repeats
      const recentWatched = watchedVideoIds.slice(-3);

      // Filter out recently watched videos and current video
      const excludedIds = [...recentWatched];
      if (currentVideo) {
        excludedIds.push(currentVideo.id);
      }
      if (prefetchedVideo) {
        excludedIds.push(prefetchedVideo.id);
      }

      const availableVideos = sampleVideos.filter(
        (video) => !excludedIds.includes(video.id)
      );

      // If we've watched most videos, reset the exclusion list but keep current video excluded
      const videosToChooseFrom =
        availableVideos.length > 0
          ? availableVideos
          : sampleVideos.filter((video) => video.id !== currentVideo?.id);

      // Use weighted randomization to favor unwatched videos
      const unwatchedVideos = videosToChooseFrom.filter(
        (video) => !watchedVideoIds.includes(video.id)
      );

      // 70% chance to pick from unwatched, 30% chance to pick from all available
      const shouldPickUnwatched =
        Math.random() < 0.7 && unwatchedVideos.length > 0;
      const finalCandidates = shouldPickUnwatched
        ? unwatchedVideos
        : videosToChooseFrom;

      const randomIndex = Math.floor(Math.random() * finalCandidates.length);
      return finalCandidates[randomIndex];
    }

    try {
      const excludeIds = [...watchedVideoIds];
      if (currentVideo) {
        excludeIds.push(currentVideo.id);
      }
      if (prefetchedVideo) {
        excludeIds.push(prefetchedVideo.id);
      }

      const excludeParams =
        excludeIds.length > 0 ? `?exclude=${excludeIds.join(",")}` : "";
      const response = await fetch(`/api/youtube/next-video${excludeParams}`);
      const data = await response.json();

      if (response.ok && data.video) {
        return data.video;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  // Prefetch next video in background
  const prefetchNextVideo = async () => {
    if (hasPrefetched || prefetchedVideo) return;

    try {
      const nextVideo = await fetchNextVideo();
      if (nextVideo) {
        setPrefetchedVideo(nextVideo);
        setHasPrefetched(true);
      }
    } catch (error) {
      //
    }
  };

  const handleChannelUp = async () => {
    setIsLoadingNextVideo(true);

    try {
      if (currentVideo) {
        // Add current video to history with completion status
        const currentTime = tvScreenRef.current?.getCurrentTime() || 0;
        const playerState = tvScreenRef.current?.getPlayerState() || 0;
        const isCompleted =
          playerState === 0 ||
          currentTime >=
            (currentVideo.duration ? parseDuration(currentVideo.duration) : 0) -
              10;

        const historyItem: HistoryItem = {
          video: currentVideo,
          timestamp: Date.now(),
          lastPosition: currentTime,
          completed: isCompleted,
          duration: currentVideo.duration
            ? parseDuration(currentVideo.duration)
            : undefined,
        };

        const newHistory = [...videoHistory, historyItem];
        setVideoHistory(newHistory);
        setCurrentIndex(newHistory.length);

        // Add current video to watched list
        if (!watchedVideoIds.includes(currentVideo.id)) {
          setWatchedVideoIds((prev) => [...prev, currentVideo.id]);
        }
      }

      // Check if we have a forward history to continue from
      let nextVideo: VideoItem | null = null;

      if (forwardHistory.length > 0) {
        // Continue from forward history
        nextVideo = forwardHistory[0];
        setForwardHistory((prev) => prev.slice(1)); // Remove the video we're about to show
      } else if (
        prefetchedVideo &&
        !watchedVideoIds.includes(prefetchedVideo.id)
      ) {
        // Use prefetched video if available
        nextVideo = prefetchedVideo;
        setPrefetchedVideo(null);
      } else {
        // Fetch new video
        nextVideo = await fetchNextVideo();
      }

      if (nextVideo) {
        setCurrentVideo(nextVideo);
        setShouldRestorePosition(false);
        setCurrentVideoStartTime(0);
      } else {
        //
      }
    } catch (error) {
      //
    } finally {
      setIsLoadingNextVideo(false);
    }
  };

  const handleChannelDown = () => {
    if (currentIndex > 0) {
      const previousHistoryItem = videoHistory[currentIndex - 1];

      // Add current video to forward history if it exists
      if (currentVideo) {
        setForwardHistory((prev) => [currentVideo, ...prev]);
      }

      setCurrentVideo(previousHistoryItem.video);
      setCurrentIndex(currentIndex - 1);
      setShouldRestorePosition(true);
      setCurrentVideoStartTime(previousHistoryItem.lastPosition);
    }
  };

  // Helper function to parse YouTube duration format
  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1]?.replace("H", "") || "0");
    const minutes = parseInt(match[2]?.replace("M", "") || "0");
    const seconds = parseInt(match[3]?.replace("S", "") || "0");

    return hours * 3600 + minutes * 60 + seconds;
  };

  const handlePlayPause = () => {
    if (tvScreenRef.current) {
      const isCurrentlyPlaying = tvScreenRef.current.isPlaying();
      if (isCurrentlyPlaying) {
        tvScreenRef.current.pauseVideo();
      } else {
        tvScreenRef.current.playVideo();
      }
    }
  };

  const handleMute = () => {
    if (tvScreenRef.current) {
      if (tvScreenRef.current.isMuted()) {
        tvScreenRef.current.unMute();
      } else {
        tvScreenRef.current.mute();
      }
    }
  };

  const handleFastForward = () => {
    if (tvScreenRef.current) {
      const currentTime = tvScreenRef.current.getCurrentTime();
      tvScreenRef.current.seekTo(currentTime + 10);
    }
  };

  const handleRewind = () => {
    if (tvScreenRef.current) {
      const currentTime = tvScreenRef.current.getCurrentTime();
      tvScreenRef.current.seekTo(currentTime - 10);
    }
  };

  const handleThumbsUp = async () => {
    if (!currentVideo) return;
    try {
      await fetch("/api/youtube/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: currentVideo.id }),
      });
    } catch (error) {
      //
    }
  };

  const handleThumbsDown = async () => {
    if (!currentVideo) return;
    try {
      await fetch("/api/youtube/dislike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: currentVideo.id }),
      });
    } catch (error) {
      //
    }
  };

  const handleStateChange = (newIsPlaying: boolean, newIsMuted: boolean) => {
    setIsPlaying(newIsPlaying);
    setIsMuted(newIsMuted);
  };

  const handleCaptionToggle = () => {
    if (tvScreenRef.current) {
      tvScreenRef.current.toggleCaptions();
      // Update local state
      const newCaptionsEnabled = tvScreenRef.current.getCaptionsEnabled();
      setCaptionsEnabled(newCaptionsEnabled);
    }
  };

  // Initial video loading
  useEffect(() => {
    const loadInitialVideo = async () => {
      setIsLoading(true);
      let quotaError = false;

      if (status === "authenticated") {
        try {
          // Try to load initial data to warm the cache
          const [feedResponse, subscriptionsResponse] = await Promise.all([
            fetch("/api/youtube/feed"),
            fetch("/api/youtube/subscriptions"),
          ]);

          if (!feedResponse.ok || !subscriptionsResponse.ok) {
            quotaError = true;
          }
        } catch (error) {
          //
          quotaError = true;
        }
      }

      if (quotaError) {
        // Only show quota exceeded message when there's an actual API error
        setUsingSampleVideos(true);
        if (!currentVideo) {
          const randomIndex = Math.floor(Math.random() * sampleVideos.length);
          setCurrentVideo(sampleVideos[randomIndex]);
          setShouldRestorePosition(false);
        }
      } else if (status === "unauthenticated") {
        // When not authenticated, use sample videos but don't show quota message
        setUsingSampleVideos(true);
        if (!currentVideo) {
          const randomIndex = Math.floor(Math.random() * sampleVideos.length);
          setCurrentVideo(sampleVideos[randomIndex]);
          setShouldRestorePosition(false);
        }
      } else {
        setUsingSampleVideos(false);
        if (!currentVideo) {
          const initialVideo = await fetchNextVideo();
          if (initialVideo) {
            setCurrentVideo(initialVideo);
            setShouldRestorePosition(false);
          }
        }
      }

      setIsLoading(false);
    };

    if (status !== "loading") {
      loadInitialVideo();
    }
  }, [status, session]);

  return (
    <main className="min-h-screen bg-tv-black p-4 flex items-center justify-center relative overflow-hidden">
      {/* Logo Background */}
      {/* <div className="absolute inset-0 flex items-start  justify-center pointer-events-none z-10">
        <div
          className="text-white font-tv text-[200px] leading-none select-none tracking-tight"
          style={{
            background:
              "linear-gradient(to top, transparent 0%, #020202 10%, white 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "blur(0.5px)",
          }}
        >
          VibeTV
        </div>
      </div> */}

      <div className="w-full max-w-6xl relative z-20">
        <div className="flex justify-between items-center mb-4">
          {usingSampleVideos && status === "authenticated" && (
            <div className="text-yellow-300 py-2 rounded-lg backdrop-blur-sm text-xs">
              <span className="text-xs pr-1">⚠️</span> YouTube API Quota
              Exceeded - Using sample videos
            </div>
          )}
          {/* {isLoadingNextVideo && (
            <div className="bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 text-blue-300 px-4 py-2 rounded-lg backdrop-blur-sm">
              <span className="text-sm">📺</span> Loading next video...
            </div>
          )}
          {prefetchedVideo && !usingSampleVideos && (
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-300 px-4 py-2 rounded-lg backdrop-blur-sm">
              <span className="text-sm">⚡</span> Next video ready
            </div>
          )} */}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* TV Screen */}
          <div className="flex-1">
            <TVScreen
              ref={tvScreenRef}
              currentVideo={currentVideo}
              isLoading={isLoading}
              onStateChange={handleStateChange}
            />
          </div>

          {/* Remote Control */}
          <div className="lg:w-80">
            <RemoteControl
              onChannelUp={handleChannelUp}
              onChannelDown={handleChannelDown}
              currentVideo={currentVideo}
              onPlayPause={handlePlayPause}
              onMute={handleMute}
              onFastForward={handleFastForward}
              onRewind={handleRewind}
              onThumbsUp={handleThumbsUp}
              onThumbsDown={handleThumbsDown}
              onCaptionToggle={handleCaptionToggle}
              isPlaying={isPlaying}
              isMuted={isMuted}
              captionsEnabled={captionsEnabled}
              usingSampleVideos={usingSampleVideos}
              videoHistory={videoHistory}
              currentIndex={currentIndex}
              isAuthenticated={status === "authenticated"}
              onSignIn={() => signIn("google")}
              onSignOut={() => signOut()}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
