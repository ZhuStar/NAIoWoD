// Minimal ambient declarations so `tsc --noEmit` can type-check the test files
// without requiring `bun-types` to be installed from the network. At runtime,
// `bun test` provides the real, fully-typed implementations.
declare module "bun:test" {
  type TestFn = () => void | Promise<void>;
  export const test: (name: string, fn: TestFn) => void;
  export const it: (name: string, fn: TestFn) => void;
  export const describe: (name: string, fn: () => void) => void;
  export const beforeEach: (fn: TestFn) => void;
  export const afterEach: (fn: TestFn) => void;
  export function expect(value: unknown): any;
}
