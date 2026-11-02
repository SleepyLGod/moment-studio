import {defineConfig} from 'vite';
export default defineConfig({root:'demo',publicDir:'../public',base:process.env.DEMO_BASE||'./',build:{outDir:'../dist-demo',emptyOutDir:false}});
