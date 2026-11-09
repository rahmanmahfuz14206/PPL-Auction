/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TEAMS,
  INITIAL_PLAYERS,
  PLAYER_CATEGORIES,
  PlayerSlide,
  Team,
  BidEntry,
  formatTaka,
} from './data/auctionData';
import { PlayerCardSlide } from './components/PlayerCardSlide';
import { SoldCelebrationModal } from './components/SoldCelebrationModal';
import { TournamentDrawerModal } from './components/TournamentDrawerModal';
import { MobileControlPanel } from './components/MobileControlPanel';
import { PhoneRemoteModal } from './components/PhoneRemoteModal';
import { AuctionSummaryView } from './components/AuctionSummaryView';
import { soundEngine } from './utils/soundEffects';
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Upload,
  Trophy,
  Maximize2,
  RotateCcw,
  Smartphone,
} from 'lucide-react';

const STORAGE_KEY = 'ppl_26_auction_state_v4';

interface SyncedSalePayload {
  playerId: string;
  teamId: string;
  amount: number;
  timestamp: number;
}

interface ServerAuctionState {
  players: PlayerSlide[];
  currentIndex: number;
  currentBid: number;
  bidHistory: BidEntry[];
  leadingTeamId?: string;
  lastStepAmount: number;
  isAuctionEnded: boolean;
  activeSale: SyncedSalePayload | null;
  updatedAt?: number;
}

