import { Component, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from './api.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  
  constructor(public apiService: ApiService) {}

  isTetsing: boolean;

  url: string = 'https://pos2dev.aso.com.tw/api/v2/shops';
  duration: number = 1000;
  number: string = '3';
  max: string = '10';

  apiList: string [] = [
    'https://pos2dev.aso.com.tw/api/v2/shops',
    'https://pos2dev.aso.com.tw/api/v2/members?size=10&page=1&mobile=0900000000',
    'https://pos2dev.aso.com.tw/api/v2/members/CU170200001746',
    'https://pos2dev.aso.com.tw/api/v2/products?size=10&page=1&simple=14291'
  ]

  durationOption = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];

  /**
   * 
   * Chart related setting
   */
  averageTime: any[];
  view: any[] = [700, 400];

  // options
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = true;
  xAxisLabel = 'Time ranges';
  showYAxisLabel = true;
  yAxisLabel = 'API Count';

  colorScheme = {
    domain: ['#66bb6a', '#26c6da', '#42a5f5', '#ffca28', '#ef5350', '#ab47bc']
  };

  @HostListener('window:beforeunload', ['$event']) beforeUnload(event) {
    // this.apiService.backup();
    event.returnValue = '';
  }

  subscribtion: Subscription;

  start(): void {
    if (this.url && this.duration && this.number && this.max) {
      if (this.subscribtion) {
        this.subscribtion.unsubscribe();
      }
      this.apiService.startTesting(this.url, this.duration, +this.number, +this.max);
      this.subscribtion = this.apiService.complete$.subscribe(() => {
        this.isTetsing = false;
        this.loadChart();
      });
      this.averageTime = null;
      this.isTetsing = true;
    }
  }
  
  stop(): void {
    this.apiService.kill$.next();
    this.isTetsing = false;
  }

  loadChart(): void {
    this.updateTimeCostChart();
  }

  updateTimeCostChart(): void {
    const meta = this.apiService.meta;
    const chart = [
      {
        name: '< 1s',
        value: meta.filter(meta => meta.timecost < 1).length
      },
      {
        name: '1s ~ 2s',
        value: meta.filter(meta => 1 <= meta.timecost && meta.timecost < 2).length
      },
      {
        name: '2s ~ 3s',
        value: meta.filter(meta => 2 <= meta.timecost && meta.timecost < 3).length
      },
      {
        name: '3s ~ 5s',
        value: meta.filter(meta => 3 <= meta.timecost && meta.timecost < 5).length
      },
      {
        name: '5s ~ 10s',
        value: meta.filter(meta => 5 <= meta.timecost && meta.timecost < 10).length
      },
      {
        name: '> 10s',
        value: meta.filter(meta => meta.timecost >= 10).length
      }
    ];
    this.averageTime = chart;
  }
}
