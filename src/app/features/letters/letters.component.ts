import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-letters',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './letters.component.html',
  styleUrl: './letters.component.scss'
})
export class LettersComponent {

}
