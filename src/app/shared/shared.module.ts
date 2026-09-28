import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ImgFallbackDirective } from './directives/img-fallback.directive';

// Concept: SharedModule declaring and exporting shared directives and Angular FormModules
@NgModule({
  declarations: [
    ImgFallbackDirective,
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
  ],
})
export class SharedModule {}
