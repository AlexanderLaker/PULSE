/**
 * AIChatPanel — Natural language chat interface for querying PRISM model.
 * Bottom bar slide-up panel. Apple design.
 */

import { useState, useRef, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageCircle, Loader2 } from 'lucide-react';
import { T } from '@/lib/format';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage?: (message: string) => Promise<string>;
}

const AIChatPanel: FC<AIChatPanelProps> = ({ isOpen, onClose, onSendMessage }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Welcome to PRISM AI. Ask me about shift projections, force decomposition, or category comparisons. I work with relative shifts only — no absolute financials.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let response: string;
      if (onSendMessage) {
        response = await onSendMessage(userMsg.content);
      } else {
        // Fallback mock response
        await new Promise(r => setTimeout(r, 800));
        response = `Analysis based on current simulation: ${userMsg.content.includes('shift') ? 'The portfolio shows a net negative shift driven primarily by Government and Environmental forces propagating through the simulation model.' : 'I can help with shift projections, force analysis, and category comparisons. What would you like to know?'}`;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error processing your query. Please try again.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: 0,
            right: 0,
            width: 420,
            maxWidth: '100vw',
            height: '60vh',
            maxHeight: 500,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            background: '#FFFFFF',
            borderRadius: '16px 16px 0 0',
            border: '1px solid rgba(0,0,0,0.08)',
            borderBottom: 'none',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.12)',
          } as React.CSSProperties}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
            } as React.CSSProperties}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageCircle size={16} color={T.accent} />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F' }}>PRISM AI Chat</span>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.04)',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              } as React.CSSProperties}
            >
              <X size={14} color="#1D1D1F" />
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            } as React.CSSProperties}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? T.accent : '#F5F5F7',
                  color: msg.role === 'user' ? '#FFFFFF' : '#1D1D1F',
                  fontSize: 13,
                  lineHeight: 1.5,
                } as React.CSSProperties}
              >
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: '#F5F5F7',
                  borderRadius: 12,
                } as React.CSSProperties}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 size={14} color={T.text3} />
                </motion.div>
                <span style={{ fontSize: 12, color: T.text3 }}>Analyzing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              borderTop: '1px solid rgba(0,0,0,0.06)',
            } as React.CSSProperties}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about shifts, forces, categories..."
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: 13,
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 10,
                outline: 'none',
                background: '#F5F5F7',
                fontFamily: 'inherit',
              } as React.CSSProperties}
              disabled={isLoading}
            />
            <motion.button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              whileHover={input.trim() ? { scale: 1.05 } : {}}
              whileTap={input.trim() ? { scale: 0.95 } : {}}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: input.trim() ? T.accent : '#E5E5E5',
                border: 'none',
                borderRadius: 10,
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              } as React.CSSProperties}
            >
              <Send size={16} color={input.trim() ? '#FFFFFF' : '#999'} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIChatPanel;
