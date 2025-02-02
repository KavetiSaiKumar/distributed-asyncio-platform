import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { NotificationService, ChatMessage } from './notification.service';
import { AuthService } from './services/auth.service';
import { LoginComponent } from './login/login.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    LoginComponent, 
    FormsModule,
    HttpClientModule
  ],
  template: `
    <main class="app-container">
      <ng-container *ngIf="(authService.currentUser$ | async) as user; else loginTemplate">
        <div class="sidebar">
          <div class="logo-container">
            <div class="app-brand">ChatApp</div>
          </div>
          
          <div class="sidebar-content">
            <div class="channels-section">
              <div class="channels-header">
                <span class="channels-title">Text Channels</span>
              </div>
              
              <div class="channel-list">
                <div class="channel-item" 
                     [class.active]="currentChannel === 'General'"
                     (click)="selectChannel('General')">
                  <span class="channel-hash">#</span>
                  <span>general</span>
                  <button *ngIf="!isSubscribed('General')" 
                          (click)="requestAccess('General'); $event.stopPropagation()">
                    Join
                  </button>
                </div>
              </div>
            </div>

            <!-- Moderator Section -->
            <div *ngIf="user.isModerator" class="requests-section">
              <h3>Pending Requests</h3>
              <div *ngFor="let request of pendingRequests" class="request-item">
                <span>{{ request.requesting_user }} wants to join {{ request.channel }}</span>
                <button (click)="approveRequest(request.requesting_user, request.channel)">
                  Approve
                </button>
              </div>
            </div>

            <div class="user-info">
              <div class="user-avatar">
                <img [src]="'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.username" 
                     alt="avatar" />
                <span class="status-indicator"></span>
              </div>
              <div class="user-details">
                <span class="username">{{ user.username }}</span>
                <span class="status">Online</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="main-content">
          <div class="chat-header">
            <div class="channel-info">
              <span class="channel-hash">#</span>
              <span class="channel-name">{{ currentChannel }}</span>
            </div>
          </div>
          
          <div class="chat-messages" #messageContainer>
            <div *ngFor="let message of messages" 
                 [ngClass]="{'system-message': message.type === 'system', 
                            'chat-message': message.type === 'chat_message'}">
              <ng-container [ngSwitch]="message.type">
                <div *ngSwitchCase="'chat_message'">
                  <strong>{{ message.user }}:</strong> {{ message.message }}
                </div>
                <div *ngSwitchCase="'system'" class="system-message">
                  {{ message.message }}
                </div>
              </ng-container>
            </div>
          </div>

          <div class="message-input-container" *ngIf="isSubscribed(currentChannel)">
            <div class="message-input-wrapper">
              <input type="text" 
                     [(ngModel)]="newMessage" 
                     (keyup.enter)="sendMessage()"
                     class="message-input" 
                     [placeholder]="'Message #' + currentChannel" />
            </div>
          </div>
        </div>
      </ng-container>
      
      <ng-template #loginTemplate>
        <app-login></app-login>
      </ng-template>
    </main>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  currentChannel = 'General';
  newMessage = '';
  messages: ChatMessage[] = [];
  pendingRequests: any[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    public authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    // Subscribe to notifications
    this.subscriptions.push(
      this.notificationService.notifications$.subscribe(message => {
        this.messages.push(message);
      })
    );

    // Subscribe to pending requests (for moderators)
    this.subscriptions.push(
      this.notificationService.pendingRequests$.subscribe(requests => {
        this.pendingRequests = requests;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  selectChannel(channel: string) {
    this.currentChannel = channel;
  }

  isSubscribed(channel: string): boolean {
    return this.notificationService.isSubscribedToChannel(channel);
  }

  requestAccess(channel: string) {
    this.notificationService.requestChannelSubscription(channel);
  }

  approveRequest(requestingUser: string, channel: string) {
    this.notificationService.approveRequest(requestingUser, channel);
  }

  sendMessage() {
    if (this.newMessage.trim() && this.currentChannel) {
      this.notificationService.sendMessage(this.currentChannel, this.newMessage.trim());
      this.newMessage = '';
    }
  }
}

