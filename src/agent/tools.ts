import { AGENT_RUNTIME_TOOL_NAMES, AGENT_RUNTIME_TOOL_SCHEMAS } from './tools/schemas/agent-runtime-tools';
import type { AgentToolSchema } from './tool-schema';
import type { AgentContext } from './context';
import type { HarnessToolExecutionContext } from './harness-context';
import { CORE_TOOL_SCHEMAS } from './tools/schemas/core-tools';
import { AUDIO_ASSET_TOOL_NAMES } from './tools/schemas/audio-asset-tools';
import { TRANSCRIPT_TOOL_NAMES, TRANSCRIPT_TOOL_SCHEMAS } from './tools/schemas/transcript-tools';
import { TIMELINE_TOOL_NAMES, TIMELINE_TOOL_SCHEMAS } from './tools/schemas/timeline-tools';
import { SCRIPT_TOOL_NAMES, SCRIPT_TOOL_SCHEMAS } from './tools/schemas/script-tools';
import { FRAMES_TOOL_NAMES, FRAMES_TOOL_SCHEMAS } from './tools/schemas/frames-tool';
import { SCENE_DETECTION_TOOL_NAMES, SCENE_DETECTION_TOOL_SCHEMAS } from './tools/schemas/scene-detection-tools';
import { EFFECT_TOOL_NAMES, EFFECT_TOOL_SCHEMAS } from './tools/schemas/effect-tools';
import { LIBRARY_TOOL_NAMES, LIBRARY_TOOL_SCHEMAS } from './tools/schemas/library-tools';
import { EDIT_ITEM_TOOL_NAMES, EDIT_ITEM_TOOL_SCHEMAS } from './tools/schemas/edit-item-tools';
import { MEDIA_POOL_TOOL_NAMES, MEDIA_POOL_TOOL_SCHEMAS } from './tools/schemas/media-pool-tools';
import { TRACK_TOOL_NAMES, TRACK_TOOL_SCHEMAS } from './tools/schemas/track-tools';
import { DESIGN_TOOL_NAMES, DESIGN_TOOL_SCHEMAS } from './tools/schemas/design-tools';
import { CAPTIONS_TOOL_NAMES, CAPTIONS_TOOL_SCHEMAS } from './tools/schemas/captions-tools';
import { EXPORT_TOOL_NAMES, EXPORT_TOOL_SCHEMAS } from './tools/schemas/export-tools';
import { EXPORT_QA_TOOL_NAMES, EXPORT_QA_TOOL_SCHEMAS } from './tools/schemas/export-qa-tools';
import { TEMPLATE_TOOL_NAMES, TEMPLATE_TOOL_SCHEMAS } from './tools/schemas/template-tools';
import { LOUDNESS_TOOL_NAMES, LOUDNESS_TOOL_SCHEMAS } from './tools/schemas/loudness-tools';
import { INSTALL_SKILL_TOOL_NAMES, INSTALL_SKILL_TOOL_SCHEMAS } from './tools/schemas/install-skill-tools';
import { RUN_SKILL_SCRIPT_TOOL_NAMES, RUN_SKILL_SCRIPT_TOOL_SCHEMAS } from './tools/schemas/skill-exec-tools';
import { WATERMARK_TOOL_NAMES, WATERMARK_TOOL_SCHEMAS } from './tools/schemas/watermark-tools';
import { MARKERS_TOOL_NAMES, MARKERS_TOOL_SCHEMAS } from './tools/schemas/markers-tools';
import { MG_VIDEO_TOOL_NAMES, MG_VIDEO_TOOL_SCHEMAS } from './tools/schemas/mg-video-tools';
import { EDIT_ASSET_TOOL_NAMES, EDIT_ASSET_TOOL_SCHEMAS } from './tools/schemas/edit-asset-tools';
import { FONT_TOOL_NAMES, FONT_TOOL_SCHEMAS } from './tools/schemas/font-tools';
import { SEARCH_TOOL_NAMES, SEARCH_TOOL_SCHEMAS } from './tools/schemas/search-tools';
import { PROJECT_TOOL_NAMES, PROJECT_TOOL_SCHEMAS } from './tools/schemas/project-tools';
import { UPLOAD_TOOL_NAMES, UPLOAD_TOOL_SCHEMAS } from './tools/schemas/upload-tools';
import { FRICTION_TOOL_NAMES, FRICTION_TOOL_SCHEMAS } from './tools/schemas/friction-tools';
import { READ_PROJECT_TOOL_NAMES, READ_PROJECT_TOOL_SCHEMAS } from './tools/schemas/read-project-tools';
import { MG_CODE_TOOL_NAMES, MG_CODE_TOOL_SCHEMAS } from './tools/schemas/mg-code-tools';
import { PROBE_TOOL_NAMES, PROBE_TOOL_SCHEMAS } from './tools/schemas/probe-tools';
import { MULTICAM_TOOL_NAMES, MULTICAM_TOOL_SCHEMAS } from './tools/schemas/multicam-tools';
import { UNDO_TOOL_NAMES, UNDO_TOOL_SCHEMAS } from './tools/schemas/undo-tools';
import { VERSION_TOOL_NAMES, VERSION_TOOL_SCHEMAS } from './tools/schemas/version-tools';
import { LAYOUT_TOOL_NAMES, LAYOUT_TOOL_SCHEMAS } from './tools/schemas/layout-tools';
import { COLOR_SCOPE_TOOL_NAMES, COLOR_SCOPE_TOOL_SCHEMAS } from './tools/schemas/color-scope-tools';
import { AUTO_GRADE_TOOL_NAMES, AUTO_GRADE_TOOL_SCHEMAS } from './tools/schemas/auto-grade-tools';
import { BEAT_TOOL_NAMES, BEAT_TOOL_SCHEMAS } from './tools/schemas/beat-tools';
import {
  AGENT_PATH_IMPORT_TOOL_NAMES,
  AGENT_PATH_IMPORT_SCHEMAS,
} from './tools/agent-path-import-tools';
import {
  TIMELINE_IMPORT_TOOL_NAMES,
  TIMELINE_IMPORT_TOOL_SCHEMAS,
} from './tools/schemas/timeline-import-tools';

