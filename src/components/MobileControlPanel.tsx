import React, { useState, useRef } from 'react';
import {
  PlayerSlide,
  Team,
  BidEntry,
  PLAYER_CATEGORIES,
  formatTaka,
  getPhotoNumberFromFilename,
} from '../data/auctionData';
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  Monitor,
  Gamepad2,
  Image as ImageIcon,
  Trophy,
  QrCode,
  RotateCcw,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface MobileControlPanelProps {
  players: PlayerSlide[];
  teams: Team[];
  currentIndex: number;
  currentPlayer: PlayerSlide;
  currentBid: number;
  bidHistory: BidEntry[];
  leadingTeamId?: string;
  connectedClients: number;
  isConnected: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onAddBid: (increment: number, label: string) => void;
  onStepUp: () => void;
  onStepDown: () => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onGoToSlide: (index: number) => void;
  onSetCustomBid: (amount: number) => void;
  onSelectCategory: (basePrice: number) => void;
  onResetCurrentBid: () => void;
  onSelectLeadingTeam: (teamId?: string) => void;
  onSellToTeam: (team: Team) => void;
  onUnsellPlayer: (playerId: string) => void;
  onAddBulkSlides: (slides: PlayerSlide[]) => void;
  onSwitchToStageView: () => void;
  onOpenQrModal: () => void;
}

