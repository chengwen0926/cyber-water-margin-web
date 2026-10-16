export function BossPortrait({ full = false }: { full?: boolean }) {
  return <svg className="boss-portrait" viewBox="67 210 1658 1848" preserveAspectRatio={full ? 'xMidYMid meet' : 'xMidYMin slice'} role="img" aria-label="领导形象">
    <image href="/avatars/boss.jpg" width="1792" height="2400" />
  </svg>;
}
