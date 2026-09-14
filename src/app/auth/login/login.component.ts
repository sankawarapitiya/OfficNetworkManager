import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);
  
  email = '';
  password = '';
  errorMsg = '';
  isLoading = false;

  async onSubmit() {
    if (!this.email || !this.password) return;
    this.isLoading = true;
    this.errorMsg = '';
    
    try {
      await this.authService.login(this.email, this.password);
    } catch (e: any) {
      this.errorMsg = e.message || 'Login failed';
    } finally {
      this.isLoading = false;
    }
  }
}
