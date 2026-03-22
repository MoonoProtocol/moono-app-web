import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class WorkspaceHeaderComponent extends Component {
  @service('moono-state') moonoState;

  get walletButtonLabel() {
    if (this.moonoState.walletBusy) {
      return this.moonoState.walletConnected
        ? 'Disconnecting...'
        : 'Connecting...';
    }

    return this.moonoState.walletConnected
      ? this.moonoState.walletShort
      : 'Connect wallet';
  }

  @action async toggleWallet() {
    await this.moonoState.toggleWalletConnection();
  }

  @action async selectBlockchain(event) {
    this.moonoState.updateBlockchain(event.target.value);
  }

  @action async selectNetwork(event) {
    let nextValue = event.target.value;

    if (nextValue === 'custom') {
      let rpcEndpoint = window.prompt(
        'Enter custom Solana RPC URL',
        this.moonoState.settings.rpcEndpoint,
      );

      if (!rpcEndpoint?.trim()) {
        event.target.value = this.moonoState.settings.networkPreset;
        return;
      }

      await this.moonoState.updateNetworkPreset('custom', rpcEndpoint.trim());
      return;
    }

    await this.moonoState.updateNetworkPreset(nextValue);
  }

  @action async refresh() {
    await this.moonoState.refreshAll();
  }
}
