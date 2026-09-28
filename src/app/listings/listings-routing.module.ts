import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListingsComponent } from './listings.component';
import { HotelDetailsComponent } from './components/hotel-details/hotel-details.component';

// Concept: Child routing configuration for the Listings and Hotel Details & Booking Flow
const routes: Routes = [
  {
    path: '',
    component: ListingsComponent,
  },
  {
    path: ':id',
    component: HotelDetailsComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ListingsRoutingModule {}
