// src/polyfill.js 
// Browser polyfills for Node.js globals 
(function() {   
  'use strict';      
  
  // Global polyfill   
  if (typeof window !== 'undefined' && !window.global) {     
    window.global = window;   
  }      
  
  // Process polyfill   
  if (typeof window !== 'undefined' && !window.process) {     
    window.process = {       
      env: {          
        DEBUG: undefined,         
        NODE_ENV: 'production'       
      },       
      version: '18.0.0',       
      versions: {         
        http_parser: '4.9.4',         
        node: '18.0.0',         
        v8: '10.2.154',         
        ares: '1.18.1',         
        uv: '1.44.2',         
        zlib: '2.0.6',         
        brotli: '1.0.9',         
        modules: '108',         
        nghttp2: '1.45.1',         
        napi: '9',         
        llhtml: '6.0.7',         
        openssl: '3.0.7',         
        cldr: '40.0',         
        icu: '71.1',         
        tz: '2022a',         
        unicode: '14.0'       
      },       
      platform: 'browser',       
      arch: 'x64',       
      title: 'browser',       
      pid: 1,       
      browser: true     
    };   
  }      
  
  // Buffer polyfill (if needed)   
  if (typeof window !== 'undefined' && !window.Buffer) {     
    window.Buffer = {       
      isBuffer: function() { return false; }     
    };   
  }      
  
  console.log('Browser polyfills loaded:', {     
    global: !!window.global,     
    process: !!window.process   
  }); 
})();

// TypeScript declarations
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

export {};