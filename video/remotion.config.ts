// The demo video's render setup (specs/demo-video.md).
import { Config } from "@remotion/cli/config";

// The recorder writes the recording and its event log here; staticFile() reads them.
Config.setPublicDir("recording");
