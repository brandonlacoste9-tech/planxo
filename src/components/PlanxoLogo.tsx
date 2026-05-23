export function PlanxoLogo({ size = 28, color = "currentColor", gold = "#d4a853" }: { size?: number; color?: string; gold?: string }) {
  return (
    <svg width={size * 2.2} height={size} viewBox="0 0 180 82" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Calendar icon mark */}
      <rect x="2" y="14" width="44" height="54" rx="10" stroke={gold} strokeWidth="3.5" fill="none" />
      <rect x="2" y="14" width="44" height="18" rx="10" fill={gold} opacity="0.15" />
      {/* Calendar binding rings */}
      <circle cx="14" cy="8" r="3.5" fill={gold} />
      <circle cx="34" cy="8" r="3.5" fill={gold} />
      {/* Calendar grid lines */}
      <line x1="18" y1="36" x2="30" y2="36" stroke={gold} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="18" y1="44" x2="30" y2="44" stroke={gold} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="18" y1="52" x2="24" y2="52" stroke={gold} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      {/* Checkmark on calendar */}
      <circle cx="40" cy="54" r="10" fill={gold} />
      <path d="M35 54 l4 4 l8 -8" stroke="#1a1008" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* Planxo wordmark */}
      <text x="58" y="56" fontFamily="'Cal Sans', 'Inter', sans-serif" fontSize="38" fontWeight="700" fill={color} letterSpacing="-0.5">Planxo</text>

      {/* Quebec fleur-de-lis accent dot */}
      <circle cx="164" cy="18" r="2.5" fill={gold} opacity="0.6" />
    </svg>
  );
}