// Canonical tool definitions (name / description / JSON input_schema). Each one
// executes against the EditorCore command layer. External MCP clients own
// conversation management and model calls.
export const TOOL_SCHEMAS: AgentToolSchema[] = [
  ...CORE_TOOL_SCHEMAS,
  ...AGENT_RUNTIME_TOOL_SCHEMAS,
  // transcript / captions / delete-text-=-delete-video (transcribe, find_transcript, clean_script, apply_script, edit_captions)
  ...TRANSCRIPT_TOOL_SCHEMAS,
  // multi-timeline management (manage_timelines: list/create/duplicate/switch/update/delete)
  ...TIMELINE_TOOL_SCHEMAS,
  // dynamic track management + stable ids (edit_track)
  ...TRACK_TOOL_SCHEMAS,
  // project media-pool organization (manage_media_pool)
  ...MEDIA_POOL_TOOL_SCHEMAS,
  // Script system (read_script/apply_script with deterministic timeline.md round trips).
  ...SCRIPT_TOOL_SCHEMAS,
  // Multimodal self-check: view_timeline_frames lets the agent inspect rendered frames.
  ...FRAMES_TOOL_SCHEMAS,
  // Local FFmpeg scene detection: report cut points or atomically generate markers and batch cuts.
  ...SCENE_DETECTION_TOOL_SCHEMAS,
  // browse_library → edit_item provides unified discovery and application for fx/lut/zoom/transition/sound.
  ...LIBRARY_TOOL_SCHEMAS,
  ...EDIT_ITEM_TOOL_SCHEMAS,
  // Compatibility shortcut: manage_effects maps to edit_item type=effect list/add/update/remove.
  ...EFFECT_TOOL_SCHEMAS,
  // Project design system: manage_design_style list/get/apply/update/clear.
  ...DESIGN_TOOL_SCHEMAS,
  // Online asset import (download_media / push_asset + search_stock_media; import_url_asset alias)
  // Word-level caption overrides: hide or replace words and force line breaks.
  ...CAPTIONS_TOOL_SCHEMAS,
  // Auto-avoid captions that cover the speaker's face (visual geometry).
  // Place overlay graphics in the geometry safe zone (avoid covering the speaker).
  // Custom WebGL effects: generate → compile and verify → register → apply through manage_effects.
  // Smart clips: find highlights from the word-level transcript → duplicate a 9:16 timeline → trim while preserving word frames.
  // Auto reframe: sample frames → detect subject focus → setReframeKeyframe through the existing render path.
  // Async render jobs: submit_render_job enqueues a long render and track_export polls progress/results.
  ...EXPORT_TOOL_SCHEMAS,
  // Export QA: streams, duration, black/still frames, silence, peaks, and evidence frames around edit points.
  ...EXPORT_QA_TOOL_SCHEMAS,
  // Project templates: manage_template get/list_assets/apply installs a bundled MG and design style set.
  ...TEMPLATE_TOOL_SCHEMAS,
  // Loudness normalization: offline WebAudio analysis → per-clip gain through setItemVolume.
  ...LOUDNESS_TOOL_SCHEMAS,
  // Voice isolation: FFmpeg spectral denoising → setItemDenoise(denoisedSrc).
  // Text watermark overlay: enabled/text/position/opacity for preview and burned-in export.
  ...WATERMARK_TOOL_SCHEMAS,
  // Timeline annotations/TODOs: list/create/update/delete point or range anchors on frames or clips.
  ...MARKERS_TOOL_SCHEMAS,
  // MG → video: bake an MG asset into a media-pool video.
  ...MG_VIDEO_TOOL_SCHEMAS,
  // Update/delete library assets: sandbox code/props/name updates and confirm delete impact.
  ...EDIT_ASSET_TOOL_SCHEMAS,
  // Web scraping: markdown/html/links/screenshot/branding/summary
  // Font catalog search; generate-tools enforces confirmFontFallback during export.
  ...FONT_TOOL_SCHEMAS,
  // Cross-project full-text search over chats/captions/transcripts (FTS5).
  ...SEARCH_TOOL_SCHEMAS,
  // Follow-up questions: render an interactive form card and pause the runtime through __followup.
  // Project session: create/list/delete/duplicate/edit/restore/target_project + get_editor_url
  ...PROJECT_TOOL_SCHEMAS,
  // Verified import session/finalize receipt chain plus media download.
  ...UPLOAD_TOOL_SCHEMAS,
  // Silent friction reporting through a localStorage ring buffer; no backend.
  ...FRICTION_TOOL_SCHEMAS,
  // Project overview.
  ...READ_PROJECT_TOOL_SCHEMAS,
  // Inline JSX → MG asset
  ...MG_CODE_TOOL_SCHEMAS,
  // Install a GitHub skill repo into the user skill directory.
  ...INSTALL_SKILL_TOOL_SCHEMAS,
  // Run installed-skill scripts locally (whitelisted binaries, skill dir locked).
  ...RUN_SKILL_SCRIPT_TOOL_SCHEMAS,
  // Run skill-provided scripts, FFmpeg, Node, or Python through run_code in an isolated e2b sandbox.
  // Import probe: probe_media reads hasAudioTrack/fps/duration through ffprobe.
  ...PROBE_TOOL_SCHEMAS,
  // Professional timeline: persistent clock/audio multicam, range switches, and linked/sync-lock groups.
  ...MULTICAM_TOOL_SCHEMAS,
  // Undo/redo: undo_last_change / redo_last_change submit history snapshots as normal edits.
  ...UNDO_TOOL_SCHEMAS,
  // Named version checkpoints: manage_versions list/save/restore/delete.
  ...VERSION_TOOL_SCHEMAS,
  // Named layouts: apply_layout computes transform+crop for split screen, picture-in-picture, grid, or reset.
  ...LAYOUT_TOOL_SCHEMAS,
  // Numeric color scopes: inspect_color reports black/white points, clipping, casts, and hue histograms.
  ...COLOR_SCOPE_TOOL_SCHEMAS,
  // Technical auto grade: auto_grade analyze|apply → setFilters on eligible pool media clips.
  ...AUTO_GRADE_TOOL_SCHEMAS,
  // Beat detection: local DSP reports BPM, beats, and downbeats and can add timeline markers for beat cuts.
  ...BEAT_TOOL_SCHEMAS,
  // Cached Beat This + CLAP inspection, deterministic rhythm edit planning, and one-batch video splitting.
  ...AGENT_PATH_IMPORT_SCHEMAS,
  ...TIMELINE_IMPORT_TOOL_SCHEMAS,
  // Optional advisory review of multi-scene plans; it has no runtime enforcement role.
  // ToolSearch — keyword discovery over this catalog
  {
    name: 'ToolSearch',
    description: [
      'Search the deferred agent-tool catalog by keyword and activate matching schemas.',
      'Use this before an uncommon operation instead of guessing a tool name.',
      'Results become callable on the next model step; essential tools are already active.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword(s), e.g. "export", "caption", "stock", "shader".' },
        limit: { type: 'number', description: 'Max activated results (default 8, max 12).' },
      },
      required: ['query'],
    },
  },
];

