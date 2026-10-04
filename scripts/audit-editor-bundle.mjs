import { build } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

const forbidden = /\/src\/(?:agent\/(?:client|loop|systemPrompt|model-selection|codex\/|copilot\/|claude-code\/|context-management|skills\/plugin-skills)|audio\/silero-vad|persist\/jobRegistryStore|components\/chat\/ChatPanel|components\/settings\/SettingsDialog|generate\/(?:image|video|voice|music|sound|progress)\.)|\/node_modules\/(?:@ai-sdk|ai\/|onnxruntime|@huggingface|@mediapipe|@github\/copilot-sdk)/;
let violations = [];
await build({
  configFile: 'config/vite.config.ts',
  plugins: [{
    name: 'floade-audit-editor-tools',
    generateBundle() {
      const allModules = [...this.getModuleIds()].sort();
      const modules = allModules.filter((id) => !id.includes('node_modules'));
      mkdirSync('.cache', { recursive: true });
      writeFileSync('.cache/editor-production-modules.json', JSON.stringify(modules, null, 2));
      violations = allModules.filter((id) => forbidden.test(id.replaceAll('\\', '/')));
      writeFileSync('.cache/editor-production-importers.json', JSON.stringify(Object.fromEntries(modules.map((id) => {
        const info = this.getModuleInfo(id);
        return [id, [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])]];
      })), null, 2));
    },
  }],
});
if (violations.length) throw new Error(`Internal AI is still in the editor build:\n${violations.join('\n')}`);
console.log('Floade editor bundle: no internal AI client, chat, provider settings, or media generation.');
