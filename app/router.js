import EmberRouter from '@ember/routing/router';
import config from 'moono/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('liquidity-pools');
  this.route('borrow');
  this.route('loans');
  this.route('loan', { path: '/loans/:loan_address' });
  this.route('profile');
  this.route('solana-resource', { path: '/solana/:resource_id' });
});
