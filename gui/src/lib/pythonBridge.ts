export type MessageContent = {
  type: string;
  text?: string;
  result?: {
    output?: string;
    error?: string;
    system?: string;
    base64_image?: string;
  };
};

export type Message = {
  role: 'user' | 'assistant';
  content: MessageContent[];
};

export type WebSocketMessage = {
  type: 'content' | 'tool_result' | 'api_response' | 'complete' | 'error';
  data: any;
};

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];

  connect() {
    if (typeof window === 'undefined') return Promise.reject('WebSocket only works in browser');
    
    this.ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/chat`);
    
    this.ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.messageHandlers.forEach(handler => handler(message));
    };

    return new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject('WebSocket not initialized');
      
      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
    });
  }

  onMessage(handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  async startChat(config: {
    messages: Message[];
    api_key: string;
    model?: string;
    provider?: string;
    system_prompt_suffix?: string;
    only_n_most_recent_images?: number;
    max_tokens?: number;
  }) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify(config));
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
} 