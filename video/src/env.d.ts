// The bundler turns an imported image into its URL.
declare module "*.png" {
  const src: string;
  export default src;
}
