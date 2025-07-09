import { authOptions } from "@/lib/auth";
import { apiCache } from "@/lib/cache";
import { decodeHtmlEntities } from "@/lib/utils";
import { VideoItem } from "@/types/youtube";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Try to get access token from session or JWT
    let accessToken = session?.accessToken;

    if (!accessToken) {
      // If no access token in session, try to get it from the JWT
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

    // Check cache first
    const cacheKey = "youtube-subscriptions";
    const cachedData = apiCache.get<{ videos: VideoItem[] }>(cacheKey, {
      userId: session?.user?.email,
    });

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // First, get user's subscriptions (reduced from 20 to 8)
    const subscriptionsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=8&access_token=${accessToken}`
    );

    if (!subscriptionsResponse.ok) {
      throw new Error(`YouTube API error: ${subscriptionsResponse.status}`);
    }

    const subscriptionsData = await subscriptionsResponse.json();
    const channelIds =
      subscriptionsData.items?.map(
        (sub: any) => sub.snippet.resourceId.channelId
      ) || [];

    if (channelIds.length === 0) {
      const result = { videos: [] };
      apiCache.set(
        cacheKey,
        result,
        { userId: session?.user?.email },
        30 * 60 * 1000
      );
      return NextResponse.json(result);
    }

    // Get channel details including upload playlist IDs (more efficient than individual searches)
    const channelDetailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelIds
        .slice(0, 4)
        .join(",")}&access_token=${accessToken}`
    );

    if (!channelDetailsResponse.ok) {
      throw new Error(`YouTube API error: ${channelDetailsResponse.status}`);
    }

    const channelDetailsData = await channelDetailsResponse.json();
    const uploadPlaylists =
      channelDetailsData.items
        ?.map(
          (channel: any) => channel.contentDetails?.relatedPlaylists?.uploads
        )
        .filter(Boolean) || [];

    const videos: VideoItem[] = [];

    // Get videos from upload playlists (more efficient than search)
    for (const playlistId of uploadPlaylists.slice(0, 3)) {
      // Limit to 3 playlists
      try {
        const playlistResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=2&access_token=${accessToken}`
        );

        if (playlistResponse.ok) {
          const playlistData = await playlistResponse.json();

          const playlistVideos =
            playlistData.items?.map((item: any) => ({
              id: item.snippet.resourceId.videoId,
              title: decodeHtmlEntities(item.snippet.title),
              thumbnail:
                item.snippet.thumbnails?.medium?.url ||
                item.snippet.thumbnails?.default?.url,
              channelTitle: item.snippet.channelTitle,
              publishedAt: item.snippet.publishedAt,
              duration: "PT0M0S",
              description: item.snippet.description,
            })) || [];

          videos.push(...playlistVideos);
        }
      } catch (error) {
        // Continue with other playlists if one fails
      }
    }

    const result = { videos };

    // Cache the result for 30 minutes
    apiCache.set(
      cacheKey,
      result,
      { userId: session?.user?.email },
      30 * 60 * 1000
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}
