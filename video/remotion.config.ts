// The bundler setup for the showcase video (specs/showcase-video.md).
import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

// Files under ../frontend/src would load the frontend's own React; two Reacts break hooks.
const own = (name: string) => path.resolve("node_modules", name);

Config.overrideWebpackConfig((config) =>
  enableTailwind({
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        react: own("react"),
        "react-dom": own("react-dom"),
      },
    },
  }),
);
