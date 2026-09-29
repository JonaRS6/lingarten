import { Component, OnInit } from '@angular/core';
import { ClientdataService } from '../../services/clientdata.service';

interface Stats {
  earn: number;
  debt: number;
}
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  stats: Stats = {
    earn: 0,
    debt: 0
  };
  constructor(private service: ClientdataService) {
    this.stats.earn = 0;
    this.stats.debt = 0;
    this.getStats();
  }

  ngOnInit(): void {
  }
  // Totals are computed by the getStats function; querying the notes here as
  // well would read every one of them again.
  getStats(): void {
    this.service.getStats().then(({ earns, debt }) => {
      this.stats.earn = earns;
      this.stats.debt = debt;
    }).catch(error => console.error('No se pudieron obtener las estadísticas.', error));
  }
}
