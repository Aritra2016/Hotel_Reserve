import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../shared/shared.module';
import { ListingsRoutingModule } from './listings-routing.module';

import { ListingsComponent } from './listings.component';
import { HotelCardComponent } from './components/hotel-card/hotel-card.component';
import { HotelFiltersComponent } from './components/hotel-filters/hotel-filters.component';
import { HotelMapComponent } from './components/hotel-map/hotel-map.component';
import { HotelQuickViewComponent } from './components/hotel-quick-view/hotel-quick-view.component';
import { HotelDetailsComponent } from './components/hotel-details/hotel-details.component';

// Concept: Feature module declaring all listings and hotel booking detail components
@NgModule({
  declarations: [
    ListingsComponent,
    HotelCardComponent,
    HotelFiltersComponent,
    HotelMapComponent,
    HotelQuickViewComponent,
    HotelDetailsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    ListingsRoutingModule,
  ],
  exports: [
    HotelDetailsComponent,
  ],
})
export class ListingsModule {}