export const MobileControlPanel: React.FC<MobileControlPanelProps> = ({
  players,
  teams,
  currentIndex,
  currentPlayer,
  currentBid,
  bidHistory,
  leadingTeamId,
  connectedClients,
  isConnected,
  isMuted,
  onToggleMute,
  onAddBid,
  onStepUp,
  onStepDown,
  onPrevSlide,
  onNextSlide,
  onGoToSlide,
  onSetCustomBid,
  onSelectCategory,
  onResetCurrentBid,
  onSelectLeadingTeam,
  onSellToTeam,
  onUnsellPlayer,
  onAddBulkSlides,
  onSwitchToStageView,
  onOpenQrModal,
}) => {
  const [mobileTab, setMobileTab] = useState<'pad' | 'slides' | 'squads'>('pad');
  const [isEditingBid, setIsEditingBid] = useState(false);
  const [customBidText, setCustomBidText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const soldTeam = teams.find((t) => t.id === currentPlayer?.soldToTeamId);
  const totalSold = players.filter((p) => Boolean(p.soldToTeamId)).length;

  const handleCustomBidSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseInt(customBidText.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numeric) && numeric >= 0) {
      onSetCustomBid(numeric);
    }
    setIsEditingBid(false);
  };

  const handleMobileSlideUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const readAsDataUrl = (file: File): Promise<string> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });

    const uploadPayload: Array<{ filename: string; dataUrl: string }> = [];
    const newSlides: PlayerSlide[] = [];
    for (let idx = 0; idx < fileArray.length; idx++) {
      const file = fileArray[idx];
      const dataUrl = await readAsDataUrl(file);
      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      uploadPayload.push({ filename: safeFilename, dataUrl });

      newSlides.push({
        id: `folder-${safeFilename}`,
        photoNumber: getPhotoNumberFromFilename(
          safeFilename,
          players.length + idx
        ),
        filename: safeFilename,
        slideImageUrl: `/players/${encodeURIComponent(safeFilename)}`,
        basePrice: 5000000,
      });
    }

    try {
      const resp = await fetch('/api/players/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: uploadPayload }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.players) && data.players.length > 0) {
          onAddBulkSlides(data.players);
        }
      }
      e.target.value = '';
      setMobileTab('pad');
      return;
    } catch {
      // fallback
    }

    onAddBulkSlides(newSlides);
    e.target.value = '';
    setMobileTab('pad');
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between pb-20 text-white select-none"
      style={{
        background:
          'radial-gradient(circle at 50% 20%, #0e3075 0%, #06173d 60%, #030c22 100%)',
      }}
    >
      {/* Compact Sticky Top App Bar */}
      <header className="sticky top-0 z-30 h-[54px] px-3 bg-[#04102b]/90 backdrop-blur-md border-b border-white/15 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/assets/extracted/ppl_logo.png"
            alt="PPL"
            referrerPolicy="no-referrer"
            className="h-8 w-auto object-contain shrink-0"
          />
          <div className="truncate">
            <div className="font-display font-extrabold text-sm tracking-wider uppercase text-white leading-none">
              PPL-26 Remote Pad
            </div>
            <div className="text-[10px] font-semibold text-emerald-300 leading-tight mt-0.5">
              {isConnected
                ? `Live Sync · ${connectedClients} Screen${
                    connectedClients === 1 ? '' : 's'
                  }`
                : 'Local Control Mode'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-white/10 flex items-center justify-center text-white cursor-pointer"
            title="Toggle Sound"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-300" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-300" />
            )}
          </button>

          <button
            type="button"
            onClick={onSwitchToStageView}
            className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-amber-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Board View</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Content Area */}
      <main className="flex-1 w-full max-w-lg mx-auto px-3 py-3 space-y-3">
        {mobileTab === 'pad' && (
          <>
            {/* Active Photo Preview Card */}
            <div className="bg-[#051538]/90 border border-white/15 rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-lg">
              <div className="w-28 aspect-[16/9.2] rounded-xl overflow-hidden border border-white/20 shrink-0 bg-black">
                <img
                  src={currentPlayer.slideImageUrl}
                  alt={`Photo ${currentIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 flex items-center justify-between">
                <div>
                  <div className="font-mono-tabular font-extrabold text-sm text-amber-300">
                    Photo #{currentPlayer.photoNumber} ({currentIndex + 1} /{' '}
                    {players.length})
                  </div>
                  <div className="text-xs text-slate-300 font-semibold mt-0.5">
                    Base:{' '}
                    <span className="font-mono-tabular text-white">
                      {formatTaka(currentPlayer.basePrice)}
                    </span>
                  </div>
                </div>

                {soldTeam && (
                  <div className="flex flex-col items-end shrink-0">
                    <div className="bg-emerald-500/20 border border-emerald-400 px-2.5 py-1 rounded-xl text-right">
                      <div className="text-[10px] font-extrabold text-emerald-300 uppercase">
                        SOLD → {soldTeam.shortName}
                      </div>
                      <div className="font-mono-tabular font-extrabold text-xs text-white">
                        {formatTaka(currentPlayer.soldPrice || currentBid)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUnsellPlayer(currentPlayer.id)}
                      className="mt-1 text-[10px] font-bold text-rose-300 underline cursor-pointer"
                    >
                      Re-open Bid
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Periwinkle Auction Board Remote Pad */}
            <div className="bg-[#9ab0f5] rounded-[28px] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.5)] border border-white/35 text-[#090d16]">
              {/* Gold Live Offer Display Box */}
              <div
                onClick={() => {
                  if (!isEditingBid) {
                    setCustomBidText(String(currentBid));
                    setIsEditingBid(true);
                  }
                }}
                className="w-full bg-[#cca043] border-[3px] border-[#18181b] rounded-[20px] py-3.5 px-3 text-center shadow-[inset_0_2px_6px_rgba(255,255,255,0.35),0_6px_14px_rgba(0,0,0,0.2)] cursor-pointer"
              >
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#18181b]/80 mb-0.5">
                  {bidHistory.length > 0
                    ? `Live Highest Offer (${bidHistory[0].incrementLabel})`
                    : 'Base Price / Current Offer'}
                </div>

                {isEditingBid ? (
                  <form
                    onSubmit={handleCustomBidSave}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-2 my-1"
                  >
                    <input
                      type="number"
                      autoFocus
                      value={customBidText}
                      onChange={(e) => setCustomBidText(e.target.value)}
                      onBlur={handleCustomBidSave}
                      className="w-40 px-2.5 py-1 rounded-xl bg-white border-2 border-[#18181b] font-mono-tabular font-extrabold text-xl text-black text-center"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-[#18181b] text-white text-xs font-extrabold"
                    >
                      Set
                    </button>
                  </form>
                ) : (
                  <div className="font-mono-tabular font-extrabold text-3xl sm:text-4xl text-[#0f141c] tracking-tight">
                    {formatTaka(currentBid)}
                  </div>
                )}

                <div
                  className="mt-2 flex items-center justify-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={onResetCurrentBid}
                    className="px-2.5 py-1 rounded-lg bg-black/15 active:bg-black/30 text-[11px] font-extrabold text-black flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset ({formatTaka(currentPlayer.basePrice)})</span>
                  </button>
                </div>
              </div>

              {/* Category Base Price Buttons: Icon (50,00,000), A (30,00,000), B (20,00,000), C (10,00,000) */}
              <div className="mt-3">
                <div className="grid grid-cols-4 gap-2">
                  {PLAYER_CATEGORIES.map((cat) => {
                    const isActive =
                      currentPlayer.basePrice === cat.basePrice &&
                      currentBid === cat.basePrice;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => onSelectCategory(cat.basePrice)}
                        className={`min-h-[48px] py-1.5 px-2 rounded-[14px] font-sans font-extrabold flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer border-2 ${
                          isActive
                            ? 'bg-[#18181b] text-[#fde047] border-[#18181b] shadow-md'
                            : 'bg-[#e0e8ff] hover:bg-white text-[#0f141c] border-[#18181b]/20 shadow-sm'
                        }`}
                      >
                        <span className="text-sm sm:text-base leading-tight">
                          {cat.label}
                        </span>
                        <span
                          className={`text-[9px] font-mono-tabular font-bold leading-tight mt-0.5 ${
                            isActive ? 'text-amber-200' : 'text-slate-700'
                          }`}
                        >
                          {formatTaka(cat.basePrice, false)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Holding Bid Quick Team Tag Row */}
              <div className="mt-2.5 flex items-center justify-between gap-1 bg-black/10 rounded-xl px-2 py-1.5">
                <span className="text-[10px] font-extrabold uppercase text-[#0f172a]/80 shrink-0">
                  Bidder:
                </span>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        onSelectLeadingTeam(
                          leadingTeamId === t.id ? undefined : t.id
                        )
                      }
                      className={`min-h-[30px] px-2 rounded-lg text-[10px] font-extrabold uppercase transition-colors shrink-0 cursor-pointer ${
                        leadingTeamId === t.id
                          ? 'bg-[#18181b] text-[#fde047]'
                          : 'bg-white/60 text-[#0f172a]'
                      }`}
                    >
                      {t.shortName}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 White Rounded Increment Buttons (+1L, +5L, +50k, +10k) */}
              <div className="grid grid-cols-4 gap-2 my-3">
                <button
                  type="button"
                  onClick={() => onAddBid(100000, '+1L')}
                  className="min-h-[54px] bg-white active:scale-95 text-[#0f141c] font-sans font-extrabold text-lg rounded-[16px] shadow-[0_5px_12px_rgba(0,0,0,0.16)] transition-transform cursor-pointer"
                >
                  +1L
                </button>
                <button
                  type="button"
                  onClick={() => onAddBid(500000, '+5L')}
                  className="min-h-[54px] bg-white active:scale-95 text-[#0f141c] font-sans font-extrabold text-lg rounded-[16px] shadow-[0_5px_12px_rgba(0,0,0,0.16)] transition-transform cursor-pointer"
                >
                  +5L
                </button>
                <button
                  type="button"
                  onClick={() => onAddBid(50000, '+50k')}
                  className="min-h-[54px] bg-white active:scale-95 text-[#0f141c] font-sans font-extrabold text-lg rounded-[16px] shadow-[0_5px_12px_rgba(0,0,0,0.16)] transition-transform cursor-pointer"
                >
                  +50k
                </button>
                <button
                  type="button"
                  onClick={() => onAddBid(10000, '+10k')}
                  className="min-h-[54px] bg-white active:scale-95 text-[#0f141c] font-sans font-extrabold text-lg rounded-[16px] shadow-[0_5px_12px_rgba(0,0,0,0.16)] transition-transform cursor-pointer"
                >
                  +10k
                </button>
              </div>

              {/* Directional Diamond Cluster: <<   ^ (+1000) / v (-1000)   >> */}
              <div className="flex items-center justify-center gap-6 py-1">
                <button
                  type="button"
                  onClick={onPrevSlide}
                  className="w-16 h-16 rounded-full bg-[#fcd116] active:scale-95 text-white flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition-transform cursor-pointer"
                  aria-label="Previous Photo"
                >
                  <ChevronsLeft className="w-10 h-10 stroke-[3]" />
                </button>

                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={onStepUp}
                    title="+1,000 TK"
                    className="w-12 h-12 rounded-full bg-[#07090e] active:scale-95 text-white flex items-center justify-center shadow-md transition-transform cursor-pointer"
                    aria-label="Add 1000 TK"
                  >
                    <ChevronUp className="w-7 h-7 stroke-[3]" />
                  </button>
                  <button
                    type="button"
                    onClick={onStepDown}
                    title="-1,000 TK"
                    className="w-12 h-12 rounded-full bg-[#07090e] active:scale-95 text-white flex items-center justify-center shadow-md transition-transform cursor-pointer"
                    aria-label="Subtract 1000 TK"
                  >
                    <ChevronDown className="w-7 h-7 stroke-[3]" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onNextSlide}
                  className="w-16 h-16 rounded-full bg-[#fcd116] active:scale-95 text-white flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition-transform cursor-pointer"
                  aria-label="Next Photo"
                >
                  <ChevronsRight className="w-10 h-10 stroke-[3]" />
                </button>
              </div>
            </div>

            {/* Tap Team Logo to Sell Player & Continue to Next Photo */}
            <div className="bg-[#051538]/90 border border-white/15 rounded-2xl p-3">
              <div className="grid grid-cols-5 gap-1.5">
                {teams.map((team) => {
                  const count = players.filter(
                    (p) => p.soldToTeamId === team.id
                  ).length;
                  const isSoldHere = currentPlayer.soldToTeamId === team.id;

                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => onSellToTeam(team)}
                      className={`relative flex flex-col items-center justify-between p-1.5 rounded-xl border transition-transform active:scale-95 cursor-pointer min-h-[86px] ${
                        isSoldHere
                          ? 'bg-emerald-500/25 border-emerald-400'
                          : 'bg-white/5 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      <div className="relative w-12 h-12 flex items-center justify-center">
                        <img
                          src={team.logoUrl}
                          alt={team.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain drop-shadow"
                        />
                        {count > 0 && (
                          <span className="absolute -top-1 -right-1 bg-[#eab308] text-[#041230] font-mono-tabular font-extrabold text-[10px] px-1.5 rounded-full">
                            {count}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-extrabold uppercase tracking-tight text-white text-center leading-tight mt-1">
                        {team.shortName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {mobileTab === 'slides' && (
          <div className="space-y-3">
            <div className="bg-[#051538] border border-amber-400/40 rounded-2xl p-3.5">
              <div className="font-display font-bold text-base uppercase text-amber-300 mb-1">
                Upload Photos to &ldquo;players&rdquo; Folder
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleMobileSlideUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[46px] mt-2 rounded-xl bg-[#eab308] text-[#041230] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Select Player Photos</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {players.map((p, idx) => {
                const pTeam = teams.find((t) => t.id === p.soldToTeamId);
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onGoToSlide(idx);
                      setMobileTab('pad');
                    }}
                    className={`rounded-2xl overflow-hidden border-2 bg-[#051538] text-left transition-all cursor-pointer ${
                      isCurrent
                        ? 'border-amber-400'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="aspect-[16/9.2] w-full bg-black">
                      <img
                        src={p.slideImageUrl}
                        alt={`Photo ${p.photoNumber}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 flex items-center justify-between">
                      <span className="font-mono-tabular font-bold text-xs text-amber-300">
                        #{p.photoNumber}
                      </span>
                      {pTeam && (
                        <span className="text-[10px] font-extrabold text-emerald-300">
                          {pTeam.shortName}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mobileTab === 'squads' && (
          <div className="space-y-3">
            {teams.map((team) => {
              const bought = players.filter((p) => p.soldToTeamId === team.id);
              const spent = bought.reduce(
                (acc, p) => acc + (p.soldPrice || 0),
                0
              );
              const numbersString = bought.map((p) => p.photoNumber).join(', ');

              return (
                <div
                  key={team.id}
                  className="bg-[#051538] border border-white/15 rounded-2xl p-3.5"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={team.logoUrl}
                        alt={team.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 object-contain"
                      />
                      <div>
                        <div className="font-display font-extrabold text-lg text-white uppercase leading-none">
                          {team.name}
                        </div>
                        <div className="text-xs text-amber-300 font-semibold mt-0.5">
                          Numbers Got:{' '}
                          <span className="font-mono-tabular text-white font-extrabold">
                            {numbersString || 'None'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase">
                        Total Spent
                      </div>
                      <div className="font-mono-tabular font-bold text-xs text-amber-300">
                        {formatTaka(spent)}
                      </div>
                    </div>
                  </div>

                  {bought.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {bought.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-xs bg-white/5 rounded-xl p-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#eab308] text-[#041230] font-mono-tabular font-extrabold text-xs">
                              {p.photoNumber}
                            </span>
                            <img
                              src={p.slideImageUrl}
                              alt={`Sold ${p.photoNumber}`}
                              referrerPolicy="no-referrer"
                              className="w-12 h-8 object-cover rounded border border-white/15"
                            />
                            <span className="font-mono-tabular text-amber-300 font-bold">
                              {formatTaka(p.soldPrice || 0)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onUnsellPlayer(p.id)}
                            className="p-1 rounded bg-rose-500/20 text-rose-300"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#04102b]/95 backdrop-blur-md border-t border-white/15 grid grid-cols-4 items-center px-2">
        <button
          type="button"
          onClick={() => setMobileTab('pad')}
          className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl transition-colors cursor-pointer ${
            mobileTab === 'pad' ? 'text-[#fde047]' : 'text-slate-400'
          }`}
        >
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">Remote Pad</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('slides')}
          className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl transition-colors cursor-pointer ${
            mobileTab === 'slides' ? 'text-[#fde047]' : 'text-slate-400'
          }`}
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">
            Photos ({players.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('squads')}
          className={`flex flex-col items-center justify-center min-h-[48px] rounded-xl transition-colors cursor-pointer ${
            mobileTab === 'squads' ? 'text-[#fde047]' : 'text-slate-400'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">
            Sold ({totalSold})
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenQrModal}
          className="flex flex-col items-center justify-center min-h-[48px] rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <QrCode className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-1">Pair Screen</span>
        </button>
      </nav>
    </div>
  );
};
