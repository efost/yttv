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
    const cacheKey = "youtube-feed";
    const cachedData = apiCache.get<{ videos: VideoItem[] }>(cacheKey, {
      userId: session?.user?.email,
    });

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Fetch videos from user's home feed (reduced from 25 to 5 to save quota)
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&home=true&maxResults=5&access_token=${accessToken}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform activities into video items
    const videos: VideoItem[] =
      data.items
        ?.filter((item: any) => item.contentDetails?.upload?.videoId)
        ?.map((item: any) => ({
          id: item.contentDetails.upload.videoId,
          title: decodeHtmlEntities(item.snippet.title),
          thumbnail:
            item.snippet.thumbnails?.medium?.url ||
            item.snippet.thumbnails?.default?.url,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          duration: "PT0M0S", // We'll need to fetch this separately
          description: item.snippet.description,
        })) || [];

    const result = { videos };

    // Cache the result for 30 minutes (1800000 ms)
    apiCache.set(
      cacheKey,
      result,
      { userId: session?.user?.email },
      30 * 60 * 1000
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}
