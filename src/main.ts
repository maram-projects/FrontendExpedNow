import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Check if polyfills are loaded
console.log('🚀 Main.ts - Starting application...');
console.log('✅ Polyfills check:', {
  global: !!window.global,
  process: !!window.process,
  processEnv: window.process?.env
});

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    console.log('✅ Angular application started successfully');
  })
  .catch((err) => {
    console.error('❌ Error starting Angular application:', err);
  });