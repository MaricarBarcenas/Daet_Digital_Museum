import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Loader2, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

// Technical error details are shown only in local development.
const DEBUG = import.meta.env.DEV;

type ArtifactRef = { id: string; name: string };
type Msg = { role: "user" | "assistant"; content: string; artifacts?: ArtifactRef[] };

const SUGGESTIONS = [
  "What are the most interesting artifacts?",
  "What are the museum's opening hours?",
  "How do the QR codes work?",
];

const GREETING: Msg = {
  role: "assistant",
  content: "Hello! I'm the Daet Digital Museum guide. Ask me about our artifacts, collections, or how to visit.",
};

const Askmuseum = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;

    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      // Send only real conversation turns (skip the local greeting),
      // capped to the last 12 so requests stay small and fast
      const history = next
        .slice(1)
        .slice(-12)
        .map(({ role, content }) => ({ role, content }));

      const invoke = () =>
        supabase.functions.invoke("ask-museum", { body: { messages: history } });

      let { data, error } = await invoke();

      // One automatic retry for transient failures (cold start, network blip)
      if (error || !data?.reply) {
        await new Promise((r) => setTimeout(r, 800));
        ({ data, error } = await invoke());
      }

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.reply) throw new Error("Empty reply from ask-museum");

      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply, artifacts: data.artifacts },
      ]);
    } catch (e: any) {
      console.error("ask-museum error:", e);

      let detail: string = e?.message ?? "Unknown error";

      // For non-2xx responses, read the function's real response body
      if (e?.context && typeof e.context.json === "function") {
        try {
          const body = await e.context.json();
          console.error("ask-museum response body:", body);
          detail = body?.error ?? JSON.stringify(body);
        } catch {
          /* body wasn't JSON */
        }
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: DEBUG
            ? `Sorry, I couldn't reach the guide right now.\n\nDetails: ${detail}`
            : "Sorry, I couldn't reach the guide right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2563eb] to-[#4338ca] px-5 py-3 text-sm font-bold text-white shadow-xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
            aria-label="Ask the museum"
          >
            <Sparkles className="h-4 w-4" /> Ask the Museum
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 bottom-3 z-50 flex h-[min(560px,calc(100vh-24px))] flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px]"
            role="dialog"
            aria-label="Ask the Museum chat"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#2563eb] to-[#4338ca] px-4 py-3 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <p className="font-display text-sm font-bold">Ask the Museum</p>
                  <p className="text-[10px] text-[#dbeafe]">AI guide · answers from our collection</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#f1f6fd] p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%]">
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "rounded-br-sm bg-[#2563eb] text-white"
                          : "rounded-bl-sm border border-[#e2e8f0] bg-white text-[#0f172a]"
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.artifacts && m.artifacts.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.artifacts.map((a) => (
                          <Link
                            key={a.id}
                            to={`/artifact/${a.id}`}
                            className="inline-flex items-center gap-1 rounded-full bg-[#dbeafe] px-2.5 py-1 text-[11px] font-semibold text-[#1d4ed8] hover:bg-[#2563eb] hover:text-white"
                          >
                            {a.name} <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[#e2e8f0] bg-white px-3.5 py-2.5 text-xs text-[#64748b]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2563eb]" /> Thinking…
                  </div>
                </div>
              )}

              {messages.length === 1 && !loading && (
                <div className="flex flex-col gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-left text-xs font-medium text-[#1d4ed8] transition-colors hover:border-[#2563eb] hover:bg-[#dbeafe]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-[#e2e8f0] bg-white p-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about an artifact…"
                maxLength={500}
                className="h-10 flex-1 rounded-full border-[#e2e8f0] bg-[#f1f6fd] px-4 text-sm"
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || !input.trim()}
                className="h-10 w-10 shrink-0 rounded-full bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Askmuseum;
