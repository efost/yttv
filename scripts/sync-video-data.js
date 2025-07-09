const fs = require("fs");
const path = require("path");

// YouTube Data API v3 endpoint
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

// Function to fetch video data from YouTube API
async function fetchVideoData(videoId, apiKey) {
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      return {
        id: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails.high.url,
        channelTitle: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails.duration,
        description:
          video.snippet.description.substring(0, 200) +
          (video.snippet.description.length > 200 ? "..." : ""),
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching data for video ${videoId}:`, error.message);
    return null;
  }
}

// Function to update the sample videos file
async function updateSampleVideos() {
  // Load environment variables from .env file
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error("Please set YOUTUBE_API_KEY in your .env file");
    process.exit(1);
  }

  // Read current sample videos
  const sampleVideosPath = path.join(
    __dirname,
    "..",
    "lib",
    "sample-videos.ts"
  );
  const sampleVideosContent = fs.readFileSync(sampleVideosPath, "utf8");

  // Extract video IDs from the current file
  const videoIdRegex = /id:\s*"([^"]+)"/g;
  const videoIds = [];
  let match;

  while ((match = videoIdRegex.exec(sampleVideosContent)) !== null) {
    videoIds.push(match[1]);
  }

  console.log(`Found ${videoIds.length} video IDs to update`);

  // Fetch updated data for each video
  const updatedVideos = [];

  for (let i = 0; i < videoIds.length; i++) {
    const videoId = videoIds[i];
    console.log(
      `Fetching data for video ${i + 1}/${videoIds.length}: ${videoId}`
    );

    const videoData = await fetchVideoData(videoId, apiKey);

    if (videoData) {
      updatedVideos.push(videoData);
      console.log(`✓ Updated: ${videoData.title}`);
    } else {
      console.log(`✗ Failed to fetch data for: ${videoId}`);
    }

    // Add a small delay to avoid hitting API rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Generate the updated TypeScript file content
  const fileContent = `import { VideoItem } from "@/types/youtube";

export const sampleVideos: VideoItem[] = [
${updatedVideos
  .map(
    (video) => `  {
    id: "${video.id}",
    title: "${video.title.replace(/"/g, '\\"')}",
    thumbnail: "${video.thumbnail}",
    channelTitle: "${video.channelTitle.replace(/"/g, '\\"')}",
    publishedAt: "${video.publishedAt}",
    duration: "${video.duration}",
    description: "${video.description.replace(/"/g, '\\"')}"
  }`
  )
  .join(",\n")}
];
`;

  // Write the updated content back to the file
  fs.writeFileSync(sampleVideosPath, fileContent);

  console.log(
    `\n✅ Successfully updated ${updatedVideos.length} videos in lib/sample-videos.ts`
  );
  console.log(`📊 Summary:`);
  console.log(`   - Total videos processed: ${videoIds.length}`);
  console.log(`   - Successfully updated: ${updatedVideos.length}`);
  console.log(
    `   - Failed to update: ${videoIds.length - updatedVideos.length}`
  );
}

// Run the script
updateSampleVideos().catch(console.error);
