import { Injectable } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { AuthService } from './services/auth.service';

export interface ChatMessage {
  user?: string;      // Make user optional
  type?: string;      // Add type field
  message: string;
  timestamp: string;
  channel?: string;   // Add channel field
  requesting_user?: string;  // Added for subscription requests
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private socket: WebSocket | null = null;
  private messagesSubject = new Subject<ChatMessage>();
  private pendingRequestsSubject = new BehaviorSubject<ChatMessage[]>([]);
  private currentUser: string | null = null;
  private subscribedChannels: Set<string> = new Set();

  // Observables for components to subscribe to
  public notifications$ = this.messagesSubject.asObservable();
  public pendingRequests$ = this.pendingRequestsSubject.asObservable();

  constructor(private authService: AuthService) {
    // Subscribe to auth changes
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = user.username;
        this.connect();
      } else {
        this.close();
      }
    });
  }

  connect() {
    if (!this.currentUser) return;

    this.socket = new WebSocket(`ws://localhost:8000/ws?user_id=${this.currentUser}`);

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
          case 'subscription_request':
            // Only add to pending requests if current user is moderator
            if (this.authService.getCurrentUser()?.isModerator) {
              const currentRequests = this.pendingRequestsSubject.value;
              this.pendingRequestsSubject.next([...currentRequests, data]);
            }
            break;

          case 'subscription_approved':
            this.subscribedChannels.add(data.channel);
            this.messagesSubject.next({
              type: 'system',
              message: data.message,
              channel: data.channel,
              timestamp: new Date().toISOString()
            });
            break;

          case 'chat_message':
            if (this.subscribedChannels.has(data.channel)) {
              this.messagesSubject.next(data);
            }
            break;

          case 'error':
            console.error('Server error:', data.message);
            this.messagesSubject.next({
              type: 'error',
              message: data.message,
              timestamp: new Date().toISOString()
            });
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    this.socket.onopen = () => {
      console.log('WebSocket connection established');
      // If user is moderator, automatically subscribe to moderator channel
      if (this.authService.getCurrentUser()?.isModerator) {
        this.subscribedChannels.add('moderator_channel');
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.reason);
      // Clear subscribed channels when connection closes
      this.subscribedChannels.clear();
    };
  }

  requestChannelSubscription(channel: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const request = {
        type: 'subscribe_request',
        channel: channel
      };
      this.socket.send(JSON.stringify(request));
      this.messagesSubject.next({
        type: 'system',
        message: `Subscription request sent for ${channel}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  approveRequest(requestingUser: string, channel: string) {
    if (!this.authService.getCurrentUser()?.isModerator) {
      console.error('Only moderators can approve requests');
      return;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      const approval = {
        type: 'approve_subscription',
        requesting_user: requestingUser,
        channel: channel
      };
      this.socket.send(JSON.stringify(approval));
      
      // Remove the request from pending requests
      const currentRequests = this.pendingRequestsSubject.value;
      this.pendingRequestsSubject.next(
        currentRequests.filter(req => req.requesting_user !== requestingUser)
      );
    }
  }

  sendMessage(channel: string, message: string) {
    if (!this.subscribedChannels.has(channel)) {
      console.error('Not subscribed to this channel');
      return;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      const chatMessage = {
        type: 'chat_message',
        channel: channel,
        message: message,
        user: this.currentUser,
        timestamp: new Date().toISOString()
      };
      this.socket.send(JSON.stringify(chatMessage));
    }
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.subscribedChannels.clear();
      this.pendingRequestsSubject.next([]);
    }
  }

  isSubscribedToChannel(channel: string): boolean {
    return this.subscribedChannels.has(channel);
  }
}
