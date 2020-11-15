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
  getStats(): void {
    this.service.getStats().then(res => {
      console.log(res);
    });
    let earn = 0;
    let debt = 0;
    this.service.getStatsPayed().subscribe(resp => {
      console.log(resp);
      resp.forEach(doc => {
        earn = earn + doc.data().cost;
        console.log(doc.data().cost);
      });
      console.log(earn);
      this.stats.earn = earn;
    });
    this.service.getStatsDebt().subscribe(resp => {
      console.log(resp);
      resp.forEach(doc => {
        debt = debt + doc.data().cost;
        console.log(doc.data().cost);
      });
      console.log(debt);
      this.stats.debt = debt;
    });
  }
}
