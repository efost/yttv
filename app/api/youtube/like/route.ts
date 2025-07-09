import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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

    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    // Rate the video as "like"
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=like&access_token=${accessToken}`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API error: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to like video" },
      { status: 500 }
    );
  }
}
