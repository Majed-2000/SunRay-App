/**
 * Declares `getReactNativePersistence`, which @firebase/auth ships but hides
 * from TypeScript.
 *
 * The function is real: it exists in the package's React Native build
 * (`dist/rn/index.js`, exported from `dist/rn/index.rn.d.ts`) and Metro
 * resolves to that build, so it works at runtime. TypeScript never sees it
 * because of how the package declares its entry points:
 *
 *   "exports": {
 *     "types": "./dist/auth-public.d.ts",   ← unconditional, and FIRST
 *     "react-native": { "types": "./dist/rn/index.rn.d.ts", ... },
 *     ...
 *   }
 *
 * Conditions are matched in order, so the bare `types` key wins before
 * `react-native` is ever considered — and `auth-public.d.ts` omits the symbol.
 * This is a packaging bug in @firebase/auth, not a misconfiguration on our
 * side: `expo/tsconfig.base` already sets `moduleResolution: "bundler"` with
 * `customConditions: ["react-native"]`, which would otherwise pick the right
 * types.
 *
 * Augmenting the module is preferable to an `as any` cast at the call site:
 * the signature stays checked, and this note stays attached to the reason.
 * Delete this file once the package moves `types` inside the conditions.
 */
// Makes this file a module, which is what turns the block below into an
// AUGMENTATION of firebase/auth. Without it, `declare module` is read as an
// ambient declaration that REPLACES the module wholesale — every real export
// (initializeAuth, getAuth, Auth …) disappears and the errors point at the
// import site rather than at this file.
export {};

declare module 'firebase/auth' {
  /** The subset of AsyncStorage that Firebase Auth actually uses. */
  export interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }

  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
