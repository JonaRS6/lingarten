import { Provider } from '@angular/core';
import { SETTINGS as FIRESTORE_SETTINGS } from '@angular/fire/firestore';
import { ORIGIN as FUNCTIONS_ORIGIN } from '@angular/fire/functions';

// Ports must match the "emulators" block in firebase.json. Auth stays on the
// real project: firebase@7 has no Auth emulator API.
export const EMULATOR_PROVIDERS: Provider[] = [
  { provide: FIRESTORE_SETTINGS, useValue: { host: 'localhost:8080', ssl: false } },
  { provide: FUNCTIONS_ORIGIN, useValue: 'http://localhost:5001' }
];

console.warn('[Lingarten] Firestore y Functions apuntan a los emuladores locales.');
