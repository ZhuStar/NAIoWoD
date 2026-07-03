// Minimal ambient declarations for the Bun globals the build script uses, so
// `tsc --noEmit` can type-check scripts/ (pulled into the graph by
// test/build.test.ts) without installing bun-types from the network. Bun
// provides the real, fully-typed implementations at runtime.
declare const Bun: {
  file(path: string | URL): { text(): Promise<string>; json(): Promise<any> };
  write(path: string | URL, data: string): Promise<number>;
};
interface ImportMeta {
  /** True when this module is the program entry point (`bun run <file>`). */
  main: boolean;
}
