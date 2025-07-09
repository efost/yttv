# VibeTV - YouTube Remote Control

A web application that lets you control YouTube like an old-school TV remote control. Navigate through videos using channel up/down buttons, control playback with classic remote buttons, and experience YouTube in a nostalgic TV format.

## Features

- **TV-Style Interface**: Clean, retro TV interface with hidden video controls
- **Remote Control**: Classic TV remote with channel up/down, play/pause, volume, etc.
- **Video History**: Channel down acts as a "back" button through your viewing history
- **YouTube Integration**: Connect with your YouTube account to access your feed and subscriptions
- **No Video Controls**: Videos play without the standard YouTube interface - controlled entirely by the remote

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js with Google OAuth
- **YouTube API**: YouTube Data API v3 + IFrame Player API
- **Icons**: Lucide React

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and fill in your API keys:

```bash
cp env.example .env.local
```

You'll need to set up the following:

#### YouTube Data API v3

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the YouTube Data API v3
4. Create credentials (API Key)
5. Add the API key to `YOUTUBE_API_KEY`

#### Google OAuth (for YouTube login)

1. In Google Cloud Console, enable the Google+ API
2. Go to Credentials → Create Credentials → OAuth 2.0 Client IDs
3. Set up OAuth consent screen
4. Add authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Add client ID and secret to `.env.local`

#### NextAuth Secret

Generate a random string for `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## How It Works

### Channel Navigation

- **Channel Up (+)** : Loads a random video from your YouTube feed/subscriptions
- **Channel Down (-)** : Goes back to the previous video in your viewing history

### Remote Controls

- **Play/Pause** : Controls video playback
- **Fast Forward/Rewind** : Skip forward/backward 10 seconds
- **Volume** : Mute/unmute audio
- **Power** : System power control
- **Settings** : Configuration options

### Video History

The app maintains a stack of viewed videos with timestamps. When you press "Channel Down", it restores the previous video at the exact time you left it.

## API Endpoints

- `/api/auth/*` - NextAuth.js authentication routes
- `/api/youtube/feed` - Fetch user's YouTube feed
- `/api/youtube/subscriptions` - Fetch user's subscriptions
- `/api/youtube/video/[id]` - Get video details

## Development

### Project Structure

```
yttv/
├── app/                 # Next.js app directory
│   ├── page.tsx        # Main TV interface
│   ├── layout.tsx      # Root layout
│   └── globals.css     # Global styles
├── components/         # React components
│   ├── TVScreen.tsx   # Video player component
│   └── RemoteControl.tsx # Remote control interface
├── types/             # TypeScript type definitions
│   └── youtube.ts     # YouTube API types
└── lib/               # Utility functions
    └── youtube.ts     # YouTube API helpers
```

### Key Components

#### TVScreen

- Embeds YouTube IFrame Player
- Hides default controls
- Displays channel/video info overlays
- Handles video state management

#### RemoteControl

- Classic TV remote interface
- Button click handlers
- Visual feedback and animations
- Current video display

## Future Enhancements

- [ ] Real YouTube feed integration
- [ ] User authentication flow
- [ ] Video recommendations
- [ ] Custom remote themes
- [ ] Keyboard shortcuts
- [ ] Mobile responsive design
- [ ] Video quality settings
- [ ] Closed captions toggle

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Troubleshooting

### Common Issues

1. **YouTube API Quota Exceeded**

   - Check your API usage in Google Cloud Console
   - Implement caching for repeated requests

2. **OAuth Redirect Issues**

   - Ensure redirect URIs are correctly configured
   - Check that `NEXTAUTH_URL` matches your deployment URL

3. **Video Player Not Loading**
   - Check browser console for errors
   - Ensure YouTube IFrame API is loading correctly
   - Verify video IDs are valid

### Getting Help

If you encounter issues:

1. Check the browser console for errors
2. Verify all environment variables are set
3. Ensure YouTube API is enabled and has quota
4. Check that OAuth consent screen is configured properly
