'use client';

import { useEffect, useState } from 'react';
import { ChatWebSocket, Message, WebSocketMessage } from '@/lib/pythonBridge';

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatWs, setChatWs] = useState<ChatWebSocket | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        const ws = new ChatWebSocket();
        await ws.connect();
        setChatWs(ws);
        setWsError(null);
      } catch (error) {
        setWsError('Failed to connect to chat server');
        console.error('WebSocket connection failed:', error);
        // Try to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      chatWs?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!chatWs) return;

    const unsubscribe = chatWs.onMessage((message: WebSocketMessage) => {
      switch (message.type) {
        case 'content':
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.role === 'assistant') {
              lastMessage.content.push(message.data);
            } else {
              newMessages.push({
                role: 'assistant',
                content: [message.data]
              });
            }
            return newMessages;
          });
          break;

        case 'tool_result':
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                ...message.data
              }]
            });
            return newMessages;
          });
          break;

        case 'error':
          console.error('Chat error:', message.data);
          break;
      }
    });

    return () => unsubscribe();
  }, [chatWs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatWs || !input.trim() || isLoading) return;

    setIsLoading(true);
    try {
      await chatWs.startChat({
        messages: [
          ...messages,
          {
            role: 'user',
            content: [{
              type: 'text',
              text: input
            }]
          }
        ],
        api_key: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '',
      });
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-zinc-100">
      {wsError && (
        <div className="bg-red-500 text-white p-2 text-center">
          {wsError}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, i) => (
          <div key={i} className={`mb-4 ${message.role === 'assistant' ? 'pl-4' : 'pr-4'}`}>
            {message.content.map((content, j) => (
              <div key={j} className={`p-3 rounded-lg ${
                message.role === 'user' ? 'ml-auto bg-blue-600' : 'mr-auto bg-zinc-700'
              } max-w-[80%]`}>
                {content.type === 'text' && <p>{content.text}</p>}
                {content.type === 'tool_result' && (
                  <div className="font-mono text-sm">
                    {content.result?.output && (
                      <pre className="whitespace-pre-wrap">{content.result.output}</pre>
                    )}
                    {content.result?.error && (
                      <pre className="text-red-400 whitespace-pre-wrap">{content.result.error}</pre>
                    )}
                    {content.result?.base64_image && (
                      <img 
                        src={`data:image/png;base64,${content.result?.base64_image}`} 
                        alt="Tool output"
                        className="max-w-full rounded mt-2"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-zinc-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-zinc-800 text-zinc-100 rounded-lg p-2 font-mono 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your message..."
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-mono 
                     hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
