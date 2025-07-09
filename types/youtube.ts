export interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  description?: string;
  viewCount?: string;
  likeCount?: string;
}

export interface YouTubeSearchResponse {
  items: VideoItem[];
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export interface YouTubeVideoResponse {
  items: {
    id: string;
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        default: { url: string; width: number; height: number };
        medium: { url: string; width: number; height: number };
        high: { url: string; width: number; height: number };
      };
      channelTitle: string;
      publishedAt: string;
    };
    contentDetails: {
      duration: string;
    };
    statistics?: {
      viewCount: string;
      likeCount: string;
    };
  }[];
}

export interface VideoHistoryItem {
  videoId: string;
  timestamp: number;
  title: string;
  channelTitle: string;
}
