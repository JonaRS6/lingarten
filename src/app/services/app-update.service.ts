import { Injectable, NgZone } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
// Right after opening nothing has been typed yet, so a new version can load at once.
const STARTUP_WINDOW_MS = 15 * 1000;
// Pages without forms or imports in progress, safe to reload while the tab is hidden.
const READ_ONLY_PATHS = ['/table', '/panel', '/balance'];

// Swaps in a newly deployed version without the user reloading or clearing the cache:
// right after opening, on the next navigation, or while the tab is in the background.
@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {

  private ready = false;
  private readonly startedAt = Date.now();

  constructor( private swUpdate: SwUpdate, private router: Router, private dialog: MatDialog, private zone: NgZone ) { }

  start(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }
    this.swUpdate.available.subscribe(() => {
      this.swUpdate.activateUpdate().then(() => {
        this.ready = true;
        if (Date.now() - this.startedAt < STARTUP_WINDOW_MS || this.canReloadInBackground()) {
          document.location.reload();
        }
      });
    });
    // Load the destination fresh instead of routing inside the old version.
    this.router.events.pipe(filter(event => event instanceof NavigationStart)).subscribe((event: NavigationStart) => {
      if (this.ready) {
        document.location.assign(event.url);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.check();
      } else if (this.ready && this.canReloadInBackground()) {
        document.location.reload();
      }
    });
    // Outside Angular so the interval doesn't keep the app from stabilizing.
    this.zone.runOutsideAngular(() => setInterval(() => this.check(), CHECK_INTERVAL_MS));
    this.check();
  }

  private check(): void {
    this.swUpdate.checkForUpdate().catch(() => {});
  }

  private canReloadInBackground(): boolean {
    return document.hidden
      && this.dialog.openDialogs.length === 0
      && READ_ONLY_PATHS.some(path => this.router.url.startsWith(path));
  }
}
