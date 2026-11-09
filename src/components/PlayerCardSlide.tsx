import React from 'react';
import { PlayerSlide, Team, formatTaka } from '../data/auctionData';

interface PlayerCardSlideProps {
  player: PlayerSlide;
  currentBid: number;
  soldTeam?: Team;
}

export const PlayerCardSlide: React.FC<PlayerCardSlideProps> = ({
  player,
  currentBid,
  soldTeam,
}) => {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-[26px] bg-[#080705] select-none shadow-[0_20px_50px_rgba(0,0,0,0.65)] border border-white/15">
      <img
        src={player.slideImageUrl}
        alt="Player Card"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover object-center"
      />

      {/* If this photo is already SOLD and user navigated back to view it, show a corner stamp */}
      {soldTeam && (
        <div className="absolute bottom-4 right-4 z-20 bg-[#041230]/92 backdrop-blur-md border-2 border-amber-400 rounded-2xl p-3 flex items-center gap-3 shadow-2xl">
          <img
            src={soldTeam.logoUrl}
            alt={soldTeam.name}
            referrerPolicy="no-referrer"
            className="w-12 h-12 object-contain"
          />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Sold To
            </div>
            <div className="text-sm font-extrabold text-white uppercase">
              {soldTeam.name}
            </div>
            <div className="text-xs font-mono-tabular font-bold text-amber-300">
              {formatTaka(player.soldPrice || currentBid)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