type Args = Record<string, unknown>;

type ToolExecutor = (
  name: string,
  args: Args,
  ctx: AgentContext,
  harness?: HarnessToolExecutionContext,
) => unknown | Promise<unknown>;
type ToolExecutorLoader = () => Promise<ToolExecutor>;

// Tool-name-selected literal imports keep Vite's chunk graph finite and
// statically discoverable while leaving executor groups outside the registry chunk.
const EXECUTOR_GROUPS: ReadonlyArray<readonly [ReadonlySet<string>, ToolExecutorLoader]> = [
  [AGENT_RUNTIME_TOOL_NAMES, async () => (await import('./tools/agent-runtime-tools')).execAgentRuntimeTool],
  [TRANSCRIPT_TOOL_NAMES, async () => (await import('./tools/transcript-tools')).execTranscriptTool],
  [TIMELINE_TOOL_NAMES, async () => (await import('./tools/timeline-tools')).execTimelineTool],
  [TRACK_TOOL_NAMES, async () => (await import('./tools/track-tools')).execTrackTool],
  [MEDIA_POOL_TOOL_NAMES, async () => (await import('./tools/media-pool-tools')).execMediaPoolTool],
  [SCRIPT_TOOL_NAMES, async () => (await import('./tools/script-tools')).execScriptTool],
  [FRAMES_TOOL_NAMES, async () => (await import('./tools/frames-tool')).execFramesTool],
  [SCENE_DETECTION_TOOL_NAMES, async () => (await import('./tools/scene-detection-tools')).execSceneDetectionTool],
  [LIBRARY_TOOL_NAMES, async () => (await import('./tools/library-tools')).execLibraryTool],
  [EDIT_ITEM_TOOL_NAMES, async () => (await import('./tools/edit-item-tools')).execEditItemTool],
  [EFFECT_TOOL_NAMES, async () => (await import('./tools/effect-tools')).execEffectTool],
  [DESIGN_TOOL_NAMES, async () => (await import('./tools/design-tools')).execDesignTool],
  [CAPTIONS_TOOL_NAMES, async () => (await import('./tools/captions-tools')).execCaptionsTool],
  [EXPORT_TOOL_NAMES, async () => (await import('./tools/export-tools')).execExportTool],
  [EXPORT_QA_TOOL_NAMES, async () => (await import('./tools/export-qa-tools')).execExportQaTool],
  [TEMPLATE_TOOL_NAMES, async () => (await import('./tools/template-tools')).execTemplateTool],
  [LOUDNESS_TOOL_NAMES, async () => (await import('./tools/loudness-tools')).execLoudnessTool],
  [INSTALL_SKILL_TOOL_NAMES, async () => (await import('./tools/install-skill-tools')).execInstallSkillTool],
  [RUN_SKILL_SCRIPT_TOOL_NAMES, async () => (await import('./tools/skill-exec-tools')).execRunSkillScriptTool],
  [WATERMARK_TOOL_NAMES, async () => (await import('./tools/watermark-tools')).execWatermarkTool],
  [MARKERS_TOOL_NAMES, async () => (await import('./tools/markers-tools')).execMarkersTool],
  [MG_VIDEO_TOOL_NAMES, async () => (await import('./tools/mg-video-tools')).execMgVideoTool],
  [EDIT_ASSET_TOOL_NAMES, async () => (await import('./tools/edit-asset-tools')).execEditAssetTool],
  [FONT_TOOL_NAMES, async () => (await import('./tools/font-tools')).execFontTool],
  [SEARCH_TOOL_NAMES, async () => (await import('./tools/search-tools')).execSearchTool],
  [PROJECT_TOOL_NAMES, async () => (await import('./tools/project-tools')).execProjectTool],
  [UPLOAD_TOOL_NAMES, async () => (await import('./tools/upload-tools')).execUploadTool],
  [FRICTION_TOOL_NAMES, async () => (await import('./tools/friction-tools')).execFrictionTool],
  [READ_PROJECT_TOOL_NAMES, async () => (await import('./tools/read-project-tools')).execReadProjectTool],
  [MG_CODE_TOOL_NAMES, async () => (await import('./tools/mg-code-tools')).execMgCodeTool],
  [PROBE_TOOL_NAMES, async () => (await import('./tools/probe-tools')).execProbeTool],
  [MULTICAM_TOOL_NAMES, async () => (await import('./tools/multicam-tools')).execMulticamTool],
  [UNDO_TOOL_NAMES, async () => {
    const { execUndoTool } = await import('./tools/undo-tools');
    return (name, _args, ctx) => execUndoTool(name, ctx);
  }],
  [VERSION_TOOL_NAMES, async () => (await import('./tools/version-tools')).execVersionTool],
  [LAYOUT_TOOL_NAMES, async () => (await import('./tools/layout-tools')).execLayoutTool],
  [COLOR_SCOPE_TOOL_NAMES, async () => (await import('./tools/color-scope-tools')).execColorScopeTool],
  [AUTO_GRADE_TOOL_NAMES, async () => (await import('./tools/auto-grade-tools')).execAutoGradeTool],
  [BEAT_TOOL_NAMES, async () => (await import('./tools/beat-tools')).execBeatTool],
  [AGENT_PATH_IMPORT_TOOL_NAMES, async () => (
    await import('./tools/agent-path-import-tools')
  ).execAgentPathImportTool],
  [TIMELINE_IMPORT_TOOL_NAMES, async () => (
    await import('./tools/timeline-import-tools')
  ).execTimelineImportTool],
  [AUDIO_ASSET_TOOL_NAMES, async () => (await import('./tools/audio-asset-tools')).execAudioAssetTool],
];

const EXECUTOR_BY_NAME = new Map<string, ToolExecutorLoader>();
for (const [names, load] of EXECUTOR_GROUPS) {
  for (const name of names) EXECUTOR_BY_NAME.set(name, load);
}


// Low-level dispatch only. Every runtime caller must pass the active schema and
// validated args through executeOpenChatCutTool (or the shared invocation validator).
export async function executeTool(
  name: string,
  args: Args,
  ctx: AgentContext,
  searchCatalog: readonly AgentToolSchema[] = TOOL_SCHEMAS,
  harness?: HarnessToolExecutionContext,
): Promise<unknown> {
  const loadExecutor = EXECUTOR_BY_NAME.get(name);
  if (loadExecutor) return (await loadExecutor())(name, args, ctx, harness);
  const { execCoreTool } = await import('./tools/core-tools');
  return execCoreTool(name, args, ctx, searchCatalog);
}
