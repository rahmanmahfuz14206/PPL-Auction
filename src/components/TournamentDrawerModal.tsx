import React, { useState, useRef } from 'react';
import {
  PlayerSlide,
  Team,
  formatTaka,
  getPhotoNumberFromFilename,
} from '../data/auctionData';
import {
  X,
  Upload,
  Trophy,
  Trash2,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';

interface TournamentDrawerModalProps {
  isOpen: boolean;
  initialTab: 'rosters' | 'players';
  onClose: () => void;
  teams: Team[];
  players: PlayerSlide[];
  currentIndex: number;
  onSelectPlayerIndex: (index: number) => void;
  onAddBulkSlides: (slides: PlayerSlide[]) => void;
  onDeletePlayer: (id: string) => void;
  onUnsellPlayer: (playerId: string) => void;
  onResetAuction: () => void;
}

export const TournamentDrawerModal: React.FC<TournamentDrawerModalProps> = ({
  isOpen,
  initialTab,
  onClose,
  teams,
  players,
  currentIndex,
  onSelectPlayerIndex,
  onAddBulkSlides,
  onDeletePlayer,
  onUnsellPlayer,
  onResetAuction,
}) => {
  const [activeTab, setActiveTab] = useState<'rosters' | 'players'>(initialTab);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  const handleBulkSlideUpload = async (
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
          e.target.value = '';
          return;
        }
      }
    } catch {
      // fallback if offline
    }

    onAddBulkSlides(newSlides);
    e.target.value = '';
  };

  const handleRescanPlayersFolder = async () => {
    try {
      await fetch('/api/players/rescan', { method: 'POST' });
      onClose();
    } catch {
      // ignore error
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[90vh] bg-[#071942] border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#04102b] border-b border-white/15">
          <div className="flex items-center gap-4">
            <img
              src="/assets/extracted/ppl_logo.png"
              alt="PPL"
              referrerPolicy="no-referrer"
              className="h-10 w-auto object-contain"
            />
            <div>
              <h3 className="font-display font-extrabold text-xl md:text-2xl tracking-wide text-white uppercase">
                PPL-26 Photos &amp; Team Sales
              </h3>
              <p className="text-xs text-slate-300">
                All player photos are loaded directly from the{' '}
                <code className="text-amber-300 font-mono">players/</code>{' '}
                folder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetAuction}
              className="px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Sales</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 bg-[#051436] border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('players')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'players'
                ? 'bg-[#eab308] text-[#041230]'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>&ldquo;players&rdquo; Folder Photos ({players.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rosters')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'rosters'
                ? 'bg-[#eab308] text-[#041230]'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>
              Team Sales ({players.filter((p) => p.soldToTeamId).length} Sold)
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'players' ? (
            <div className="space-y-5">
              {/* Top Upload / Scan Bar */}
              <div className="bg-[#04102b] border border-amber-400/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-display font-bold text-lg text-amber-300 uppercase tracking-wide">
                    Add Photos to &ldquo;players&rdquo; Folder
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Select player card images to save into the{' '}
                    <code className="text-amber-200 font-mono">players/</code>{' '}
                    folder, or click Scan Folder after adding files.
                  </p>
                </div>

                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBulkSlideUpload}
                  className="hidden"
                />

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => bulkFileInputRef.current?.click()}
                    className="py-2.5 px-4 rounded-xl bg-[#eab308] hover:bg-[#facc15] text-[#041230] font-extrabold text-xs flex items-center gap-2 shadow-md transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Photos</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRescanPlayersFolder}
                    className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                    <span>Scan Folder</span>
                  </button>
                </div>
              </div>

              {/* Photo Thumbnail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {players.map((p, index) => {
                  const soldTeam = teams.find((t) => t.id === p.soldToTeamId);
                  const isCurrent = index === currentIndex;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectPlayerIndex(index);
                        onClose();
                      }}
                      className={`group relative rounded-2xl overflow-hidden border-2 bg-[#04102b] transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-[#eab308] ring-2 ring-[#eab308]/40'
                          : 'border-white/15 hover:border-white/40'
                      }`}
                    >
                      <div className="aspect-[16/9.2] w-full bg-black overflow-hidden">
                        <img
                          src={p.slideImageUrl}
                          alt={`Photo ${index + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>

                      <div className="p-2.5 flex items-center justify-between gap-2">
                        <span className="font-mono-tabular font-bold text-xs text-amber-300">
                          Photo #{index + 1}
                        </span>

                        {soldTeam ? (
                          <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-400/30">
                            {soldTeam.shortName} ·{' '}
                            {formatTaka(p.soldPrice || 0, false)}
                          </span>
                        ) : (
                          players.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeletePlayer(p.id);
                              }}
                              className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/35 text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => {
                const teamPlayers = players.filter(
                  (p) => p.soldToTeamId === team.id
                );
                const totalSpent = teamPlayers.reduce(
                  (sum, p) => sum + (p.soldPrice || 0),
                  0
                );

                return (
                  <div
                    key={team.id}
                    className="bg-[#04102b] border border-white/15 rounded-2xl p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 object-contain shrink-0"
                          />
                          <div>
                            <h4 className="font-display font-extrabold text-lg text-white uppercase">
                              {team.name}
                            </h4>
                            <div className="text-xs text-amber-300 font-semibold">
                              {teamPlayers.length} Sold
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">
                            Total Spent
                          </div>
                          <div className="font-mono-tabular font-bold text-xs text-amber-300">
                            {formatTaka(totalSpent)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mt-3 max-h-56 overflow-y-auto pr-1">
                        {teamPlayers.length === 0 ? (
                          <div className="text-xs text-slate-400 py-6 text-center border border-dashed border-white/10 rounded-xl">
                            No players sold to {team.name} yet.
                          </div>
                        ) : (
                          teamPlayers.map((p, idx) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between bg-white/5 rounded-xl p-2 text-xs gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <img
                                  src={p.slideImageUrl}
                                  alt={`Sold ${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="w-14 h-9 object-cover rounded-lg border border-white/15"
                                />
                                <span className="font-mono-tabular font-bold text-amber-300">
                                  {formatTaka(p.soldPrice || 0)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => onUnsellPlayer(p.id)}
                                title="Undo sale"
                                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
