"use client";

import { VideoItem } from "@/types/youtube";
import {
  ChevronDown,
  ChevronUp,
  FastForward,
  Pause,
  Play,
  Rewind,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  Youtube,
} from "lucide-react";
import { useState } from "react";

interface RemoteControlProps {
  onChannelUp: () => void;
  onChannelDown: () => void;
  currentVideo: VideoItem | null;
  onPlayPause: () => void;
  onMute: () => void;
  onFastForward: () => void;
  onRewind: () => void;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  onCaptionToggle: () => void;
  isPlaying: boolean;
  isMuted: boolean;
  captionsEnabled: boolean;
  usingSampleVideos?: boolean;
  // History props
  videoHistory?: Array<{
    video: VideoItem;
    timestamp: number;
    lastPosition: number;
    completed: boolean;
    duration?: number;
  }>;
  currentIndex?: number;
  // Auth props
  isAuthenticated: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function RemoteControl({
  onChannelUp,
  onChannelDown,
  currentVideo,
  onPlayPause,
  onMute,
  onFastForward,
  onRewind,
  onThumbsUp,
  onThumbsDown,
  onCaptionToggle,
  isPlaying,
  isMuted,
  captionsEnabled,
  usingSampleVideos,
  videoHistory,
  currentIndex,
  isAuthenticated,
  onSignIn,
  onSignOut,
}: RemoteControlProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [indicatorLight, setIndicatorLight] = useState(false);

  const handlePower = () => {
    // TODO: Implement power functionality
  };

  const handleCaptionToggle = () => {
    onCaptionToggle();
  };

  const RemoteButton = ({
    children,
    onClick,
    className = "",
    color = "bg-gradient-to-b from-neutral-700 to-neutral-800",
    disabled = false,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
    color?: string;
    disabled?: boolean;
  }) => {
    const handleMouseDown = () => {
      if (!disabled) {
        // Light up the indicator on mouse down
        setIndicatorLight(true);
      }
    };

    const handleMouseUp = () => {
      if (!disabled) {
        // Turn off the indicator on mouse up
        setTimeout(() => setIndicatorLight(false), 150); // Slight delay for realistic feel
        onClick();
      }
    };

    return (
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIndicatorLight(false)} // Turn off if mouse leaves button
        disabled={disabled}
        className={`remote-button ${color} hover:from-neutral-600 hover:to-neutral-700 text-white p-4 rounded-lg flex items-center justify-center transition-all duration-100 shadow-md ${className} ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {children}
      </button>
    );
  };

  return (
    <>
      <div className="bg-gradient-to-b from-neutral-800 to-neutral-900 p-6 rounded-xl shadow-2xl">
        {/* Indicator Light */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Glow effect */}
            <div
              className={`absolute inset-0 rounded-full transition-all duration-200 ${
                indicatorLight
                  ? "bg-red-400 blur-sm scale-125"
                  : "bg-transparent"
              }`}
            />
            {/* Light */}
            <div
              className={`relative w-2 h-2 rounded-full transition-all duration-200 ${
                indicatorLight
                  ? "bg-red-500 shadow-lg shadow-red-500/30"
                  : "bg-gray-500"
              }`}
            />
          </div>
        </div>

        {/* Channel Controls */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          <RemoteButton
            onClick={onChannelUp}
            className="text-2xl font-bold"
            // color="bg-gradient-to-b from-red-600 to-red-700"
          >
            <ChevronUp size={32} />
            <span className="ml-2">CH +</span>
          </RemoteButton>

          <RemoteButton
            onClick={onChannelDown}
            className="text-2xl font-bold"
            // color="bg-gradient-to-b from-red-600 to-red-700"
          >
            <ChevronDown size={32} />
            <span className="ml-2">CH -</span>
          </RemoteButton>
        </div>

        {/* Playback Controls */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <RemoteButton onClick={onRewind}>
            <Rewind size={24} />
          </RemoteButton>

          <RemoteButton onClick={onPlayPause}>
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </RemoteButton>

          <RemoteButton onClick={onFastForward}>
            <FastForward size={24} />
          </RemoteButton>
        </div>

        {/* Volume Controls */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <RemoteButton onClick={onMute}>
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </RemoteButton>

          <RemoteButton onClick={handleCaptionToggle}>
            <div className="w-8 h-6 border-2 border-white rounded-sm flex items-center justify-center">
              <span className="text-xs font-bold leading-none">CC</span>
            </div>
          </RemoteButton>
        </div>

        {/* Thumbs Up/Down Controls */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <RemoteButton
            onClick={onThumbsUp}
            // color="bg-gradient-to-b from-green-600 to-green-700"
            className={usingSampleVideos ? "opacity-50 cursor-not-allowed" : ""}
            disabled={usingSampleVideos}
          >
            <ThumbsUp size={24} />
          </RemoteButton>

          <RemoteButton
            onClick={onThumbsDown}
            // color="bg-gradient-to-b from-red-600 to-red-700"
            className={usingSampleVideos ? "opacity-50 cursor-not-allowed" : ""}
            disabled={usingSampleVideos}
          >
            <ThumbsDown size={24} />
          </RemoteButton>
        </div>

        {/* Auth Controls */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <RemoteButton
            onClick={isAuthenticated ? onSignOut : onSignIn}
            color="bg-gradient-to-b from-red-600 to-red-700"
          >
            <Youtube size={24} />
            <span className="ml-2">
              {isAuthenticated ? "Logout" : "Login with YouTube"}
            </span>
          </RemoteButton>
        </div>

        <div className="text-white/30 text-md text-center tracking-tight">
          VibeTV
        </div>
      </div>
      {/* Quota Warning */}
      {usingSampleVideos && isAuthenticated && (
        <div className="mb-6 p-4 rounded-lg backdrop-blur-sm">
          <div className="text-gray-300 text-sm text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">⚠️</span>
              <span className="font-semibold">YouTube API Quota Exceeded</span>
            </div>
            <div className="text-white/80 text-xs">
              Using sample videos • Thumbs disabled
            </div>
            <div className="text-white/60 text-xs">
              Quota resets daily at midnight PT
            </div>
          </div>
        </div>
      )}
    </>
  );
}
