// ffprobe-static ships no types.
declare module "ffprobe-static" {
  const ffprobe: { path: string };
  export default ffprobe;
}
