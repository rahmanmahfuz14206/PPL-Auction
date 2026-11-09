import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, X, Copy, Check, ExternalLink } from 'lucide-react';

interface PhoneRemoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedClients: number;
  onSwitchToControlPanelHere: () => void;
}

export const PhoneRemoteModal: React.FC<PhoneRemoteModalProps> = ({
  isOpen,
  onClose,
  connectedClients,
  onSwitchToControlPanelHere,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build URL with ?mode=remote so scanning on a phone opens directly in Control Panel mode
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';
  const remoteUrl = `${baseUrl}?mode=remote`;

  const handleCopy = () => {
    navigator.clipboard.writeText(remoteUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-[#071942] border border-amber-400/40 rounded-3xl p-6 shadow-2xl text-center relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center mx-auto mb-3 text-amber-300">
          <Smartphone className="w-6 h-6" />
        </div>

        <h3 className="font-display font-extrabold text-2xl text-white uppercase tracking-wide">
          Phone Remote Control Panel
        </h3>
        <p className="text-xs text-slate-300 mt-1">
          Scan with your phone camera or open the link on your phone. Every tap on your phone (+1L, +5L, &lt;&lt;, &gt;&gt;, or Team Logo to Sell) updates the big screen live!
        </p>

        {/* QR Code Box */}
        <div className="my-5 inline-block bg-white p-4 rounded-2xl shadow-xl border-4 border-[#eab308]">
          <QRCodeSVG
            value={remoteUrl}
            size={190}
            bgColor="#ffffff"
            fgColor="#041230"
            level="M"
          />
        </div>

        <div className="text-xs font-semibold text-emerald-300 mb-4">
          {connectedClients} Active Screen{connectedClients === 1 ? '' : 's'} Connected in Real Time
        </div>

        {/* Copy URL Bar */}
        <div className="flex items-center gap-2 bg-[#04102b] border border-white/15 rounded-xl p-2 mb-4">
          <input
            type="text"
            readOnly
            value={remoteUrl}
            className="flex-1 bg-transparent text-xs text-slate-200 font-mono-tabular px-2 focus:outline-none truncate"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-[#eab308] hover:bg-[#facc15] text-[#041230] text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Preview Phone Control Panel directly on this screen */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onSwitchToControlPanelHere();
          }}
          className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <ExternalLink className="w-4 h-4 text-amber-300" />
          <span>Preview Phone Control Panel on This Screen</span>
        </button>
      </div>
    </div>
  );
};
