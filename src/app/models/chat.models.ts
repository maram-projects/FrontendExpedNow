// chat.models.ts

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  SENDING = 'SENDING'
}

export enum WebSocketMessageType {
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  TYPING_INDICATOR = 'TYPING_INDICATOR',
  USER_TYPING = 'USER_TYPING',                  
  USER_STOP_TYPING = 'USER_STOP_TYPING',     
  MESSAGE_READ = 'MESSAGE_READ',
  DELIVERY_UPDATE = 'DELIVERY_UPDATE',
  USER_STATUS = 'USER_STATUS',
  HEARTBEAT = 'HEARTBEAT',
  CONNECTION_ESTABLISHED = 'CONNECTION_ESTABLISHED',
  CONNECTION_CLOSED = 'CONNECTION_CLOSED',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
  ERROR = 'ERROR',
  TYPING_STOP = "TYPING_STOP",
  TYPING_START = "TYPING_START"
}

export interface Message {
  id?: string;
  content: string;
  senderId: string;
  receiverId: string;
  deliveryId: string;
  timestamp?: Date;
  status: MessageStatus;
  readAt?: Date;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  editedAt?: Date;
  isEdited?: boolean;
  replyToMessageId?: string;
}

export interface ChatRoom {
  id: string;
  deliveryId: string;
  clientId: string;
  deliveryPersonId: string;
  clientName: string;
  deliveryPersonName: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  status: 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
  createdAt: Date;
  updatedAt?: Date;
  // Additional room metadata
  deliveryAddress?: string;
  estimatedDeliveryTime?: Date;
  deliveryStatus?: string;
}

export interface ChatMessageRequest {
  content: string;
  receiverId: string;
  deliveryId: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  replyToMessageId?: string;
}

export interface TypingIndicator {
  senderId: string;
  receiverId: string;
  deliveryId: string;
  isTyping: boolean;
  timestamp?: Date;
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
  timestamp?: Date;
  id?: string;
}

export interface PageResponse<T> {
  content: T[];
  pageable: {
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    pageSize: number;
    pageNumber: number;
    paged: boolean;
    unpaged: boolean;
  };
  last: boolean;
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  first: boolean;
  numberOfElements: number;
  empty: boolean;
  // Add optional pagination field for server response
  pagination?: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
    pageable?: any;
    sort?: any;
  };
}

export interface UserStatus {
  userId: string;
  status: 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY';
  lastSeen?: Date;
}

export interface ChatNotification {
  id: string;
  userId: string;
  deliveryId: string;
  type: 'NEW_MESSAGE' | 'DELIVERY_UPDATE' | 'SYSTEM_NOTIFICATION';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

// Utility interfaces for API responses
export interface MessageReadResponse {
  deliveryId: string;
  readCount: number;
  lastReadMessageId: string;
  readBy: string;
  readAt: Date;
}

export interface DeliveryUpdateResponse {
  deliveryId: string;
  status: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  estimatedArrival?: Date;
  message?: string;
}

// Error handling interfaces
export interface ChatError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Configuration interfaces
export interface ChatConfig {
  typingTimeoutDuration: number;
  messageRetryAttempts: number;
  reconnectInterval: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  enableTypingIndicators: boolean;
  enableReadReceipts: boolean;
  maxMessagesInMemory: number;  // Added this missing property
  heartbeatInterval: number;    // Added for heartbeat configuration
  connectionTimeout: number;    // Added for connection timeout
}

// Default configuration
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  typingTimeoutDuration: 3000,
  messageRetryAttempts: 3,
  reconnectInterval: 5000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
  enableTypingIndicators: true,
  enableReadReceipts: true,
  maxMessagesInMemory: 1000,    // Added default value
  heartbeatInterval: 30000,     // 30 seconds
  connectionTimeout: 5000       // 5 seconds
};

// Utility functions for type checking
export function isMessage(obj: any): obj is Message {
  return obj && 
    typeof obj.content === 'string' &&
    typeof obj.senderId === 'string' &&
    typeof obj.receiverId === 'string' &&
    typeof obj.deliveryId === 'string' &&
    Object.values(MessageStatus).includes(obj.status);
}

export function isChatRoom(obj: any): obj is ChatRoom {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.deliveryId === 'string' &&
    typeof obj.clientId === 'string' &&
    typeof obj.deliveryPersonId === 'string';
}

export function isTypingIndicator(obj: any): obj is TypingIndicator {
  return obj &&
    typeof obj.senderId === 'string' &&
    typeof obj.receiverId === 'string' &&
    typeof obj.deliveryId === 'string' &&
    typeof obj.isTyping === 'boolean';
}

// Additional utility interfaces for WebSocket service compatibility
export interface WebSocketServiceMessage {
  type: string;
  payload: any;
}

export interface ConnectionStatus {
  isConnected: boolean;
  connectionId?: string;
  lastConnected?: Date;
  reconnectAttempts?: number;
}