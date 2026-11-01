// Floade executes editor tools; external clients own model calls and conversation context.
import type { Plugin } from 'vite';
import { requestShapeGatePlugin } from './request-shape-gate.ts';
import { crossOriginIsolationPlugin } from './cross-origin-isolation.ts';
import { storageLifecyclePlugin } from './storage-lifecycle.ts';
import { projectStorePlugin } from './project-store-plugin.ts';
import { extensionStorePlugin } from './extension-store.ts';
import { externalAgentPlugin } from './external-agent.ts';
import { settingsPlugin } from './settings.ts';
import { exportStagePlugin } from './export-stage.ts';
import { exportPlugin } from './export.ts';
import { localCommandsPlugin } from './local-commands.ts';
import { exportDestinationPlugin } from './export-destination.ts';
import { exportMediaSourcesPlugin } from './export-media-sources.ts';
import { exportQaPlugin } from './export-qa.ts';
import { uploadMultipartPlugin } from './upload-multipart.ts';
import { uploadPlugin } from './upload.ts';
import { mobileUploadPlugin } from './mobile-upload.ts';
import { extractAudioPlugin } from './extract-audio.ts';
import { extractFramesPlugin } from './extract-frames.ts';
import { sceneDetectionPlugin } from './scene-detection.ts';
import { autoGradePlugin } from './auto-grade.ts';
import { isolateVoicePlugin } from './isolate-voice.ts';
import { mediaPreviewPlugin } from './media-preview.ts';
import { normalizeMediaPlugin } from './normalize-media.ts';
import { probeMediaPlugin } from './probe-media.ts';
import { subtitleExportPlugin } from './subtitles.ts';
import { skillFilesPlugin } from './skill-files.ts';
import { skillInstallPlugin } from './skill-install.ts';
import { skillExecPlugin } from './skill-exec.ts';
import { resourcePreviewPlugin } from './resource-preview.ts';

export function serverPlugins(options: { projectStoreHttp?: boolean } = {}): Plugin[] {
  return [
    requestShapeGatePlugin(),
    crossOriginIsolationPlugin(),
    storageLifecyclePlugin(),
    projectStorePlugin({ http: options.projectStoreHttp }),
    extensionStorePlugin(),
    externalAgentPlugin(),
    settingsPlugin(),
    exportStagePlugin(),
    exportPlugin(),
    localCommandsPlugin(),
    exportDestinationPlugin(),
    exportMediaSourcesPlugin(),
    exportQaPlugin(),
    uploadMultipartPlugin(),
    uploadPlugin(),
    mobileUploadPlugin(),
    extractAudioPlugin(),
    extractFramesPlugin(),
    sceneDetectionPlugin(),
    autoGradePlugin(),
    // Deterministic FFmpeg spectral denoise; no model or provider involved.
    isolateVoicePlugin(),
    mediaPreviewPlugin(),
    normalizeMediaPlugin(),
    probeMediaPlugin(),
    subtitleExportPlugin(),
    skillFilesPlugin(),
    skillInstallPlugin(),
    skillExecPlugin(),
    resourcePreviewPlugin({}),
  ];
}
