// pino's package.json exposes a `browser` entry but ships no separate
// type declarations; reuse the main pino types since the API surface
// (default export, LoggerOptions) is identical.
declare module "pino/browser" {
  export { default } from "pino";
}
