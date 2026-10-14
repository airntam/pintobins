import { labelEngine } from '$lib/label/engine';
import { renderLabelSvg } from '$lib/label/render';
import { svgToPng } from '$lib/label/png';
import { labelModel, type Ctx } from './data';
import { baseUrl } from './pb';
import type { Place } from '$lib/types';

export const labelSvg = (ctx: Ctx, place: Place) =>
  renderLabelSvg(labelModel(ctx, place), labelEngine, { baseUrl: baseUrl() });

export const labelPng = (ctx: Ctx, place: Place) =>
  svgToPng(renderLabelSvg(labelModel(ctx, place), labelEngine, { baseUrl: baseUrl(), png: true }));
