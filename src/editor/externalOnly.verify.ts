import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { externalToolSchemas } from '../agent/external-tool-schemas';
import { assertEditorSettingsPatch } from '../../server/plugins/settings';
import { serverPlugins } from '../../server/plugins/index';
import { offlineExternalToolSchemas } from '../../server/external-agent/offline-tools';

const tools = new Set(externalToolSchemas().map((tool) => tool.name));
for (const name of ['begin_edit_session', 'edit_item', 'review_edit_session', 'discard_edit_session', 'read_timeline', 'edit_captions']) {
  assert.ok(tools.has(name), `MCP retains ${name}`);
}
const offlineTools = new Set(offlineExternalToolSchemas().map((tool) => tool.name));
for (const name of ['submit_image', 'submit_video', 'submit_voice', 'submit_motion_graphic', 'submit_shader', 'transcribe_track', 'search_media', 'find_highlights', 'inspect_music', 'track_progress', 'remove_silence']) {
  assert.ok(!tools.has(name), `MCP cannot invoke internal AI: ${name}`);
  assert.ok(!offlineTools.has(name), `Offline MCP cannot expose retired AI: ${name}`);
}
assertEditorSettingsPatch({ UI_LOCALE: 'zh-TW' });
assert.throws(() => assertEditorSettingsPatch({ OPENAI_API_KEY: 'test' }), /unsupported/);
assert.throws(() => assertEditorSettingsPatch({ CODEX_MODEL: 'test' }), /unsupported/);
assert.throws(() => assertEditorSettingsPatch({ UI_LOCALE: 'unknown' }), /invalid/);
const plugins = serverPlugins().map((plugin) => plugin.name);
assert.ok(plugins.some((name) => name.includes('external-agent')));
assert.ok(plugins.some((name) => name.includes('export')));
assert.ok(!plugins.some((name) => /llm|codex-agent|copilot-agent|claude-code-agent|generation|transcription|asr|model-packs|xai-oauth/.test(name)));
const view = await readFile('src/editor/EditorWorkspaceView.tsx', 'utf8');
assert.ok(!view.includes('ChatPanel') && !view.includes('SettingsDialog'));
assert.ok(view.includes('ExternalToolReview'));
console.log('externalOnly.verify: editor tools/review retained; internal AI routes, tools, and configuration removed');
