// src/types/global.d.ts
export {};

declare global {
  interface Window {
    global?: Window;
    process?: {
      env: {
        DEBUG?: any;
        NODE_ENV: string;
      };
      version: string;
      versions: Record<string, string>;
      platform: string;
      arch: string;
      title: string;
      pid: number;
      browser: boolean;
    };
    Buffer?: {
      isBuffer: (obj: any) => boolean;
    };
    mapsLoaded?: boolean;
  }
}