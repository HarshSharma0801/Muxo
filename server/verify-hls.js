const fs = require("fs-extra");
const path = require("path");

async function verifyHLSStream(roomName) {
  const hlsDir = path.join(__dirname, "public/hls", roomName);
  const playlistPath = path.join(hlsDir, "playlist.m3u8");

  console.log(`🔍 Checking HLS stream for room: ${roomName}`);
  console.log(`   Directory: ${hlsDir}`);
  console.log(`   Playlist: ${playlistPath}`);

  try {
    // Check if directory exists
    if (await fs.pathExists(hlsDir)) {
      console.log(`   ✅ HLS directory exists`);

      // List all files
      const files = await fs.readdir(hlsDir);
      console.log(`   📁 Files in directory: ${files.length}`);
      files.forEach((file) => {
        console.log(`      - ${file}`);
      });

      // Check playlist
      if (await fs.pathExists(playlistPath)) {
        console.log(`   ✅ Playlist file exists`);

        const playlistContent = await fs.readFile(playlistPath, "utf8");
        console.log(`   📄 Playlist content:`);
        console.log(playlistContent);

        // Count segments
        const segments = files.filter((f) => f.endsWith(".ts"));
        console.log(`   🎬 Video segments: ${segments.length}`);

        if (segments.length > 0) {
          console.log(`   🎉 HLS stream is working!`);
          return true;
        } else {
          console.log(`   ⚠️  No video segments found`);
          return false;
        }
      } else {
        console.log(`   ❌ Playlist file not found`);
        return false;
      }
    } else {
      console.log(`   ❌ HLS directory not found`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error checking HLS stream:`, error.message);
    return false;
  }
}

async function listAllStreams() {
  const hlsBaseDir = path.join(__dirname, "public/hls");

  console.log(`🔍 Checking all HLS streams...`);

  try {
    if (await fs.pathExists(hlsBaseDir)) {
      const rooms = await fs.readdir(hlsBaseDir);
      console.log(`   Found ${rooms.length} room directories:`);

      for (const room of rooms) {
        const roomPath = path.join(hlsBaseDir, room);
        const stat = await fs.stat(roomPath);

        if (stat.isDirectory()) {
          console.log(`\n📺 Room: ${room}`);
          await verifyHLSStream(room);
        }
      }
    } else {
      console.log(`   ❌ HLS base directory not found: ${hlsBaseDir}`);
    }
  } catch (error) {
    console.error(`   ❌ Error listing streams:`, error.message);
  }
}

// Command line usage
if (require.main === module) {
  const roomName = process.argv[2];

  if (roomName) {
    verifyHLSStream(roomName);
  } else {
    listAllStreams();
  }
}

module.exports = { verifyHLSStream, listAllStreams };
