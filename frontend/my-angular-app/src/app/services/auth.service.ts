import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface LoginResponse {
  message: string;
  is_moderator: boolean;
  username: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/auth/login', { username, password })
      .pipe(
        tap(response => {
          this.currentUserSubject.next({
            username,
            isModerator: response.is_moderator
          });
        })
      );
  }

  logout() {
    this.currentUserSubject.next(null);
  }

  getCurrentUser() {
    return this.currentUserSubject.value;
  }
}