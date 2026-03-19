import { View, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme';

interface Props {
  total: number;
  completed: number;
  size?: number;
  isTaskCompleted?: boolean;
}

const SEGMENTS: Record<number, string[]> = {
  0: [
    'M 40 8 A 32 32 0 0 1 67.7 24.0',
    'M 66.0 28.5 A 32 32 0 0 1 40 72',
    'M 36.5 71.5 A 32 32 0 0 1 12.5 24.5',
  ],
  1: ['M 40 8 A 32 32 0 1 1 39.5 8.01'],
  2: [
    'M 40 8 A 32 32 0 0 1 40 72',
    'M 40 72 A 32 32 0 0 1 40.5 8.01',
  ],
  3: [
    'M 40 8 A 32 32 0 0 1 67.7 24.0',
    'M 66.0 28.5 A 32 32 0 0 1 40 72',
    'M 36.5 71.5 A 32 32 0 0 1 12.5 24.5',
  ],
  4: [
    'M 40 8 A 32 32 0 0 1 72 40',
    'M 72 40 A 32 32 0 0 1 40 72',
    'M 40 72 A 32 32 0 0 1 8 40',
    'M 8 40 A 32 32 0 0 1 40 8',
  ],
};

const CHECK_PATH = 'M 22 42 L 35 55 L 58 28';

function getSegments(total: number): string[] {
  return SEGMENTS[total] || SEGMENTS[3];
}

// Use dangerouslySetInnerHTML for web SVG with filters
function BrushRingWeb({ total, completed, size, isTaskCompleted }: Required<Props>) {
  const segments = getSegments(total === 0 ? (isTaskCompleted ? 0 : 3) : total);
  const showCheck = isTaskCompleted;

  const filterDef = isTaskCompleted
    ? `<filter id="bf_${size}" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="turbulence" baseFrequency="0.04 0.08" numOctaves="4" seed="2" result="turb"/>
        <feDisplacementMap in="SourceGraphic" in2="turb" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
        <feGaussianBlur in="displaced" stdDeviation="1.2" result="glow"/>
        <feFlood flood-color="#8a9e78" flood-opacity="0.15" result="color"/>
        <feComposite in="color" in2="glow" operator="in" result="coloredGlow"/>
        <feMerge><feMergeNode in="coloredGlow"/><feMergeNode in="displaced"/></feMerge>
      </filter>`
    : `<filter id="bf_${size}" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="turbulence" baseFrequency="0.04 0.08" numOctaves="4" seed="2" result="turb"/>
        <feDisplacementMap in="SourceGraphic" in2="turb" scale="2.2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;

  let paths = '';
  if (showCheck) {
    paths = `<path d="${CHECK_PATH}" fill="none" stroke="${colors.sumiCompleted}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    paths = segments.map((d, i) => {
      const filled = i < completed;
      const stroke = filled ? colors.sumiInk : colors.ringUnfilled;
      const sw = filled ? 8 : 7;
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }).join('');
  }

  const svg = `<svg viewBox="0 0 80 80" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>${filterDef}</defs>
    <g filter="url(#bf_${size})">${paths}</g>
  </svg>`;

  return (
    <View style={{ width: size, height: size }}>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </View>
  );
}

// Native fallback without filters (filters don't work in react-native-svg)
function BrushRingNative({ total, completed, size, isTaskCompleted }: Required<Props>) {
  // For now, use the same web approach - will be replaced with react-native-svg later
  // On native, SVG filters aren't supported, so we use simple arcs
  const Svg = require('react-native-svg').Svg;
  const Path = require('react-native-svg').Path;

  const segments = getSegments(total === 0 ? (isTaskCompleted ? 0 : 3) : total);
  const showCheck = isTaskCompleted;

  if (showCheck) {
    return (
      <View style={{ width: size, height: size }}>
        <Svg viewBox="0 0 80 80" width={size} height={size}>
          <Path d={CHECK_PATH} fill="none" stroke={colors.sumiCompleted} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg viewBox="0 0 80 80" width={size} height={size}>
        {segments.map((d, i) => {
          const filled = i < completed;
          return (
            <Path
              key={i}
              d={d}
              fill="none"
              stroke={filled ? colors.sumiInk : colors.ringUnfilled}
              strokeWidth={filled ? 8 : 7}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </View>
  );
}

export function BrushRing({ total, completed, size = 22, isTaskCompleted = false }: Props) {
  if (Platform.OS === 'web') {
    return <BrushRingWeb total={total} completed={completed} size={size} isTaskCompleted={isTaskCompleted} />;
  }
  return <BrushRingNative total={total} completed={completed} size={size} isTaskCompleted={isTaskCompleted} />;
}
