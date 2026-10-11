/** @type {import('next').NextConfig} */
const nextConfig = {
  // Secrets are read from process.env at runtime on the server.
  // Don't list them in an `env` block: that inlines them into build output.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "yt3.ggpht.com" },
    ],
  },
};

module.exports = nextConfig;
