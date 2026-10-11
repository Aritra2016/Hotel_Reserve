# Rule: Explicit Event Binding to Component Methods & DevTools Inspectability

## Rule Summary
Always bind events in Angular HTML templates (`(click)`, `(submit)`, `(change)`, etc.) to explicit named methods defined in the corresponding `component.ts` file.

## Specific Requirements
1. **No Inline Expressions in Templates**:
   - ❌ Never write inline state changes: `(click)="isOpen = false"`, `(click)="showPassword = !showPassword"`, `(click)="activeTab = 'signup'"`.
   - ❌ Never write inline event manipulation: `(click)="$event.stopPropagation()"`.
   - ❌ Never chain multiple expressions inline: `(click)="$event.stopPropagation(); navigateToListing(id)"`.
   - ✅ Always define a dedicated method in `component.ts` (e.g. `(click)="togglePasswordVisibility()"`, `(click)="closeDropdown()"`, `(click)="onDialogClick($event)"`).

2. **DevTools Elements Tag Inspectability**:
   - For all interactive controls (buttons, clickable cards, modal triggers), attach a descriptive `data-action="methodName()"` attribute matching the component method.
   - This allows any developer to inspect the element in Chrome/Edge DevTools "Elements" panel and immediately identify which TypeScript method is responsible without guessing.
