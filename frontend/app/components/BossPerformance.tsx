'use client';

import { useEffect } from 'react';
import type { BossExpression } from '@/lib/api';

const expressions: Record<BossExpression, string> = {
  smile: '微笑', recollect: '回忆', animated: '神采飞扬',
  gaze: '注视', grasp: '抓住那个球', angry: '愤怒',
};

export function BossPerformance({ expression }: { expression: BossExpression }) {
  useEffect(() => {
    Object.keys(expressions).forEach(name => { const image = new Image(); image.src = `/avatars/gaoqiu/${name}.jpg`; });
  }, []);
  // The supplied frames include window chrome. This viewport shows only the video,
  // retaining the original files and keeping the game's own controls interactive.
  return <svg className="meeting-boss-performance" viewBox="24 74 1488 690" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`高俅 · ${expressions[expression]}`} data-expression={expression}>
    {Object.keys(expressions).map(name => <image key={name} href={`/avatars/gaoqiu/${name}.jpg`} x="0" y="0" width="1536" height="864" visibility={name === expression ? 'visible' : 'hidden'} />)}
  </svg>;
}
