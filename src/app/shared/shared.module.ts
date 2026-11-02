import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ImgFallbackDirective } from './directives/img-fallback.directive';
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';
import { UserTripsModalComponent } from './components/user-trips-modal/user-trips-modal.component';
import { LoaderComponent } from './components/loader/loader.component';

// Concept: SharedModule declaring and exporting shared components, directives and FormModules
@NgModule({
  declarations: [
    ImgFallbackDirective,
    AuthModalComponent,
    UserTripsModalComponent,
    LoaderComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  exports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ImgFallbackDirective,
    AuthModalComponent,
    UserTripsModalComponent,
    LoaderComponent,
  ],
})
export class SharedModule {}
