import Application from '@ember/application';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import { Buffer } from 'buffer';
import config from 'moono/config/environment';

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

loadInitializers(App, config.modulePrefix);