export default function App() {
  const [viewMode, setViewMode] = useState<'board' | 'remote'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'remote') return 'remote';
      if (params.get('mode') === 'board') return 'board';
      if (window.innerWidth < 768) return 'remote';
    }
    return 'board';
  });

  const [players, setPlayers] = useState<PlayerSlide[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.players) && parsed.players.length > 0) {
          return parsed.players;
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_PLAYERS;
  });

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const currentPlayer = players[currentIndex] || players[0];

  const getInitialBidForPlayer = useCallback((player: PlayerSlide) => {
    if (!player) return 5000000;
    if (player.soldPrice) return player.soldPrice;
    return player.basePrice;
  }, []);

  const [currentBid, setCurrentBid] = useState<number>(() =>
    getInitialBidForPlayer(players[0])
  );
  const [bidHistory, setBidHistory] = useState<BidEntry[]>([]);
  const [leadingTeamId, setLeadingTeamId] = useState<string | undefined>(
    undefined
  );
  const [lastStepAmount, setLastStepAmount] = useState<number>(1000);
  const [isAuctionEnded, setIsAuctionEnded] = useState<boolean>(false);

  const [activeSale, setActiveSale] = useState<SyncedSalePayload | null>(null);
  const lastPlayedSaleTimestampRef = useRef<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedClients, setConnectedClients] = useState<number>(1);

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'rosters' | 'players'>('players');
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);

  const [isEditingBid, setIsEditingBid] = useState<boolean>(false);
  const [customBidInput, setCustomBidInput] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const applyRemoteState = useCallback((remote: ServerAuctionState) => {
    if (Array.isArray(remote.players) && remote.players.length > 0) {
      setPlayers(remote.players);
    }
    if (typeof remote.currentIndex === 'number') {
      setCurrentIndex(remote.currentIndex);
    }
    if (typeof remote.currentBid === 'number') {
      setCurrentBid(remote.currentBid);
    }
    if (Array.isArray(remote.bidHistory)) {
      setBidHistory(remote.bidHistory);
    }
    setLeadingTeamId(remote.leadingTeamId);
    if (typeof remote.lastStepAmount === 'number') {
      setLastStepAmount(remote.lastStepAmount);
    }
    if (typeof remote.isAuctionEnded === 'boolean') {
      setIsAuctionEnded(remote.isAuctionEnded);
    }
    setActiveSale(remote.activeSale || null);

    if (
      remote.activeSale &&
      remote.activeSale.timestamp > lastPlayedSaleTimestampRef.current
    ) {
      lastPlayedSaleTimestampRef.current = remote.activeSale.timestamp;
      soundEngine.playSoldFanfare();
    }
  }, []);

  const broadcastStateUpdate = useCallback(
    (nextPartial: Partial<ServerAuctionState>) => {
      const payloadState: ServerAuctionState = {
        players: nextPartial.players ?? players,
        currentIndex: nextPartial.currentIndex ?? currentIndex,
        currentBid: nextPartial.currentBid ?? currentBid,
        bidHistory: nextPartial.bidHistory ?? bidHistory,
        leadingTeamId:
          'leadingTeamId' in nextPartial
            ? nextPartial.leadingTeamId
            : leadingTeamId,
        lastStepAmount: nextPartial.lastStepAmount ?? lastStepAmount,
        isAuctionEnded:
          'isAuctionEnded' in nextPartial
            ? Boolean(nextPartial.isAuctionEnded)
            : isAuctionEnded,
        activeSale:
          'activeSale' in nextPartial
            ? nextPartial.activeSale ?? null
            : activeSale,
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'state:update',
            state: payloadState,
          })
        );
      } else {
        fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: payloadState }),
        }).catch(() => {});
      }
    },
    [
      players,
      currentIndex,
      currentBid,
      bidHistory,
      leadingTeamId,
      lastStepAmount,
      isAuctionEnded,
      activeSale,
    ]
  );

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWs = () => {
      if (isUnmounted || typeof window === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) return;
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'state:sync' && data.state) {
            applyRemoteState(data.state);
            if (typeof data.connectedClients === 'number') {
              setConnectedClients(data.connectedClients);
            }
          } else if (
            data.type === 'presence:update' &&
            typeof data.connectedClients === 'number'
          ) {
            setConnectedClients(data.connectedClients);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        setIsConnected(false);
        reconnectTimer = setTimeout(connectWs, 2000);
      };
    };

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [applyRemoteState]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ players }));
    } catch {
      // ignore quota issues
    }
  }, [players]);

  const goToSlide = useCallback(
    (newIndex: number, customPlayersList?: PlayerSlide[]) => {
      const list = customPlayersList || players;
      if (list.length === 0) return;
      const safeIndex = Math.max(0, Math.min(newIndex, list.length - 1));
      const targetPlayer = list[safeIndex];
      const nextBid = getInitialBidForPlayer(targetPlayer);

      setCurrentIndex(safeIndex);
      setCurrentBid(nextBid);
      setBidHistory([]);
      setLeadingTeamId(targetPlayer.soldToTeamId);
      setIsAuctionEnded(false);
      setActiveSale(null);
      setIsEditingBid(false);
      soundEngine.playSlideChange();

      broadcastStateUpdate({
        players: list,
        currentIndex: safeIndex,
        currentBid: nextBid,
        bidHistory: [],
        leadingTeamId: targetPlayer.soldToTeamId,
        isAuctionEnded: false,
        activeSale: null,
      });
    },
    [players, getInitialBidForPlayer, broadcastStateUpdate]
  );

  // Move to previous photo
  const handlePrevSlide = useCallback(() => {
    if (currentIndex > 0) {
      goToSlide(currentIndex - 1);
    }
  }, [currentIndex, goToSlide]);

  // Move to next photo — if already on the LAST photo, end the auction and show team numbers!
  const handleNextSlide = useCallback(() => {
    if (currentIndex < players.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      soundEngine.playSoldFanfare();
      setIsAuctionEnded(true);
      setActiveSale(null);
      broadcastStateUpdate({
        isAuctionEnded: true,
        activeSale: null,
      });
    }
  }, [currentIndex, players.length, goToSlide, broadcastStateUpdate]);

  // Handle Category Selection (Icon -> 50,00,000 ; A -> 30,00,000 ; B -> 20,00,000 ; C -> 10,00,000)
  const handleSelectCategory = useCallback(
    (basePrice: number) => {
      soundEngine.playBidIncrement('large');
      const updatedPlayers = players.map((p, idx) =>
        idx === currentIndex ? { ...p, basePrice } : p
      );

      setPlayers(updatedPlayers);
      setCurrentBid(basePrice);
      setBidHistory([]);
      setIsEditingBid(false);

      broadcastStateUpdate({
        players: updatedPlayers,
        currentBid: basePrice,
        bidHistory: [],
      });
    },
    [players, currentIndex, broadcastStateUpdate]
  );

  const handleAddBid = useCallback(
    (increment: number, label: string) => {
      const size =
        increment >= 500000 ? 'large' : increment >= 100000 ? 'medium' : 'small';
      soundEngine.playBidIncrement(size);

      const nextAmount = currentBid + increment;
      const nextHistory: BidEntry[] = [
        {
          id: `${Date.now()}-${Math.random()}`,
          amount: nextAmount,
          incrementLabel: label,
          teamId: leadingTeamId,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
        ...bidHistory.slice(0, 14),
      ];

      setLastStepAmount(increment);
      setCurrentBid(nextAmount);
      setBidHistory(nextHistory);

      broadcastStateUpdate({
        currentBid: nextAmount,
        bidHistory: nextHistory,
        lastStepAmount: increment,
      });
    },
    [currentBid, bidHistory, leadingTeamId, broadcastStateUpdate]
  );

  // Handle Up Arrow ^ button (+1,000 TK)
  const handleStepUp = useCallback(() => {
    handleAddBid(1000, '+1k');
  }, [handleAddBid]);

  // Handle Down Arrow v button (-1,000 TK)
  const handleStepDown = useCallback(() => {
    soundEngine.playStepDown();
    const nextBid = Math.max(0, currentBid - 1000);
    const nextHistory: BidEntry[] = [
      {
        id: `${Date.now()}-${Math.random()}`,
        amount: nextBid,
        incrementLabel: '-1k',
        teamId: leadingTeamId,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
      ...bidHistory.slice(0, 14),
    ];

    setLastStepAmount(1000);
    setBidHistory(nextHistory);
    setCurrentBid(nextBid);
    broadcastStateUpdate({
      currentBid: nextBid,
      bidHistory: nextHistory,
      lastStepAmount: 1000,
    });
  }, [currentBid, leadingTeamId, bidHistory, broadcastStateUpdate]);

  const handleSetCustomBid = useCallback(
    (numericAmount: number) => {
      const nextHistory: BidEntry[] = [
        {
          id: `${Date.now()}`,
          amount: numericAmount,
          incrementLabel: 'SET',
          teamId: leadingTeamId,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
        ...bidHistory.slice(0, 14),
      ];
      setCurrentBid(numericAmount);
      setBidHistory(nextHistory);
      broadcastStateUpdate({
        currentBid: numericAmount,
        bidHistory: nextHistory,
      });
    },
    [leadingTeamId, bidHistory, broadcastStateUpdate]
  );

  const handleResetCurrentBid = useCallback(() => {
    const initial = getInitialBidForPlayer(currentPlayer);
    setCurrentBid(initial);
    setBidHistory([]);
    broadcastStateUpdate({
      currentBid: initial,
      bidHistory: [],
    });
  }, [currentPlayer, getInitialBidForPlayer, broadcastStateUpdate]);

  const handleSelectLeadingTeam = useCallback(
    (teamId?: string) => {
      setLeadingTeamId(teamId);
      broadcastStateUpdate({ leadingTeamId: teamId });
    },
    [broadcastStateUpdate]
  );

  const handleSelectTeamToSell = useCallback(
    (team: Team) => {
      if (!currentPlayer) return;
      const saleTimestamp = Date.now();
      lastPlayedSaleTimestampRef.current = saleTimestamp;
      soundEngine.playSoldFanfare();

      const finalPrice = currentBid;
      const updatedPlayers = players.map((p, idx) =>
        idx === currentIndex
          ? {
              ...p,
              soldToTeamId: team.id,
              soldPrice: finalPrice,
            }
          : p
      );

      const salePayload: SyncedSalePayload = {
        playerId: currentPlayer.id,
        teamId: team.id,
        amount: finalPrice,
        timestamp: saleTimestamp,
      };

      setPlayers(updatedPlayers);
      setActiveSale(salePayload);

      broadcastStateUpdate({
        players: updatedPlayers,
        activeSale: salePayload,
      });
    },
    [currentPlayer, currentBid, players, currentIndex, broadcastStateUpdate]
  );

  // After Sold Celebration: if there are more photos, go to next photo; if this was the LAST photo, end the auction!
  const handleContinueAfterSale = useCallback(() => {
    setActiveSale(null);
    if (currentIndex < players.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      setIsAuctionEnded(true);
      broadcastStateUpdate({
        isAuctionEnded: true,
        activeSale: null,
      });
    }
  }, [currentIndex, players.length, goToSlide, broadcastStateUpdate]);

  const handleUndoActiveSale = useCallback(() => {
    if (!activeSale) return;
    const targetId = activeSale.playerId;
    const updatedPlayers = players.map((p) =>
      p.id === targetId
        ? { ...p, soldToTeamId: undefined, soldPrice: undefined }
        : p
    );
    setPlayers(updatedPlayers);
    setActiveSale(null);
    broadcastStateUpdate({
      players: updatedPlayers,
      activeSale: null,
    });
  }, [activeSale, players, broadcastStateUpdate]);

  const handleUnsellPlayer = useCallback(
    (playerId: string) => {
      const updatedPlayers = players.map((p) =>
        p.id === playerId
          ? { ...p, soldToTeamId: undefined, soldPrice: undefined }
          : p
      );
      setPlayers(updatedPlayers);
      broadcastStateUpdate({ players: updatedPlayers });
    },
    [players, broadcastStateUpdate]
  );

  const handleResetAllSales = useCallback(() => {
    const resetList = players.map((p) => ({
      ...p,
      soldToTeamId: undefined,
      soldPrice: undefined,
    }));
    const initialBid = getInitialBidForPlayer(resetList[0]);
    setPlayers(resetList);
    setCurrentIndex(0);
    setCurrentBid(initialBid);
    setBidHistory([]);
    setLeadingTeamId(undefined);
    setIsAuctionEnded(false);
    setActiveSale(null);
    localStorage.removeItem(STORAGE_KEY);
    broadcastStateUpdate({
      players: resetList,
      currentIndex: 0,
      currentBid: initialBid,
      bidHistory: [],
      leadingTeamId: undefined,
      isAuctionEnded: false,
      activeSale: null,
    });
    setDrawerOpen(false);
  }, [players, getInitialBidForPlayer, broadcastStateUpdate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        drawerOpen ||
        qrModalOpen ||
        isEditingBid ||
        isAuctionEnded ||
        ['INPUT', 'TEXTAREA'].includes(
          (e.target as HTMLElement)?.tagName || ''
        )
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleStepUp();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleStepDown();
      } else if (e.key === '1') {
        handleAddBid(100000, '+1L');
      } else if (e.key === '2') {
        handleAddBid(500000, '+5L');
      } else if (e.key === '3') {
        handleAddBid(50000, '+50k');
      } else if (e.key === '4') {
        handleAddBid(10000, '+10k');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    drawerOpen,
    qrModalOpen,
    isEditingBid,
    isAuctionEnded,
    handleNextSlide,
    handlePrevSlide,
    handleStepUp,
    handleStepDown,
    handleAddBid,
  ]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundEngine.muted = nextMuted;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleCustomBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseInt(customBidInput.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numeric) && numeric >= 0) {
      handleSetCustomBid(numeric);
    }
    setIsEditingBid(false);
  };

  const soldTeamForCurrent = TEAMS.find(
    (t) => t.id === currentPlayer?.soldToTeamId
  );
  const totalSoldCount = players.filter((p) => Boolean(p.soldToTeamId)).length;

  const activeSalePlayer = activeSale
    ? players.find((p) => p.id === activeSale.playerId) || currentPlayer
    : null;
  const activeSaleTeam = activeSale
    ? TEAMS.find((t) => t.id === activeSale.teamId)
    : null;

  // When last photo is completed, show the Auction Ended Summary View with all numbers each team got!
  if (isAuctionEnded && !activeSale) {
    return (
      <AuctionSummaryView
        teams={TEAMS}
        players={players}
        onBackToPhoto={(idx) => goToSlide(idx)}
        onReturnToBoard={() => {
          setIsAuctionEnded(false);
          broadcastStateUpdate({ isAuctionEnded: false });
        }}
        onResetAuction={handleResetAllSales}
      />
    );
  }

  if (viewMode === 'remote') {
    return (
      <>
        <MobileControlPanel
          players={players}
          teams={TEAMS}
          currentIndex={currentIndex}
          currentPlayer={currentPlayer}
          currentBid={currentBid}
          bidHistory={bidHistory}
          leadingTeamId={leadingTeamId}
          connectedClients={connectedClients}
          isConnected={isConnected}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onAddBid={handleAddBid}
          onStepUp={handleStepUp}
          onStepDown={handleStepDown}
          onPrevSlide={handlePrevSlide}
          onNextSlide={handleNextSlide}
          onGoToSlide={(idx) => goToSlide(idx)}
          onSetCustomBid={handleSetCustomBid}
          onSelectCategory={handleSelectCategory}
          onResetCurrentBid={handleResetCurrentBid}
          onSelectLeadingTeam={handleSelectLeadingTeam}
          onSellToTeam={handleSelectTeamToSell}
          onUnsellPlayer={handleUnsellPlayer}
          onAddBulkSlides={(newSlides) => {
            goToSlide(0, newSlides);
          }}
          onSwitchToStageView={() => setViewMode('board')}
          onOpenQrModal={() => setQrModalOpen(true)}
        />

        {activeSale && activeSalePlayer && activeSaleTeam && (
          <SoldCelebrationModal
            player={activeSalePlayer}
            team={activeSaleTeam}
            soldAmount={activeSale.amount}
            onContinueNext={handleContinueAfterSale}
            onUndoSale={handleUndoActiveSale}
          />
        )}

        <PhoneRemoteModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          connectedClients={connectedClients}
          onSwitchToControlPanelHere={() => setViewMode('remote')}
        />
      </>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between px-4 sm:px-6 lg:px-10 py-3 md:py-5 relative overflow-x-hidden"
      style={{
        background:
          'radial-gradient(circle at 38% 42%, #0e3075 0%, #071b47 52%, #030d26 100%)',
      }}
    >
      {/* Top Tournament Banner — Matches Image 1: ★ PSYCHOLOGY PREMIER LEAGUE-26 ★ */}
      <header className="w-full max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4 pb-2 md:pb-3">
        <div className="hidden xl:flex items-center gap-2 text-xs font-semibold text-sky-200/80 min-w-[260px]">
          <button
            type="button"
            onClick={() => {
              setDrawerTab('players');
              setDrawerOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-amber-300" />
            <span>
              Photo #{currentPlayer?.photoNumber || '01'} ({currentIndex + 1}/
              {players.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setQrModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-sky-300" />
            <span>Phone Remote ({connectedClients})</span>
          </button>
        </div>

        {/* Center Main Tournament Title with 3D Gold Stars */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-4 mx-auto">
          <svg
            className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 shrink-0 drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
            viewBox="0 0 64 64"
          >
            <defs>
              <linearGradient id="goldStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
            </defs>
            <polygon
              points="32,4 40,22 60,24 45,38 49,58 32,48 15,58 19,38 4,24 24,22"
              fill="url(#goldStarGrad)"
              stroke="#713f12"
              strokeWidth="1.5"
            />
          </svg>

          <h1 className="font-sans italic font-extrabold text-xl sm:text-3xl md:text-4xl lg:text-[44px] tracking-[0.06em] text-white uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] text-center">
            PSYCHOLOGY PREMIER LEAGUE-26
          </h1>

          <svg
            className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 shrink-0 drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
            viewBox="0 0 64 64"
          >
            <polygon
              points="32,4 40,22 60,24 45,38 49,58 32,48 15,58 19,38 4,24 24,22"
              fill="url(#goldStarGrad)"
              stroke="#713f12"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        {/* Right Utility Actions */}
        <div className="flex items-center justify-end gap-2 min-w-[260px] mx-auto xl:mx-0">
          <button
            type="button"
            onClick={() => setViewMode('remote')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Switch to Mobile Control Panel Layout"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-300" />
            <span>Control Panel Mode</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAuctionEnded(true);
              broadcastStateUpdate({ isAuctionEnded: true });
            }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-xs font-bold text-amber-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            <span>Team Numbers ({totalSoldCount})</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-300" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-300" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen Projector Mode"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Board Stage — Matches Image 1 Layout */}
      <main className="w-full max-w-[1600px] mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch my-auto py-1">
        {/* LEFT COLUMN (8 cols): Player Photo Frame + 5 Franchise Team Logos */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-4">
          <div className="w-full aspect-[16/9.2] relative">
            <PlayerCardSlide
              player={currentPlayer}
              currentBid={currentBid}
              soldTeam={soldTeamForCurrent}
            />
          </div>

          {/* Bottom Row: 5 Franchise Team Logos — Tap any team logo to sell current photo & advance */}
          <div className="pt-1">
            {soldTeamForCurrent && (
              <div className="flex items-center justify-end mb-1.5 px-2">
                <button
                  type="button"
                  onClick={() => handleUnsellPlayer(currentPlayer.id)}
                  className="text-xs font-bold text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Re-open Bidding</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-5 gap-2 sm:gap-4 md:gap-6 items-center justify-items-center">
              {TEAMS.map((team) => {
                const teamSoldPlayers = players.filter(
                  (p) => p.soldToTeamId === team.id
                );
                const isSoldToThisTeam =
                  currentPlayer.soldToTeamId === team.id;
                const isLeadingThisTeam = leadingTeamId === team.id;

                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => handleSelectTeamToSell(team)}
                    title={`Sell #${currentPlayer.photoNumber} to ${team.name} for ${formatTaka(currentBid)}`}
                    className={`group relative w-full flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-2xl transition-all duration-150 cursor-pointer ${
                      isSoldToThisTeam
                        ? 'bg-emerald-500/20 ring-2 ring-emerald-400 scale-105'
                        : isLeadingThisTeam
                        ? 'bg-amber-400/15 ring-2 ring-amber-300/80'
                        : 'hover:bg-white/5 hover:scale-105 active:scale-95'
                    }`}
                  >
                    <div className="relative w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 xl:w-36 xl:h-36 flex items-center justify-center">
                      <img
                        src={team.logoUrl}
                        alt={team.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.65)] group-hover:drop-shadow-[0_12px_25px_rgba(250,204,21,0.45)] transition-all"
                      />

                      {teamSoldPlayers.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-[#eab308] text-[#041230] font-mono-tabular font-extrabold text-[10px] sm:text-xs px-2 py-0.5 rounded-full shadow-md border border-[#041230]">
                          {teamSoldPlayers.length}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): The Periwinkle "Auction Board" Control Card matching Image 1 */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="flex-1 bg-[#9ab0f5] rounded-[34px] p-5 sm:p-6 xl:p-7 flex flex-col justify-between shadow-[0_24px_60px_rgba(0,0,0,0.55)] border border-white/30 text-[#090d16]">
            {/* Top PPL Logo + "Auction Board" Condensed Heading */}
            <div className="flex flex-col items-center text-center">
              <img
                src="/assets/extracted/ppl_logo.png"
                alt="PPL Logo"
                referrerPolicy="no-referrer"
                className="h-16 sm:h-20 xl:h-24 w-auto object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.25)]"
              />
              <h2 className="font-impact text-3xl sm:text-4xl xl:text-[48px] tracking-tight text-[#07090e] leading-none mt-1">
                Auction Board
              </h2>
            </div>

            {/* Gold Price Display Box — Matches Image 1 (#cca043 box with black border) */}
            <div className="my-2">
              <div
                onClick={() => {
                  if (!isEditingBid) {
                    setCustomBidInput(String(currentBid));
                    setIsEditingBid(true);
                  }
                }}
                title="Click to type a custom bid amount"
                className="w-full bg-[#cca043] border-[3px] border-[#18181b] rounded-[22px] py-5 sm:py-6 px-4 text-center shadow-[inset_0_2px_6px_rgba(255,255,255,0.35),0_8px_20px_rgba(0,0,0,0.2)] cursor-pointer transition-transform hover:scale-[1.01]"
              >
                {isEditingBid ? (
                  <form
                    onSubmit={handleCustomBidSubmit}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-2"
                  >
                    <input
                      type="number"
                      autoFocus
                      value={customBidInput}
                      onChange={(e) => setCustomBidInput(e.target.value)}
                      onBlur={handleCustomBidSubmit}
                      className="w-48 px-3 py-1 rounded-xl bg-white/90 border-2 border-[#18181b] font-mono-tabular font-extrabold text-2xl text-[#0f172a] text-center focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-[#18181b] text-white text-xs font-extrabold cursor-pointer"
                    >
                      Set
                    </button>
                  </form>
                ) : (
                  <div className="font-mono-tabular font-extrabold text-3xl sm:text-4xl xl:text-[42px] text-[#0f141c] tracking-tight leading-none">
                    {formatTaka(currentBid)}
                  </div>
                )}
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
                        onClick={() => handleSelectCategory(cat.basePrice)}
                        className={`py-2.5 px-2 rounded-[14px] font-sans font-extrabold flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer border-2 ${
                          isActive
                            ? 'bg-[#18181b] text-[#fde047] border-[#18181b] shadow-md'
                            : 'bg-[#e0e8ff] hover:bg-white text-[#0f141c] border-[#18181b]/20 shadow-sm'
                        }`}
                      >
                        <span className="text-base sm:text-lg leading-tight">
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4 White Rounded Increment Buttons: +1L, +5L, +50k, +10k */}
            <div className="grid grid-cols-4 gap-2.5 sm:gap-3 my-2">
              <button
                type="button"
                onClick={() => handleAddBid(100000, '+1L')}
                className="bg-white hover:bg-amber-50 active:scale-95 text-[#0f141c] font-sans font-extrabold text-lg sm:text-xl xl:text-2xl py-3 sm:py-3.5 rounded-[18px] shadow-[0_6px_14px_rgba(0,0,0,0.15)] transition-all cursor-pointer"
              >
                +1L
              </button>
              <button
                type="button"
                onClick={() => handleAddBid(500000, '+5L')}
                className="bg-white hover:bg-amber-50 active:scale-95 text-[#0f141c] font-sans font-extrabold text-lg sm:text-xl xl:text-2xl py-3 sm:py-3.5 rounded-[18px] shadow-[0_6px_14px_rgba(0,0,0,0.15)] transition-all cursor-pointer"
              >
                +5L
              </button>
              <button
                type="button"
                onClick={() => handleAddBid(50000, '+50k')}
                className="bg-white hover:bg-amber-50 active:scale-95 text-[#0f141c] font-sans font-extrabold text-lg sm:text-xl xl:text-2xl py-3 sm:py-3.5 rounded-[18px] shadow-[0_6px_14px_rgba(0,0,0,0.15)] transition-all cursor-pointer"
              >
                +50k
              </button>
              <button
                type="button"
                onClick={() => handleAddBid(10000, '+10k')}
                className="bg-white hover:bg-amber-50 active:scale-95 text-[#0f141c] font-sans font-extrabold text-lg sm:text-xl xl:text-2xl py-3 sm:py-3.5 rounded-[18px] shadow-[0_6px_14px_rgba(0,0,0,0.15)] transition-all cursor-pointer"
              >
                +10k
              </button>
            </div>

            {/* Bottom Directional Diamond Control Cluster — Matches Image 1 (Yellow << >> and Black ^ v) */}
            <div className="relative flex items-center justify-center gap-5 sm:gap-7 py-2 mt-1">
              <button
                type="button"
                onClick={handlePrevSlide}
                title="Previous Photo (Left Arrow)"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#fcd116] hover:bg-[#fde047] active:scale-95 text-white flex items-center justify-center shadow-[0_10px_22px_rgba(0,0,0,0.22)] transition-all cursor-pointer"
              >
                <ChevronsLeft className="w-12 h-12 sm:w-14 sm:h-14 stroke-[3]" />
              </button>

              <div className="flex flex-col items-center gap-4 sm:gap-5">
                <button
                  type="button"
                  onClick={handleStepUp}
                  title="+1,000 TK (Up Arrow)"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#07090e] hover:bg-[#1e293b] active:scale-95 text-white flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-all cursor-pointer"
                >
                  <ChevronUp className="w-8 h-8 sm:w-9 sm:h-9 stroke-[3]" />
                </button>

                <button
                  type="button"
                  onClick={handleStepDown}
                  title="-1,000 TK (Down Arrow)"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#07090e] hover:bg-[#1e293b] active:scale-95 text-white flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-all cursor-pointer"
                >
                  <ChevronDown className="w-8 h-8 sm:w-9 sm:h-9 stroke-[3]" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleNextSlide}
                title={
                  currentIndex === players.length - 1
                    ? 'Finish Auction & Show Team Numbers'
                    : 'Next Photo (Right Arrow)'
                }
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#fcd116] hover:bg-[#fde047] active:scale-95 text-white flex items-center justify-center shadow-[0_10px_22px_rgba(0,0,0,0.22)] transition-all cursor-pointer"
              >
                <ChevronsRight className="w-12 h-12 sm:w-14 sm:h-14 stroke-[3]" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {activeSale && activeSalePlayer && activeSaleTeam && (
        <SoldCelebrationModal
          player={activeSalePlayer}
          team={activeSaleTeam}
          soldAmount={activeSale.amount}
          onContinueNext={handleContinueAfterSale}
          onUndoSale={handleUndoActiveSale}
        />
      )}

      <PhoneRemoteModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        connectedClients={connectedClients}
        onSwitchToControlPanelHere={() => setViewMode('remote')}
      />

      <TournamentDrawerModal
        isOpen={drawerOpen}
        initialTab={drawerTab}
        onClose={() => setDrawerOpen(false)}
        teams={TEAMS}
        players={players}
        currentIndex={currentIndex}
        onSelectPlayerIndex={(idx) => goToSlide(idx)}
        onAddBulkSlides={(newSlides) => {
          goToSlide(0, newSlides);
          setDrawerOpen(false);
        }}
        onDeletePlayer={(id) => {
          if (players.length <= 1) return;
          const filtered = players.filter((p) => p.id !== id);
          const safeIdx = Math.min(currentIndex, filtered.length - 1);
          goToSlide(safeIdx, filtered);
        }}
        onUnsellPlayer={handleUnsellPlayer}
        onResetAuction={handleResetAllSales}
      />
    </div>
  );
}
