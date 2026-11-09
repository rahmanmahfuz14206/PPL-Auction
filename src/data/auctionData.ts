export interface Team {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  logoUrl: string;
  accentColor: string;
  initialBudget: number;
}

export interface BidEntry {
  id: string;
  amount: number;
  incrementLabel: string;
  teamId?: string;
  timestamp: string;
}

export interface PlayerSlide {
  id: string;
  /** The photo number label, e.g. "01", "02", "03" */
  photoNumber: string;
  filename: string;
  slideImageUrl: string;
  basePrice: number;
  soldToTeamId?: string;
  soldPrice?: number;
}

/**
 * Extracts clean photo number from filename (e.g. "01.png" -> "01", "02.jpg" -> "02")
 */
export function getPhotoNumberFromFilename(filename: string, index: number): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '').trim();
  const leadingDigits = withoutExt.match(/^\d+/);
  if (leadingDigits) {
    return leadingDigits[0].padStart(2, '0');
  }
  return withoutExt || String(index + 1).padStart(2, '0');
}

export const TEAMS: Team[] = [
  {
    id: 'cognitive-kings',
    name: 'Cognitive Kings',
    shortName: 'KINGS',
    tagline: 'Cricket Team',
    logoUrl: '/assets/extracted/team1_cognitive_kings.png',
    accentColor: '#eab308',
    initialBudget: 50000000,
  },
  {
    id: 'imperium-eleven',
    name: 'Imperium Eleven',
    shortName: 'IMPERIUM',
    tagline: 'Rise Above All',
    logoUrl: '/assets/extracted/team2_imperium_eleven.png',
    accentColor: '#38bdf8',
    initialBudget: 50000000,
  },
  {
    id: 'mighty-victorians',
    name: 'Mighty Victorians',
    shortName: 'VICTORIANS',
    tagline: 'Crown of Victory',
    logoUrl: '/assets/extracted/team3_mighty_victorians.png',
    accentColor: '#22c55e',
    initialBudget: 50000000,
  },
  {
    id: 'venom-titans',
    name: 'Venom Titans',
    shortName: 'TITANS',
    tagline: 'Rise With Venom',
    logoUrl: '/assets/extracted/team4_venom_titans.png',
    accentColor: '#ef4444',
    initialBudget: 50000000,
  },
  {
    id: 'team-navy-seal',
    name: 'Team Navy Seal',
    shortName: 'NAVY SEAL',
    tagline: 'Anchor the Crease',
    logoUrl: '/assets/extracted/team5_navy_seal.png',
    accentColor: '#60a5fa',
    initialBudget: 50000000,
  },
];

/**
 * Formats a number in Bangladeshi / South Asian Lakh-Crore comma notation (e.g. 50,00,000 TK)
 */
export function formatTaka(amount: number, includeSuffix = true): string {
  const rounded = Math.max(0, Math.round(amount));
  const formatted = rounded.toLocaleString('en-IN');
  return includeSuffix ? `${formatted} TK` : formatted;
}

export interface CategoryOption {
  id: 'ICON' | 'A' | 'B' | 'C';
  label: string;
  basePrice: number;
}

export const PLAYER_CATEGORIES: CategoryOption[] = [
  {
    id: 'ICON',
    label: 'Icon',
    basePrice: 5000000, // 50,00,000 TK
  },
  {
    id: 'A',
    label: 'A',
    basePrice: 3000000, // 30,00,000 TK
  },
  {
    id: 'B',
    label: 'B',
    basePrice: 2000000, // 20,00,000 TK
  },
  {
    id: 'C',
    label: 'C',
    basePrice: 1000000, // 10,00,000 TK
  },
];

export const INITIAL_PLAYERS: PlayerSlide[] = [
  {
    id: 'folder-01.png',
    photoNumber: '01',
    filename: '01.png',
    slideImageUrl: '/players/01.png',
    basePrice: 5000000,
  },
];
