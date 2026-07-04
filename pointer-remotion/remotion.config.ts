import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
// H.264 + AAC so the muxed output carries an audio stream players accept.
Config.setCodec("h264");
