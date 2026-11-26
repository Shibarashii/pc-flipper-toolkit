// What Vite gives the frontend's files, so they type-check here too.
declare module "*.svg" {
  const src: string;
  export default src;
}
declare module "*.png" {
  const src: string;
  export default src;
}
interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}
