import { authOptions } from "@/lib/auth";
import { apiCache } from "@/lib/cache";
import { decodeHtmlEntities } from "@/lib/utils";
import { VideoItem } from "@/types/youtube";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const excludeIds = searchParams.get("exclude")?.split(",") || [];

    // Try to get access token from session or JWT
    let accessToken = session?.accessToken;

    if (!accessToken) {
      const { getToken } = await import("next-auth/jwt");
      const token = await getToken({
        req: request as any,
        secret: process.env.NEXTAUTH_SECRET,
      });
      accessToken = token?.accessToken;
    }

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if we have cached videos first
    const feedCacheKey = "youtube-feed";
    const subscriptionsCacheKey = "youtube-subscriptions";
    const userId = session?.user?.email;

    const cachedFeed = apiCache.get<{ videos: VideoItem[] }>(feedCacheKey, {
      userId,
    });
    const cachedSubscriptions = apiCache.get<{ videos: VideoItem[] }>(
      subscriptionsCacheKey,
      { userId }
    );

    let availableVideos: VideoItem[] = [];

    if (cachedFeed) {
      availableVideos.push(...cachedFeed.videos);
    }

    if (cachedSubscriptions) {
      availableVideos.push(...cachedSubscriptions.videos);
    }

    // Remove duplicates and excluded videos
    const uniqueVideos = availableVideos.filter(
      (video, index, self) =>
        index === self.findIndex((v) => v.id === video.id) &&
        !excludeIds.includes(video.id)
    );

    if (uniqueVideos.length > 0) {
      // Return a random video from cached data
      const randomIndex = Math.floor(Math.random() * uniqueVideos.length);
      const nextVideo = uniqueVideos[randomIndex];

      return NextResponse.json({ video: nextVideo });
    }

    // If no cached videos or all are excluded, fetch a new one

    // Try to get a random video from user's subscriptions
    const subscriptionsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=20&access_token=${accessToken}`
    );

    if (subscriptionsResponse.ok) {
      const subscriptionsData = await subscriptionsResponse.json();
      const channelIds =
        subscriptionsData.items?.map(
          (sub: any) => sub.snippet.resourceId.channelId
        ) || [];

      if (channelIds.length > 0) {
        // Pick a random channel
        const randomChannelId =
          channelIds[Math.floor(Math.random() * channelIds.length)];

        const channelVideosResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${randomChannelId}&order=date&type=video&maxResults=5&access_token=${accessToken}`
        );

        if (channelVideosResponse.ok) {
          const channelVideosData = await channelVideosResponse.json();
          const channelVideos =
            channelVideosData.items?.filter(
              (item: any) => !excludeIds.includes(item.id.videoId)
            ) || [];

          if (channelVideos.length > 0) {
            const randomVideo =
              channelVideos[Math.floor(Math.random() * channelVideos.length)];
            const nextVideo: VideoItem = {
              id: randomVideo.id.videoId,
              title: decodeHtmlEntities(randomVideo.snippet.title),
              thumbnail:
                randomVideo.snippet.thumbnails?.medium?.url ||
                randomVideo.snippet.thumbnails?.default?.url,
              channelTitle: randomVideo.snippet.channelTitle,
              publishedAt: randomVideo.snippet.publishedAt,
              duration: "PT0M0S",
              description: randomVideo.snippet.description,
            };

            return NextResponse.json({ video: nextVideo });
          }
        }
      }
    }

    // Fallback: try to get from home feed
    const feedResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&home=true&maxResults=10&access_token=${accessToken}`
    );

    if (feedResponse.ok) {
      const feedData = await feedResponse.json();
      const feedVideos =
        feedData.items
          ?.filter(
            (item: any) =>
              item.contentDetails?.upload?.videoId &&
              !excludeIds.includes(item.contentDetails.upload.videoId)
          )
          ?.map((item: any) => ({
            id: item.contentDetails.upload.videoId,
            title: decodeHtmlEntities(item.snippet.title),
            thumbnail:
              item.snippet.thumbnails?.medium?.url ||
              item.snippet.thumbnails?.default?.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            duration: "PT0M0S",
            description: item.snippet.description,
          })) || [];

      if (feedVideos.length > 0) {
        const randomVideo =
          feedVideos[Math.floor(Math.random() * feedVideos.length)];
        return NextResponse.json({ video: randomVideo });
      }
    }

    return NextResponse.json({ video: null });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch next video" },
      { status: 500 }
    );
  }
}
