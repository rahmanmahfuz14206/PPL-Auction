import React, { useEffect } from 'react';
import { PlayerSlide, Team, formatTaka } from '../data/auctionData';
import { CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';

interface SoldCelebrationModalProps {
  player: PlayerSlide;
  team: Team;
  soldAmount: number;
  onContinueNext: () => void;
  onUndoSale: () => void;
}

export const SoldCelebrationModal: React.FC<SoldCelebrationModalProps> = ({
  player,
  team,
  soldAmount,
  onContinueNext,
  onUndoSale,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onContinueNext();
    }, 2400);
    return () => clearTimeout(timer);
  }, [onContinueNext]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02091c]/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl rounded-[32px] bg-gradient-to-b from-[#0d2761] to-[#051336] border-2 border-[#eab308] shadow-[0_25px_80px_rgba(234,179,8,0.35)] p-6 md:p-8 text-center overflow-hidden">
        <div className="inline-flex items-center gap-2 bg-[#eab308] text-[#041230] px-5 py-1.5 rounded-full font-display font-extrabold text-sm md:text-base tracking-[0.18em] uppercase shadow-lg mb-3">
          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
          <span>PPL-26 Official Hammer Fall</span>
        </div>

        <h2 className="font-impact text-4xl md:text-6xl tracking-wider uppercase text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
          PLAYER <span className="text-[#fde047]">SOLD!</span>
        </h2>

        {/* Player Photo & Winning Team Showcase */}
        <div className="my-5 grid grid-cols-1 md:grid-cols-11 items-center gap-4 bg-[#04102b]/80 border border-white/15 rounded-2xl p-4">
          {/* Player Card Photo */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="w-full aspect-[16/9.2] rounded-xl overflow-hidden border border-white/20 shadow-lg bg-black">
              <img
                src={player.slideImageUrl}
                alt="Sold Player"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-3 inline-block bg-[#cca043] border border-black/60 rounded-xl px-4 py-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-black/80">
                Winning Bid
              </div>
              <div className="font-mono-tabular font-extrabold text-lg md:text-xl text-black">
                {formatTaka(soldAmount)}
              </div>
            </div>
          </div>

          {/* Arrow Separator */}
          <div className="md:col-span-1 flex justify-center">
            <div className="w-10 h-10 rounded-full bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-extrabold">
              →
            </div>
          </div>

          {/* Winning Team Logo & Name */}
          <div className="md:col-span-5 flex flex-col items-center justify-center">
            <img
              src={team.logoUrl}
              alt={team.name}
              referrerPolicy="no-referrer"
              className="w-28 h-28 md:w-32 md:h-32 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.75)]"
            />
            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-300 mt-2">
              Sold To
            </div>
            <div className="font-display font-extrabold text-2xl md:text-3xl text-white uppercase tracking-wide">
              {team.name}
            </div>
          </div>
        </div>

        {/* Auto-advance progress bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 origin-left"
            style={{
              animation: 'shrinkWidth 2.4s linear forwards',
            }}
          />
        </div>
        <style>{`
          @keyframes shrinkWidth {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onUndoSale}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs md:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Undo Sale</span>
          </button>

          <button
            type="button"
            onClick={onContinueNext}
            className="px-6 py-2.5 rounded-xl bg-[#eab308] hover:bg-[#facc15] text-[#041230] text-xs md:text-sm font-extrabold flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
          >
            <span>Next Photo</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
