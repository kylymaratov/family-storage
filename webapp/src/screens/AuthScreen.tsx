import { useState } from "react";

interface AuthScreenProps {
  onLogin: (token: string) => void;
}

export const AuthScreen = ({ onLogin }: AuthScreenProps) => {
  const [tokenInput, setTokenInput] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onLogin(tokenInput);
        }}
        className="w-full max-w-sm bg-surface border border-white/10 p-6 rounded-[var(--radius-card)] shadow-2xl space-y-4"
      >
        <h1 className="text-xl font-bold text-content text-center tracking-tight">
          Family Cloud
        </h1>
        <input
          type="password"
          placeholder="Access token"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          className="w-full px-4 py-3 bg-bg border border-white/10 rounded-[var(--radius-control)] text-content text-sm focus:outline-none focus:border-accent placeholder:text-faint"
        />
        <button
          type="submit"
          className="w-full py-3 bg-accent hover:bg-accent-hover font-semibold text-sm rounded-[var(--radius-control)] text-white transition-colors"
        >
          Sign in
        </button>
      </form>
    </div>
  );
};
