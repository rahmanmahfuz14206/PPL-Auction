import React, { useState } from 'react';
import { PlayerSlide, Team, formatTaka } from '../data/auctionData';
import {
  Trophy,
  RotateCcw,
  ArrowLeft,
  Copy,
  Check,
  Download,
} from 'lucide-react';

interface AuctionSummaryViewProps {
  teams: Team[];
  players: PlayerSlide[];
  onBackToPhoto: (index: number) => void;
  onReturnToBoard: () => void;
  onResetAuction: () => void;
}

export const AuctionSummaryView: React.FC<AuctionSummaryViewProps> = ({
  teams,
  players,
  onBackToPhoto,
  onReturnToBoard,
  onResetAuction,
}) => {
  const [copied, setCopied] = useState(false);

  const unsoldPlayers = players
    .map((p, idx) => ({ player: p, index: idx }))
    .filter((item) => !item.player.soldToTeamId);

  const buildSummaryText = () => {
    const lines = ['★ PSYCHOLOGY PREMIER LEAGUE-26 AUCTION RESULTS ★', ''];
    teams.forEach((team) => {
      const teamPhotos = players.filter((p) => p.soldToTeamId === team.id);
      const numbersList =
        teamPhotos.length > 0
          ? teamPhotos.map((p) => p.photoNumber).join(', ')
          : 'None';
      const spent = teamPhotos.reduce((s, p) => s + (p.soldPrice || 0), 0);
      lines.push(
        `${team.name.toUpperCase()} (${teamPhotos.length}): [${numbersList}] — Total: ${formatTaka(spent)}`
      );
    });
    if (unsoldPlayers.length > 0) {
      lines.push(
        '',
        `UNSOLD NUMBERS: ${unsoldPlayers.map((u) => u.player.photoNumber).join(', ')}`
      );
    }
    return lines.join('\n');
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(buildSummaryText()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    const headers = ['Team Name', 'Count', 'Player Numbers Got', 'Total Spent (TK)'];
    const rows = teams.map((team) => {
      const teamPhotos = players.filter((p) => p.soldToTeamId === team.id);
      const numbers = teamPhotos.map((p) => p.photoNumber).join(', ');
      const spent = teamPhotos.reduce((s, p) => s + (p.soldPrice || 0), 0);
      return [
        `"${team.name}"`,
        teamPhotos.length,
        `"${numbers}"`,
        spent,
      ].join(',');
    });
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'PPL_26_Team_Numbers.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between px-4 sm:px-6 lg:px-10 py-5 text-white select-none"
      style={{
        background:
          'radial-gradient(circle at 50% 30%, #0e3075 0%, #071b47 55%, #030d26 100%)',
      }}
    >
      {/* Top Header */}
      <header className="w-full max-w-[1500px] mx-auto flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/15">
        <div className="flex items-center gap-3">
          <img
            src="/assets/extracted/ppl_logo.png"
            alt="PPL Logo"
            referrerPolicy="no-referrer"
            className="h-12 sm:h-14 w-auto object-contain"
          />
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-amber-300">
              <Trophy className="w-3.5 h-3.5" />
              <span>Auction Completed</span>
            </div>
            <h1 className="font-sans italic font-extrabold text-xl sm:text-3xl tracking-wider uppercase text-white">
              PSYCHOLOGY PREMIER LEAGUE-26 — FINAL TEAM NUMBERS
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-4 py-2.5 rounded-xl bg-[#eab308] hover:bg-[#facc15] text-[#041230] text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied Numbers!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Team Numbers</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadCSV}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onReturnToBoard}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Board</span>
          </button>

          <button
            type="button"
            onClick={onResetAuction}
            className="px-4 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>New Auction</span>
          </button>
        </div>
      </header>

      {/* Main 5 Teams Summary Grid */}
      <main className="w-full max-w-[1500px] mx-auto flex-1 my-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {teams.map((team) => {
            const teamPlayers = players
              .map((p, idx) => ({ player: p, index: idx }))
              .filter((item) => item.player.soldToTeamId === team.id);
            const totalSpent = teamPlayers.reduce(
              (sum, item) => sum + (item.player.soldPrice || 0),
              0
            );
            const numbersString = teamPlayers
              .map((item) => item.player.photoNumber)
              .join(', ');

            return (
              <div
                key={team.id}
                className="bg-[#051538]/95 border-2 border-white/15 rounded-3xl p-5 flex flex-col justify-between shadow-2xl"
              >
                <div>
                  {/* Team Logo & Name */}
                  <div className="flex flex-col items-center text-center pb-4 border-b border-white/10">
                    <img
                      src={team.logoUrl}
                      alt={team.name}
                      referrerPolicy="no-referrer"
                      className="w-24 h-24 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.65)]"
                    />
                    <h2 className="font-display font-extrabold text-2xl text-white uppercase tracking-wide mt-2">
                      {team.name}
                    </h2>
                    <div className="text-xs font-bold text-amber-300 mt-0.5">
                      {teamPlayers.length} Player{teamPlayers.length === 1 ? '' : 's'} Got
                    </div>
                  </div>

                  {/* Highlighted Numbers List Box */}
                  <div className="my-4 bg-[#030d26] border border-amber-400/40 rounded-2xl p-3.5 text-center">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 mb-1.5">
                      Numbers Got
                    </div>
                    {teamPlayers.length === 0 ? (
                      <div className="text-sm font-bold text-slate-400 py-2">
                        None
                      </div>
                    ) : (
                      <div className="font-mono-tabular font-extrabold text-xl sm:text-2xl text-[#fde047] tracking-wide break-words leading-snug">
                        {numbersString}
                      </div>
                    )}
                  </div>

                  {/* Individual Photo Number Cards */}
                  {teamPlayers.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {teamPlayers.map(({ player, index }) => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => onBackToPhoto(index)}
                          title="Click to view this photo on the board"
                          className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl p-2 text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 rounded-lg bg-[#eab308] text-[#041230] font-mono-tabular font-extrabold text-xs">
                              {player.photoNumber}
                            </span>
                            <img
                              src={player.slideImageUrl}
                              alt={`Photo ${player.photoNumber}`}
                              referrerPolicy="no-referrer"
                              className="w-12 h-8 object-cover rounded border border-white/20"
                            />
                          </div>
                          <span className="font-mono-tabular font-bold text-xs text-amber-200">
                            {formatTaka(player.soldPrice || 0)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team Total Spent Footer */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">
                    Total Spent
                  </span>
                  <span className="font-mono-tabular font-extrabold text-sm text-emerald-300">
                    {formatTaka(totalSpent)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Unsold Photo Numbers (if any) */}
        {unsoldPlayers.length > 0 && (
          <div className="bg-[#051538]/90 border border-white/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
              Unsold Photo Numbers (Click any number to auction it):
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {unsoldPlayers.map(({ player, index }) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onBackToPhoto(index)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 font-mono-tabular font-extrabold text-xs text-white transition-colors cursor-pointer"
                >
                  #{player.photoNumber}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
