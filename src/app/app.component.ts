import { Component } from '@angular/core';
import { AppUpdateService } from './services/app-update.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'negocio';

  constructor( appUpdate: AppUpdateService ) {
    appUpdate.start();
  }
}
