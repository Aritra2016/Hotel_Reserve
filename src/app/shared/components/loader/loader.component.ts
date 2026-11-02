import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { LoadingService } from '../../../core/services/loading.service';

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.css'],
})
export class LoaderComponent {
  // Observables stream from centralized LoadingService
  isLoading$: Observable<boolean>;
  progress$: Observable<number>;
  message$: Observable<string>;

  constructor(public loadingService: LoadingService) {
    this.isLoading$ = this.loadingService.isLoading$;
    this.progress$ = this.loadingService.progress$;
    this.message$ = this.loadingService.message$;
  }
}
