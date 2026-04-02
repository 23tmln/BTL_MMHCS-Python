import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Shield, Lock, RotateCcw, AlertTriangle, Eye, EyeOff, X } from "lucide-react";

export default function PassphraseModal() {
  const {
    isPassphraseModalOpen,
    passphraseMode,
    isSignalConfigured,
    backupKeysWithPassphrase,
    restoreKeysWithPassphrase,
    skipRestoreAndGenerateNewKeys,
    closePassphraseModal
  } = useAuthStore();

  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isPassphraseModalOpen) return null;

  const handleSetup = async () => {
    setError("");
    if (passphrase.length < 8) {
      setError("Passphrase phải có ít nhất 8 ký tự");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError("Passphrase không khớp");
      return;
    }
    setIsLoading(true);
    try {
      await backupKeysWithPassphrase(passphrase);
      if (isSignalConfigured) {
        closePassphraseModal();
      }
    } finally {
      setIsLoading(false);
      setPassphrase("");
      setConfirmPassphrase("");
    }
  };

  const handleRestore = async () => {
    setError("");
    if (!passphrase) {
      setError("Vui lòng nhập passphrase");
      return;
    }
    setIsLoading(true);
    try {
      await restoreKeysWithPassphrase(passphrase);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
      setPassphrase("");
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      await skipRestoreAndGenerateNewKeys();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-base-300 relative">
        {/* Close Button if already configured */}
        {isSignalConfigured && (
          <button 
            className="absolute top-4 right-4 text-base-content/50 hover:text-base-content z-10 bg-base-100 rounded-full p-1 shadow-sm"
            onClick={closePassphraseModal}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className={`p-6 text-center ${passphraseMode === "setup" ? "bg-primary/10" : "bg-warning/10"}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${passphraseMode === "setup" ? "bg-primary/20" : "bg-warning/20"}`}>
            {passphraseMode === "setup" ? (
              <Shield className="w-7 h-7 text-primary" />
            ) : (
              <Lock className="w-7 h-7 text-warning" />
            )}
          </div>
          <h2 className="text-xl font-bold">
            {passphraseMode === "setup" ? "Bảo vệ khóa mã hóa của bạn" : "Khôi phục khóa mã hóa"}
          </h2>
          <p className="text-sm text-base-content/60 mt-1">
            {passphraseMode === "setup"
              ? "Tạo passphrase để backup khóa E2EE lên server"
              : "Nhập passphrase để khôi phục lịch sử tin nhắn"}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Warning notice */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-base-content/70">
              <strong>Passphrase không được lưu ở bất kỳ đâu.</strong> Nếu quên passphrase, bạn sẽ mất lịch sử tin nhắn. Đây là yêu cầu bắt buộc của E2EE để bảo vệ quyền riêng tư của bạn.
            </p>
          </div>

          {/* Passphrase input */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                {passphraseMode === "setup" ? "Tạo Passphrase" : "Nhập Passphrase"}
              </span>
            </label>
            <div className="relative">
              <input
                id="passphrase-input"
                type={showPassphrase ? "text" : "password"}
                className={`input input-bordered w-full pr-12 ${error ? "input-error" : ""}`}
                placeholder="Nhập passphrase (≥8 ký tự)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") passphraseMode === "setup" ? handleSetup() : handleRestore();
                }}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                onClick={() => setShowPassphrase(!showPassphrase)}
              >
                {showPassphrase ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm passphrase (setup only) */}
          {passphraseMode === "setup" && (
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Xác nhận Passphrase</span>
              </label>
              <input
                id="passphrase-confirm-input"
                type={showPassphrase ? "text" : "password"}
                className={`input input-bordered w-full ${error ? "input-error" : ""}`}
                placeholder="Nhập lại passphrase"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSetup(); }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="alert alert-error py-2 text-sm">
              <X className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            {passphraseMode === "setup" ? (
              <>
                <button
                  id="backup-now-btn"
                  className="btn btn-primary w-full"
                  onClick={handleSetup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                  Backup ngay
                </button>
                {isSignalConfigured ? (
                  <button
                    id="close-modal-btn"
                    className="btn btn-ghost btn-sm w-full text-base-content/50"
                    onClick={closePassphraseModal}
                    disabled={isLoading}
                  >
                    Đóng
                  </button>
                ) : (
                  <button
                    id="skip-backup-btn"
                    className="btn btn-ghost btn-sm w-full text-base-content/50"
                    onClick={handleSkip}
                    disabled={isLoading}
                  >
                    Bỏ qua (khóa sẽ không được backup)
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  id="restore-keys-btn"
                  className="btn btn-warning w-full"
                  onClick={handleRestore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Khôi phục lịch sử tin nhắn
                </button>
                <button
                  id="generate-new-keys-btn"
                  className="btn btn-ghost btn-sm w-full text-error/70"
                  onClick={handleSkip}
                  disabled={isLoading}
                >
                  Tạo khóa mới (mất lịch sử cũ)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
