import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="login-container">
      <form (ngSubmit)="onSubmit()">
        <h2>Login</h2>
        <div class="form-group">
          <input
            type="text"
            [(ngModel)]="username"
            name="username"
            placeholder="Username"
            required
          />
        </div>
        <div class="form-group">
          <input
            type="password"
            [(ngModel)]="password"
            name="password"
            placeholder="Password"
            required
          />
        </div>
        <button type="submit">Login</button>
        
        <div *ngIf="error" class="error-message">
          {{ error }}
        </div>
      </form>
    </div>
  `,
  styles: [`
    .login-container {
      max-width: 400px;
      margin: 50px auto;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .form-group {
      margin-bottom: 15px;
    }
    input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    button {
      width: 100%;
      padding: 10px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .error-message {
      color: red;
      margin-top: 10px;
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';

  constructor(private authService: AuthService) {}

  onSubmit() {
    this.error = '';
    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        console.log('Login successful', response);
      },
      error: (error) => {
        this.error = error.error.message || 'Login failed';
      }
    });
  }
} 