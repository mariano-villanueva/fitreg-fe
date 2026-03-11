import { createContext, useContext, useState, useCallback } from "react";

type FeedbackType = "success" | "error" | "warning";

interface FeedbackMessage {
  id: number;
  text: string;
  type: FeedbackType;
}

interface FeedbackContextValue {
  showFeedback: (text: string, type?: FeedbackType) => void;
  showSuccess: (text: string) => void;
  showError: (text: string) => void;
  showWarning: (text: string) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

let nextId = 0;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);

  const showFeedback = useCallback((text: string, type: FeedbackType = "success") => {
    const id = ++nextId;
    setMessages((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 4000);
  }, []);

  const showSuccess = useCallback((text: string) => showFeedback(text, "success"), [showFeedback]);
  const showError = useCallback((text: string) => showFeedback(text, "error"), [showFeedback]);
  const showWarning = useCallback((text: string) => showFeedback(text, "warning"), [showFeedback]);

  return (
    <FeedbackContext.Provider value={{ showFeedback, showSuccess, showError, showWarning }}>
      {children}
      <div className="feedback-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`feedback-toast feedback-${msg.type}`}
            onClick={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}
          >
            {msg.text}
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}
