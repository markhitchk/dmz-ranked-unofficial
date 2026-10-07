import React from 'react';
import * as Application from 'expo-application';
import type {
  WidgetInfo,
  WidgetRepresentation,
  WidgetTaskHandlerProps
} from 'react-native-android-widget';
import { loadSettings } from '../services/storage';
import { getWidgetStats } from '../services/widgetStats';
import { DmzRankedWidget } from './DmzRankedWidget';

export async function renderDmzWidget(
  info: WidgetInfo,
  loading = false
): Promise<WidgetRepresentation> {
  const settings = await loadSettings();
  const operator = settings.selectedOperator.trim();
  const stats = !loading && operator ? await getWidgetStats(operator) : null;
  const beta = (Application.applicationId ?? '').endsWith('.beta');

  return (
    <DmzRankedWidget
      width={Number(info.width) || 250}
      height={Number(info.height) || 130}
      stats={stats}
      beta={beta}
      operator={operator}
      loading={loading}
    />
  );
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== 'DMZRanked') return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(await renderDmzWidget(props.widgetInfo, true));
      props.renderWidget(await renderDmzWidget(props.widgetInfo));
      break;
    case 'WIDGET_CLICK':
      if (props.clickAction === 'refresh') {
        props.renderWidget(await renderDmzWidget(props.widgetInfo, true));
        props.renderWidget(await renderDmzWidget(props.widgetInfo));
      }
      break;
    case 'WIDGET_DELETED':
    default:
      break;
  }
}
