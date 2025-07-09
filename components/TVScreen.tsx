"use client";

import { decodeHtmlEntities } from "@/lib/utils";
import { VideoItem } from "@/types/youtube";
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// Type declaration for YouTube API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// YouTube player event types
interface YouTubePlayerEvent {
  data: number;
  target: any;
}

export interface TVScreenProps {
  currentVideo: VideoItem | null;
  isLoading: boolean;
  onStateChange?: (isPlaying: boolean, isMuted: boolean) => void;
}

export interface TVScreenRef {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  isMuted: () => boolean;
  isPlaying: () => boolean;
  toggleCaptions: () => void;
  getCaptionsEnabled: () => boolean;
}

const TVScreen = memo(
  forwardRef<TVScreenRef, TVScreenProps>(
    ({ currentVideo, isLoading, onStateChange }, ref) => {
      const playerRef = useRef<any>(null);
      const [isMuted, setIsMuted] = useState(false);
      const [isPlaying, setIsPlaying] = useState(false);
      const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
      const [captionsEnabled, setCaptionsEnabled] = useState(false);
      const [currentTime, setCurrentTime] = useState(0);
      const [showStatic, setShowStatic] = useState(false);
      const audioContextRef = useRef<AudioContext | null>(null);
      const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
      const gainNodeRef = useRef<GainNode | null>(null);
      const timeTrackingRef = useRef<NodeJS.Timeout | null>(null);
      const randomStartTimeRef = useRef<number>(0);
      const [isApiReady, setIsApiReady] = useState(false);
      const [playerReady, setPlayerReady] = useState(false);
      // Use a stable id for the YouTube player element to keep markup consistent across renders / reloads
      const playerElementId = useRef("youtube-player");

      // Load YouTube IFrame Player API
      useEffect(() => {
        if (window.YT && window.YT.Player) {
          setIsApiReady(true);
          return;
        }

        window.onYouTubeIframeAPIReady = () => {
          setIsApiReady(true);
        };

        if (
          document.querySelector(
            'script[src="https://www.youtube.com/iframe_api"]'
          )
        ) {
          return;
        }

        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }, []);

      // Initialize audio context on first user interaction
      const initializeAudio = async () => {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
          // Resume immediately to handle autoplay restrictions
          if (audioContextRef.current.state === "suspended") {
            await audioContextRef.current.resume();
          }
        }
      };

      // Create white noise audio
      const createWhiteNoise = () => {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        }

        const audioContext = audioContextRef.current;
        const bufferSize = 2 * audioContext.sampleRate; // 2 seconds of audio for looping
        const buffer = audioContext.createBuffer(
          1,
          bufferSize,
          audioContext.sampleRate
        );
        const output = buffer.getChannelData(0);

        // Generate white noise
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1; // Random values between -1 and 1
        }

        return buffer;
      };

      // Imperative handle
      useImperativeHandle(ref, () => ({
        playVideo: () => {
          if (
            playerReady &&
            typeof playerRef.current?.playVideo === "function"
          ) {
            playerRef.current.playVideo();
            // Update state immediately
            setIsPlaying(true);
            if (onStateChange) {
              onStateChange(true, playerRef.current.isMuted());
            }
          }
        },
        pauseVideo: () => {
          if (
            playerReady &&
            typeof playerRef.current?.pauseVideo === "function"
          ) {
            playerRef.current.pauseVideo();
            // Update state immediately
            setIsPlaying(false);
            if (onStateChange) {
              onStateChange(false, playerRef.current.isMuted());
            }
          }
        },
        mute: () => {
          if (playerReady && typeof playerRef.current?.mute === "function") {
            playerRef.current.mute();
            // Update state immediately
            setIsMuted(true);
            if (onStateChange) {
              onStateChange(
                playerRef.current.getPlayerState() ===
                  window.YT.PlayerState.PLAYING,
                true
              );
            }
          }
        },
        unMute: () => {
          if (playerReady && typeof playerRef.current?.unMute === "function") {
            playerRef.current.unMute();
            // Update state immediately
            setIsMuted(false);
            if (onStateChange) {
              onStateChange(
                playerRef.current.getPlayerState() ===
                  window.YT.PlayerState.PLAYING,
                false
              );
            }
          }
        },
        seekTo: (seconds: number) => {
          if (playerReady && typeof playerRef.current?.seekTo === "function") {
            playerRef.current.seekTo(seconds, true);
          }
          setCurrentTime(seconds);
        },
        getCurrentTime: () => {
          if (
            playerReady &&
            typeof playerRef.current?.getCurrentTime === "function"
          ) {
            return playerRef.current.getCurrentTime();
          }
          return currentTime;
        },
        getPlayerState: () => {
          if (
            playerReady &&
            typeof playerRef.current?.getPlayerState === "function"
          ) {
            return playerRef.current.getPlayerState();
          }
          return -1;
        },
        isMuted: () => {
          if (playerReady && typeof playerRef.current?.isMuted === "function") {
            return playerRef.current.isMuted();
          }
          return isMuted;
        },
        isPlaying: () => {
          if (
            playerReady &&
            typeof playerRef.current?.getPlayerState === "function"
          ) {
            return playerRef.current.getPlayerState() === 1;
          }
          return false;
        },
        toggleCaptions: () => {
          if (playerReady && playerRef.current) {
            try {
              // Load captions module if not already loaded
              playerRef.current.loadModule("captions");

              // Wait a bit for module to load, then check options
              setTimeout(() => {
                try {
                  // Get available tracks
                  const availableTracks =
                    playerRef.current.getOption("captions", "tracklist") || [];

                  // Use internal state instead of trying to detect from API
                  // (API keeps returning the same track object even when captions are off)

                  if (captionsEnabled) {
                    // Captions are on, turn them off
                    // Try multiple methods to ensure captions are turned off
                    try {
                      playerRef.current.setOption("captions", "track", {});
                    } catch (e) {
                      // Method 1 failed, continue to next method
                    }

                    try {
                      playerRef.current.setOption("captions", "track", null);
                    } catch (e) {
                      // Method 2 failed, continue to next method
                    }

                    try {
                      playerRef.current.setOption("captions", "reload", true);
                    } catch (e) {
                      // Method 3 failed, continue to next method
                    }

                    try {
                      playerRef.current.setOption("cc", "track", {});
                    } catch (e) {
                      // Method 4 failed, but that's okay
                    }
                    setCaptionsEnabled(false);
                    // Notify parent component
                    if (onStateChange) {
                      onStateChange(
                        playerRef.current.getPlayerState() ===
                          window.YT.PlayerState.PLAYING,
                        playerRef.current.isMuted()
                      );
                    }
                  } else {
                    // Captions are off, turn them on with first available track
                    if (availableTracks.length > 0) {
                      try {
                        playerRef.current.setOption(
                          "captions",
                          "track",
                          availableTracks[0]
                        );
                      } catch (e) {
                        // Method 1 failed, continue to next method
                      }

                      try {
                        playerRef.current.setOption("captions", "reload", true);
                      } catch (e) {
                        // Method 2 failed, continue to next method
                      }

                      try {
                        playerRef.current.setOption(
                          "cc",
                          "track",
                          availableTracks[0]
                        );
                      } catch (e) {
                        // Method 3 failed, continue to next method
                      }

                      try {
                        playerRef.current.setOption("captions", "fontSize", 0);
                      } catch (e) {
                        // Method 4 failed, but that's okay
                      }
                      setCaptionsEnabled(true);
                      // Notify parent component
                      if (onStateChange) {
                        onStateChange(
                          playerRef.current.getPlayerState() ===
                            window.YT.PlayerState.PLAYING,
                          playerRef.current.isMuted()
                        );
                      }
                    } else {
                      // No caption tracks available for this video
                    }
                  }
                } catch (innerError) {
                  // Error in caption toggle inner function
                }
              }, 200);
            } catch (error) {
              // Error toggling captions
            }
          } else {
            // Player not ready or not available
          }
        },
        getCaptionsEnabled: () => {
          return captionsEnabled;
        },
      }));

      // Create or update YouTube player
      useLayoutEffect(() => {
        if (!currentVideo || !isApiReady) return;

        if (currentVideo.id !== currentVideoId) {
          setCurrentVideoId(currentVideo.id);

          const videoIdHash = currentVideo.id.split("").reduce((a, b) => {
            a = (a << 5) - a + b.charCodeAt(0);
            return a & a;
          }, 0);
          const startTime = Math.abs(videoIdHash) % 200;
          randomStartTimeRef.current = startTime;
          setCurrentTime(startTime);

          // Clean up existing player first
          if (playerRef.current) {
            try {
              playerRef.current.destroy();
            } catch (error) {
              // Silently handle player destruction errors
            }
            playerRef.current = null;
            setPlayerReady(false);
          }

          // Show static and play white noise only if we have user interaction
          if (document.hasFocus()) {
            setShowStatic(true);
            playWhiteNoise();

            setTimeout(() => {
              setShowStatic(false);
              stopWhiteNoise();
            }, 300);
          }

          setTimeout(() => {
            // Create YouTube player
            if (!window.YT || !window.YT.Player) {
              return;
            }

            if (!playerContainerRef.current) {
              return;
            }

            // Clear the container and create a fresh element
            playerContainerRef.current.innerHTML = "";
            const playerElement = document.createElement("div");
            playerElement.id = playerElementId.current;
            playerElement.className = "w-full h-full";
            playerContainerRef.current.appendChild(playerElement);

            // Ensure the element exists in the DOM before creating the player
            const verifyElement = document.getElementById(
              playerElementId.current
            );

            if (!verifyElement) {
              return;
            }

            try {
              const player = new window.YT.Player(playerElementId.current, {
                height: "100%",
                width: "100%",
                videoId: currentVideo.id,
                playerVars: {
                  autoplay: 1,
                  mute: 1,
                  controls: 0,
                  disablekb: 1,
                  fs: 0,
                  modestbranding: 1,
                  playsinline: 1,
                  rel: 0,
                  showinfo: 0,
                  origin: window.location.origin,
                  start: startTime,
                  cc_load_policy: 0,
                },
                events: {
                  onReady: (event: any) => {
                    setPlayerReady(true);

                    // Load captions module
                    try {
                      event.target.loadModule("captions");
                    } catch (error) {
                      // Silently handle captions loading errors
                    }

                    // Unmute and play after user interaction
                    try {
                      event.target.unMute();
                      event.target.playVideo();
                    } catch (error) {
                      // Silently handle playback start errors
                    }
                  },
                  onStateChange: onPlayerStateChange,
                  onError: (event: any) => {
                    // Silently handle YouTube Player errors
                  },
                },
              });

              playerRef.current = player;
            } catch (error) {
              // Silently handle YouTube player creation errors
            }
          }, 400); // Delay to ensure DOM is ready
        }
      }, [currentVideo, isApiReady]);

      // Cleanup on unmount
      useEffect(() => {
        return () => {
          if (playerRef.current) {
            try {
              playerRef.current.destroy();
            } catch (error) {
              // Silently handle player destruction on unmount
            }
          }
          stopWhiteNoise();
          if (audioContextRef.current) {
            audioContextRef.current.close();
          }
        };
      }, []);

      // Time tracking
      useEffect(() => {
        setCurrentTime(randomStartTimeRef.current);
        const trackTime = () => {
          if (
            playerRef.current &&
            typeof playerRef.current.getCurrentTime === "function"
          ) {
            try {
              const time = playerRef.current.getCurrentTime();
              setCurrentTime(time);
            } catch (error) {
              // Silently handle time tracking errors
            }
          }
        };
        const interval = setInterval(trackTime, 1000);
        return () => clearInterval(interval);
      }, [currentVideo]);

      const playWhiteNoise = async () => {
        if (!audioContextRef.current) {
          return;
        }

        try {
          // Resume audio context if suspended
          if (audioContextRef.current.state === "suspended") {
            await audioContextRef.current.resume();
          }

          const buffer = createWhiteNoise();
          const source = audioContextRef.current.createBufferSource();
          const gainNode = audioContextRef.current.createGain();

          source.buffer = buffer;
          source.loop = true;
          gainNode.gain.value = 0.05; // Low volume white noise

          source.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);

          source.start();

          noiseNodeRef.current = source;
          gainNodeRef.current = gainNode;
        } catch (error) {
          // Silently handle white noise playback errors
        }
      };

      const stopWhiteNoise = () => {
        try {
          if (noiseNodeRef.current) {
            noiseNodeRef.current.stop();
            noiseNodeRef.current.disconnect();
            noiseNodeRef.current = null;
          }
          if (gainNodeRef.current) {
            gainNodeRef.current.disconnect();
            gainNodeRef.current = null;
          }
        } catch (error) {
          // Silently handle white noise stop errors
        }
      };

      // Prevent React from re-rendering the player container
      const playerContainerRef = useRef<HTMLDivElement>(null);

      const onPlayerStateChange = (event: any) => {
        const playerState = event.data;
        const isCurrentlyPlaying =
          playerState === window.YT.PlayerState.PLAYING;
        const isCurrentlyMuted = event.target.isMuted();

        // Update local state
        setIsPlaying(isCurrentlyPlaying);
        setIsMuted(isCurrentlyMuted);

        // Notify parent component
        if (onStateChange) {
          onStateChange(isCurrentlyPlaying, isCurrentlyMuted);
        }

        if (isCurrentlyPlaying) {
          // startTimeTracking(); // This was removed from useEffect, so this line is removed
        }
      };

      if (isLoading) {
        return (
          <div className="space-y-4">
            {/* TV Bezel */}
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 p-3 pb-6 rounded-xl shadow-2xl">
              {/* Screen Area */}
              <div className="tv-screen aspect-video w-full bg-black rounded-lg flex items-center justify-center mb-4">
                <div className="text-white text-2xl font-tv">
                  Loading Channel...
                </div>
              </div>
              {/* Bottom Bezel with Branding */}
              <div className="flex justify-center">
                <div className="text-white text-lg font-bold tracking-wider">
                  VibeTV
                </div>
              </div>
            </div>
          </div>
        );
      }

      if (!currentVideo) {
        return (
          <div className="space-y-4">
            {/* TV Bezel */}
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 p-3 pb-6 rounded-xl shadow-2xl">
              {/* Screen Area */}
              <div className="tv-screen aspect-video w-full bg-black rounded-lg flex items-center justify-center mb-4">
                <div className="text-white text-2xl font-tv">No Signal</div>
              </div>
              {/* Bottom Bezel with Branding */}
              <div className="flex justify-center">
                <div className="text-white text-lg font-bold tracking-wider">
                  VibeTV
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-4">
          {/* TV Bezel */}
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 p-3 pb-6 rounded-xl shadow-2xl">
            {/* Screen Area */}
            <div className="tv-screen aspect-video w-full bg-black rounded-lg overflow-hidden relative mb-4">
              {/* Static overlay */}
              {showStatic && <div className="absolute inset-0 z-10 bg-noise" />}

              {/* Video player container - managed by ref to prevent React interference */}
              <div
                ref={playerContainerRef}
                className="absolute inset-0 w-full h-full"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              />
            </div>
            {/* Bottom Bezel with Branding */}
            <div className="flex justify-center">
              <div className="text-white text-lg font-bold tracking-wider">
                VibeTV
              </div>
            </div>
          </div>

          <div className="bg-remote-gray p-4 rounded-lg">
            <h3 className="text-white font-bold text-lg mb-2">
              <a
                href={`https://www.youtube.com/watch?v=${currentVideo.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-300 transition-colors duration-200"
              >
                {decodeHtmlEntities(currentVideo.title)}
              </a>
            </h3>
            <p className="text-gray-300 text-sm mb-2">
              {currentVideo.channelTitle}
            </p>
            <p className="text-gray-400 text-xs">
              Published:{" "}
              {new Date(currentVideo.publishedAt).toLocaleDateString()}
            </p>
            {/* <p className="text-gray-400 text-xs mt-1">
              Time: {Math.floor(currentTime / 60)}:
              {(currentTime % 60).toString().padStart(2, "0")}
            </p> */}
          </div>
        </div>
      );
    }
  ),
  (prevProps: TVScreenProps, nextProps: TVScreenProps) => {
    return (
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.currentVideo?.id === nextProps.currentVideo?.id
    );
  }
);

export default TVScreen;
