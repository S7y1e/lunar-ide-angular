import { Component, inject } from '@angular/core';
import { LayoutService } from '../core/layout.service';
import { ACTIVITY_VIEWS } from './activity-views';

@Component({
    selector: 'app-activity-bar',
    standalone: true,
    templateUrl: './activity-bar.component.html',
    styleUrl: './activity-bar.component.scss',
})
export class ActivityBarComponent {
    protected readonly layout = inject(LayoutService);
    protected readonly views = ACTIVITY_VIEWS;
}
