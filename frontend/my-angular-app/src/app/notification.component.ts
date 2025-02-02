import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';  // Import FormsModule here
import { NotificationService, ChatMessage } from './notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification',
  template: `
    <div class="chat-container">
      <div class="messages">
        <div *ngFor="let msg of messages" class="message">
          <strong>{{ msg.user }}:</strong> {{ msg.message }}
        </div>
      </div>
      <div class="input-area">
        <input 
          [(ngModel)]="newMessage" 
          (keyup.enter)="sendMessage()"
          placeholder="Type a message..."
        >
        <button (click)="sendMessage()">Send</button>
      </div>
    </div>
  `,
  styles: [`
    .chat-container {
      width: 100%;
      max-width: 400px;
      border: 1px solid #ccc;
      padding: 10px;
      margin-top: 20px;
    }
    .messages {
      height: 300px;
      overflow-y: scroll;
      border-bottom: 1px solid #eee;
      margin-bottom: 10px;
    }
    .input-area {
      display: flex;
      gap: 10px;
    }
    .input-area input {
      flex-grow: 1;
      padding: 5px;
    }
  `],
  standalone: true,
  imports: [CommonModule, FormsModule]  // Ensure FormsModule is imported here
})
export class NotificationComponent implements OnInit, OnDestroy {
  messages: ChatMessage[] = [];
  newMessage = '';
  private subscription: Subscription | null = null;

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    // Connect to WebSocket
    this.notificationService.connect();

    // Request subscription to 'general' channel
    this.notificationService.requestChannelSubscription('general');

    // Subscribe to incoming messages
    this.subscription = this.notificationService.notifications$
      .subscribe(message => {
        this.messages.push(message);
      });
  }

  sendMessage() {
    // Send message if not empty
    if (this.newMessage.trim()) {
      this.notificationService.sendMessage('general', this.newMessage);
      this.newMessage = '';
    }
  }

  ngOnDestroy() {
    // Cleanup: unsubscribe and close connection
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.notificationService.close();
  }
}
