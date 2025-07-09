"use client";

import RemoteControl from "@/components/RemoteControl";
import TVScreen, { TVScreenRef } from "@/components/TVScreen";
import { apiCache } from "@/lib/cache";
import { sampleVideos } from "@/lib/sample-videos";
import { VideoItem } from "@/types/youtube";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [videoHistory, setVideoHistory] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [availableVideos, setAvailableVideos] = useState<VideoItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [usingSampleVideos, setUsingSampleVideos] = useState(false);
  const [shouldRestorePosition, setShouldRestorePosition] = useState(false);
  const [watchedVideoIds, setWatchedVideoIds] = useState<string[]>([]);
  const [isLoadingNextVideo, setIsLoadingNextVideo] = useState(false);
  const [prefetchedVideo, setPrefetchedVideo] = useState<VideoItem | null>(
    null
  );
  const [hasPrefetched, setHasPrefetched] = useState(false);

  const { data: session, status } = useSession();
  const tvScreenRef = useRef<TVScreenRef | null>(null);
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Load session video queue
    const savedQueue = sessionStorage.getItem("yttv-video-queue");
    if (savedQueue) {
      try {
        const queue = JSON.parse(savedQueue);
        setVideoHistory(queue.videoHistory || []);
        setCurrentIndex(queue.currentIndex || -1);
        setPrefetchedVideo(queue.prefetchedVideo || null);
      } catch (error) {
        // Silently handle video queue parsing errors
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

  // Save video queue to sessionStorage
  useEffect(() => {
    const queue = {
      videoHistory,
      currentIndex,
      prefetchedVideo,
      timestamp: Date.now(),
    };
    sessionStorage.setItem("yttv-video-queue", JSON.stringify(queue));
  }, [videoHistory, currentIndex, prefetchedVideo]);

  // Save video position periodically
  useEffect(() => {
    if (!currentVideo) return;

    const savePosition = () => {
      if (tvScreenRef.current) {
        const currentTime = tvScreenRef.current.getCurrentTime();
        if (currentTime > 0) {
          localStorage.setItem(
            `yttv-position-${currentVideo.id}`,
            currentTime.toString()
          );
        }
      }
    };

    const interval = setInterval(savePosition, 5000); // Save every 5 seconds
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

  // Restore video position when video changes
  useEffect(() => {
    if (currentVideo && tvScreenRef.current && shouldRestorePosition) {
      const savedPosition = localStorage.getItem(
        `yttv-position-${currentVideo.id}`
      );
      if (savedPosition) {
        const position = parseFloat(savedPosition);
        if (position > 10) {
          setTimeout(() => {
            tvScreenRef.current?.seekTo(position);
          }, 1000); // Wait for player to be ready
        }
      }
      setShouldRestorePosition(false);
    }
  }, [currentVideo, shouldRestorePosition]);

  // Fetch next video from API
  const fetchNextVideo = async (): Promise<VideoItem | null> => {
    if (usingSampleVideos) {
      // For sample videos, just pick a random one
      const availableUnwatched = sampleVideos.filter(
        (video) => !watchedVideoIds.includes(video.id)
      );
      const videosToChooseFrom =
        availableUnwatched.length > 0 ? availableUnwatched : sampleVideos;
      const randomIndex = Math.floor(Math.random() * videosToChooseFrom.length);
      return videosToChooseFrom[randomIndex];
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
        const newHistory = [...videoHistory, currentVideo];
        setVideoHistory(newHistory);
        setCurrentIndex(newHistory.length);

        // Add current video to watched list
        if (!watchedVideoIds.includes(currentVideo.id)) {
          setWatchedVideoIds((prev) => [...prev, currentVideo.id]);
        }
      }

      // Use prefetched video if available, otherwise fetch new one
      let nextVideo: VideoItem | null = null;

      if (prefetchedVideo && !watchedVideoIds.includes(prefetchedVideo.id)) {
        nextVideo = prefetchedVideo;
        setPrefetchedVideo(null); // Clear the prefetched video
      } else {
        nextVideo = await fetchNextVideo();
      }

      if (nextVideo) {
        setCurrentVideo(nextVideo);
        setShouldRestorePosition(false);
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
      const previousVideo = videoHistory[currentIndex - 1];
      setCurrentVideo(previousVideo);
      setCurrentIndex(currentIndex - 1);
      setShouldRestorePosition(true);
    }
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
