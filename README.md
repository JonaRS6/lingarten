# Negocio

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 10.0.8.

## Development server

Local development runs against the Firebase emulators (Firestore + Functions),
so no production data is touched. Sign-in still uses the real Firebase Auth
with an administrator Google account.

1. Emulators (Node 24, Java 21+, global `firebase` CLI):
   `nvm use 24 && npm --prefix functions ci && npm run emulators`
   — UI at `http://localhost:4000`. Data persists in `.emulator-data/` on exit.
2. App (Node 12): `nvm use 12 && npm install && npm start`
   — open `http://localhost:4200/`.

`npm run start:prod-data` serves the app against the real Firebase project.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
