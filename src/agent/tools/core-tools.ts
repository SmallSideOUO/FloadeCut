import type { AgentContext } from '../context';
import type { AgentToolSchema } from '../tool-schema';
import { defaultTrackId, resolveTrackId, trackAlias } from '../../editor/types';
import { execCoreDataTool } from './core-data-tools';
import { execJianyingExport } from './jianying-export-tool';

type Args = Record<string, unknown>;

function searchTools(args: Args, schemas: readonly AgentToolSchema[]): unknown {
  const query = String(args.query ?? '').trim().toLowerCase();
  if (!query) return { error: 'query is required', results: [] };
  const limit = Math.min(12, Math.max(1, Math.round(Number(args.limit) || 8)));
  const tokens = query.split(/\s+/).filter(Boolean);
  const scored = schemas
    .filter((tool) => tool.name !== 'ToolSearch')
    .map((tool) => {
      const haystack = `${tool.name} ${tool.description ?? ''}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (tool.name.toLowerCase() === token) score += 10;
        else if (tool.name.toLowerCase().includes(token)) score += 5;
        else if (haystack.includes(token)) score += 2;
      }
      return { tool, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .slice(0, limit);
  const results = scored.map(({ tool }) => ({
    name: tool.name,
    description: (tool.description ?? '').slice(0, 280),
  }));
  return {
    query,
    count: results.length,
    results,
    activatedTools: results.map((tool) => tool.name),
    note: results.length
      ? 'Matching schemas are active for the next model step. Call tools by exact name.'
      : 'No tools matched; try export / caption / stock / video / voice.',
  };
}

function execTemplateCatalog(name: string, args: Args, ctx: AgentContext): unknown {
  if (name === 'list_templates') {
    const category = args.category ? String(args.category).toLowerCase() : null;
    if (category) return ctx.templates.filter((template) => template.category.toLowerCase() === category).map((template) => template.name);
    const categories: Record<string, number> = {};
    for (const template of ctx.templates) categories[template.category] = (categories[template.category] ?? 0) + 1;
    return { categories, total: ctx.templates.length, hint: '传 category 或用 search_templates 精确找' };
  }
  if (name === 'search_templates') {
    const query = String(args.query ?? '').toLowerCase();
    return ctx.templates
      .filter((template) => template.name.toLowerCase().includes(query) || template.category.toLowerCase().includes(query))
      .slice(0, 15)
      .map((template) => ({ name: template.name, category: template.category }));
  }
  const query = String(args.templateName ?? '').toLowerCase();
  const matches = ctx.templates.filter((template) => template.name.toLowerCase().includes(query));
  if (!matches.length) return { error: `no template matching "${args.templateName}"`, available: ctx.templates.map((template) => template.name) };
  const template = matches[0];
  const state = ctx.getState();
  const track = resolveTrackId(state, args.track ?? 'V1', 'video') ?? defaultTrackId(state, 'video');
  if (!track) return { error: 'no video track; create one with edit_track first' };
  const startFrame = typeof args.startFrame === 'number' ? args.startFrame : undefined;
  ctx.commands.addMotionGraphic(template, { track, startFrame, ripple: args.ripple === true });
  return { ok: true, added: template.name, trackId: track, track: trackAlias(ctx.getState(), track) };
}

export async function execCoreTool(
  name: string,
  args: Args,
  ctx: AgentContext,
  schemas: readonly AgentToolSchema[],
): Promise<unknown> {
  if (name === 'ToolSearch') return searchTools(args, schemas);
  const dataResult = execCoreDataTool(name, args, ctx);
  if (dataResult !== undefined) return dataResult;
  const jianyingResult = await execJianyingExport(name, args, ctx);
  if (jianyingResult !== undefined) return jianyingResult;
  if (name === 'list_templates' || name === 'search_templates' || name === 'add_motion_graphic') {
    return execTemplateCatalog(name, args, ctx);
  }
  return { error: `unknown tool ${name}` };
}
