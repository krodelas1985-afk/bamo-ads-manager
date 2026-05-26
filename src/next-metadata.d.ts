// Fix for missing type declaration in Next.js 14.2.3
// metadata-interface.js ships without a .d.ts file, causing build errors
declare module 'next/dist/lib/metadata/types/metadata-interface.js' {
  export type ResolvingMetadata = Promise<any>
  export type ResolvingViewport = Promise<any>
}
