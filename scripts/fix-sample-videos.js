const fs = require("fs");
const path = require("path");

function escapeTSString(str) {
  return str
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"') // Escape quotes
    .replace(/\r?\n|\r/g, " ") // Remove newlines
    .replace(/\t/g, " ") // Remove tabs
    .replace(/ +/g, " ") // Collapse multiple spaces
    .trim();
}

function fixSampleVideos() {
  const sampleVideosPath = path.join(
    __dirname,
    "..",
    "lib",
    "sample-videos.ts"
  );
  let content = fs.readFileSync(sampleVideosPath, "utf8");

  // Extract the array
  const match = content.match(
    /export const sampleVideos: VideoItem\[] = \[(.|\n|\r)*?];/
  );
  if (!match) {
    console.error("Could not find sampleVideos array");
    process.exit(1);
  }

  // Parse each object manually
  const arrayContent = match[0]
    .replace(/export const sampleVideos: VideoItem\[] = \[/, "")
    .replace(/];\s*$/, "");
  let objects = arrayContent
    .split(/},\s*/)
    .map((obj) => obj.trim())
    .filter(Boolean);

  // Ensure each object starts with { and ends with }
  objects = objects.map((obj) => {
    obj = obj.replace(/^,/, "");
    if (!obj.startsWith("{")) obj = "{" + obj;
    if (!obj.endsWith("}")) obj = obj + "}";
    // Fix property commas
    obj = obj.replace(/([^",\s])\n\s*([a-zA-Z_]+:)/g, "$1,\n    $2");
    // Fix description
    obj = obj.replace(/description: "([\s\S]*?)"\s*[,}]/, (m, desc) => {
      const fixedDesc = escapeTSString(desc);
      return `description: "${fixedDesc}"` + (m.endsWith(",") ? "," : "");
    });
    return obj;
  });

  // Join objects with commas, except after the last
  const fixedArray = objects
    .map((obj, i) => (i < objects.length - 1 ? obj + "," : obj))
    .join("\n\n");
  const fixedContent = `import { VideoItem } from "@/types/youtube";

export const sampleVideos: VideoItem[] = [
${fixedArray}
];
`;
  fs.writeFileSync(sampleVideosPath, fixedContent);
  console.log(
    "✅ Fixed and normalized sample videos file (structure and escaping, robust split)"
  );
}

fixSampleVideos();
