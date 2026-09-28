import { Directive, ElementRef, HostListener, Input } from '@angular/core';

// Directive: Custom attribute directive to gracefully fallback to a default image on error
@Directive({
  selector: 'img[appImgFallback]',
})
export class ImgFallbackDirective {
  // Concept: Optional input property with default fallback URL
  @Input() appImgFallback: string = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80';

  // Concept: Dependency injection of ElementRef
  constructor(private el: ElementRef) {}

  // Concept: HostListener lifecycle event handling image load errors
  @HostListener('error', ['$event'])
  onImageError(event: Event): void {
    // Concept: instanceof check to verify event target is an HTMLImageElement
    if (event?.target instanceof HTMLImageElement) {
      const imgElement = event.target as HTMLImageElement;
      // Concept: Debugging log for image load error
      console.debug('[ImgFallbackDirective] Image load failed, applying fallback:', imgElement.src);
      // Concept: Set fallback src
      imgElement.src = this.appImgFallback;
    }
  }
}
